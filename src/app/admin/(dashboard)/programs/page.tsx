import Image from "next/image";
import { connection } from "next/server";
import { GraduationCap, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { formatLKR } from "@/lib/utils";
import { PageHeader, Panel, DataTable, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteProgram, duplicateProgram } from "./actions";

type Row = { id: string; code: string; slug: string; name: string; qualification: string; logo_url: string | null; accent: string; fee_from: number | null; sort_order: number; is_active: boolean; blocks_count: number };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function ProgramsList({ searchParams }: PageProps<"/admin/programs">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (name ilike ${"%" + q + "%"} or code ilike ${"%" + q + "%"} or slug ilike ${"%" + q + "%"})` : sql``} ${status === "active" ? sql`and is_active` : status === "inactive" ? sql`and not is_active` : sql``}`;
  const [rows, [{ count }]] = await Promise.all([
    sql<Row[]>`select id, code, slug, name, qualification, logo_url, accent, fee_from, sort_order, is_active, coalesce(jsonb_array_length(content->'blocks'), 0) as blocks_count from public.programs ${where} order by sort_order asc, code asc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.programs ${where}`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/programs${qs({ q })}`, active: !status },
    { label: "Active", href: `/admin/programs${qs({ q, status: "active" })}`, active: status === "active" },
    { label: "Inactive", href: `/admin/programs${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  return (
    <>
      <PageHeader title="Programmes" description="Professional programmes (iCM, iCD, iCP…). Each programme has its own public page built from content blocks." actions={<Button href="/admin/programs/new" size="sm"><Plus className="h-4 w-4" /> New programme</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search name, code or slug…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/programs/${r.id}`}
          empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title={q || status ? "No programmes match" : "No programmes yet"} description="Add the programmes offered by iCET; they appear in the navigation and on programme cards." action={!q && !status ? <Button href="/admin/programs/new" size="sm"><Plus className="h-4 w-4" /> New programme</Button> : undefined} />}
          columns={[
            { key: "name", header: "Programme", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-bold text-white" style={{ background: r.accent }}>{r.logo_url ? <Image src={r.logo_url} alt="" fill sizes="36px" className="object-contain p-1" unoptimized={r.logo_url.endsWith(".svg")} /> : r.code.slice(0, 3)}</span>
                <span><span className="block font-semibold text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{r.qualification || `${r.blocks_count} block${r.blocks_count === 1 ? "" : "s"}`}</span></span>
              </span>
            ) },
            { key: "code", header: "Code", render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{r.code}</code> },
            { key: "slug", header: "Slug", hideBelow: "lg", render: (r) => <span className="font-mono text-xs text-slate-600">/{r.slug}</span> },
            { key: "fee_from", header: "Fee from", hideBelow: "md", render: (r) => <span className="text-slate-600">{r.fee_from != null ? formatLKR(r.fee_from) : "—"}</span> },
            { key: "sort_order", header: "Order", hideBelow: "lg", className: "text-center", render: (r) => <span className="text-slate-500">{r.sort_order}</span> },
            { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-36", render: (r) => <RowActions id={r.id} editHref={`/admin/programs/${r.id}`} viewHref={r.is_active ? `/${r.slug}` : undefined} onDuplicate={duplicateProgram} onDelete={deleteProgram} editBase="/admin/programs" deleteMessage={`Delete programme “${r.name}”? Testimonials and inquiries referencing code ${r.code} will keep the code but lose the link.`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/programs${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
