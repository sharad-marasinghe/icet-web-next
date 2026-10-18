import Image from "next/image";
import { connection } from "next/server";
import { Handshake, Plus, ExternalLink } from "lucide-react";
import { sql } from "@/lib/db";
import { PageHeader, Panel, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deletePartner } from "./actions";

type Row = { id: string; name: string; logo_url: string; website_url: string | null; category: string; is_active: boolean; sort_order: number };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function PartnersPage({ searchParams }: PageProps<"/admin/partners">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (name ilike ${"%" + q + "%"} or category ilike ${"%" + q + "%"})` : sql``} ${status === "active" ? sql`and is_active` : status === "inactive" ? sql`and not is_active` : status && status !== "all" ? sql`and category = ${status}` : sql``}`;
  const [rows, [{ count }], cats] = await Promise.all([
    sql<Row[]>`select id, name, logo_url, website_url, category, is_active, sort_order from public.partners ${where} order by sort_order asc, name asc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.partners ${where}`,
    sql<{ category: string; n: number }[]>`select category, count(*)::int as n from public.partners group by category order by category`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/partners${qs({ q })}`, active: !status },
    ...cats.map((c) => ({ label: c.category.replace(/_/g, " "), href: `/admin/partners${qs({ q, status: c.category })}`, active: status === c.category, count: c.n })),
    { label: "Inactive", href: `/admin/partners${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  return (
    <>
      <PageHeader title="Partners" description="Industry, training and academic partner logos shown in the partner marquee and grids." actions={<Button href="/admin/partners/new" size="sm"><Plus className="h-4 w-4" /> New partner</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search partners…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/partners/${r.id}`}
          empty={<EmptyState icon={<Handshake className="h-6 w-6" />} title={q || status ? "No partners match" : "No partners yet"} description="Add partner logos to show them on the website." action={!q && !status ? <Button href="/admin/partners/new" size="sm"><Plus className="h-4 w-4" /> New partner</Button> : undefined} />}
          columns={[
            { key: "name", header: "Partner", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white"><Image src={r.logo_url} alt="" fill sizes="64px" className="object-contain p-1" unoptimized={r.logo_url.endsWith(".svg")} /></span>
                <span className="font-semibold text-slate-900">{r.name}</span>
              </span>
            ) },
            { key: "category", header: "Category", render: (r) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">{r.category.replace(/_/g, " ")}</span> },
            { key: "website_url", header: "Website", hideBelow: "md", render: (r) => r.website_url ? <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">{r.website_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} <ExternalLink className="h-3 w-3" /></a> : <span className="text-slate-400">—</span> },
            { key: "sort_order", header: "Order", hideBelow: "lg", className: "text-center", render: (r) => <span className="text-slate-500">{r.sort_order}</span> },
            { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24", render: (r) => <RowActions id={r.id} editHref={`/admin/partners/${r.id}`} onDelete={deletePartner} deleteMessage={`Delete partner “${r.name}”?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/partners${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
