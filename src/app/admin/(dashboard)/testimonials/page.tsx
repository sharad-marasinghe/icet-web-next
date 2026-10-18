import Image from "next/image";
import { connection } from "next/server";
import { Quote, Plus, Star, UserRound, Video } from "lucide-react";
import { sql } from "@/lib/db";
import { PageHeader, Panel, DataTable, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteTestimonial } from "./actions";

type Row = { id: string; name: string; role: string; company: string; quote: string; photo_url: string | null; video_url: string | null; program_code: string | null; rating: number | null; is_active: boolean; sort_order: number };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function TestimonialsPage({ searchParams }: PageProps<"/admin/testimonials">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (name ilike ${"%" + q + "%"} or company ilike ${"%" + q + "%"} or quote ilike ${"%" + q + "%"} or program_code ilike ${"%" + q + "%"})` : sql``} ${status === "active" ? sql`and is_active` : status === "inactive" ? sql`and not is_active` : sql``}`;
  const [rows, [{ count }]] = await Promise.all([
    sql<Row[]>`select id, name, role, company, quote, photo_url, video_url, program_code, rating, is_active, sort_order from public.testimonials ${where} order by sort_order asc, created_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.testimonials ${where}`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/testimonials${qs({ q })}`, active: !status },
    { label: "Active", href: `/admin/testimonials${qs({ q, status: "active" })}`, active: status === "active" },
    { label: "Inactive", href: `/admin/testimonials${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  return (
    <>
      <PageHeader title="Testimonials" description="Alumni success stories shown in testimonial blocks and on programme pages." actions={<Button href="/admin/testimonials/new" size="sm"><Plus className="h-4 w-4" /> New testimonial</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search name, company, quote…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/testimonials/${r.id}`}
          empty={<EmptyState icon={<Quote className="h-6 w-6" />} title={q || status ? "No testimonials match" : "No testimonials yet"} description="Collect a few words from alumni and add them here." action={!q && !status ? <Button href="/admin/testimonials/new" size="sm"><Plus className="h-4 w-4" /> New testimonial</Button> : undefined} />}
          columns={[
            { key: "name", header: "Person", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100">{r.photo_url ? <Image src={r.photo_url} alt="" fill sizes="36px" className="object-cover" /> : <UserRound className="absolute inset-0 m-auto h-4 w-4 text-slate-400" />}</span>
                <span><span className="block font-semibold text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{[r.role, r.company].filter(Boolean).join(" · ")}</span></span>
              </span>
            ) },
            { key: "quote", header: "Quote", hideBelow: "md", render: (r) => <span className="line-clamp-2 max-w-md text-slate-600">{r.quote}{r.video_url && <Video className="ml-1 inline h-3.5 w-3.5 text-brand-600" aria-label="Has video" />}</span> },
            { key: "program_code", header: "Programme", hideBelow: "lg", render: (r) => r.program_code ? <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{r.program_code}</code> : <span className="text-slate-400">—</span> },
            { key: "rating", header: "Rating", hideBelow: "lg", render: (r) => r.rating ? <span className="inline-flex items-center gap-0.5 text-amber-500">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span> : <span className="text-slate-400">—</span> },
            { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24", render: (r) => <RowActions id={r.id} editHref={`/admin/testimonials/${r.id}`} onDelete={deleteTestimonial} deleteMessage={`Delete the testimonial from “${r.name}”?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/testimonials${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
