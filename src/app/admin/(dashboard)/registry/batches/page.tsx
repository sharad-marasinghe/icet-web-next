import { Plus, Layers } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Pagination, SearchBox, StatusBadge, EmptyState } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { BatchRowActions } from "@/components/admin/registry/batch-row-actions";
import { sp, spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";

type Row = { id: number; batch_name: string; slug: string; course_code: string; is_open: boolean; created_at: string; applications: number; pending: number };
const PER = 20;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function BatchesPage({ searchParams }: AdminPageProps) {
  await connection();
  const spv = await searchParams;
  const q = sp(spv.q).trim();
  const page = Math.max(1, spInt(spv.page, 1));
  const user = await getCurrentUser();
  const where = q ? sql`where (b.batch_name ilike ${"%" + q + "%"} or b.course_code ilike ${"%" + q + "%"} or b.slug ilike ${"%" + q + "%"})` : sql``;
  const [rows, [{ count }]] = await Promise.all([
    sql<Row[]>`select b.id, b.batch_name, b.slug, b.course_code, b.is_open, b.created_at::text,
        (select count(*) from public.reg_applications a where a.batch_id = b.id)::int as applications,
        (select count(*) from public.reg_applications a where a.batch_id = b.id and a.status in ('submitted','under_review'))::int as pending
      from public.reg_batches b ${where} order by b.is_open desc, b.created_at desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.reg_batches b ${where}`,
  ]);
  return (
    <>
      <PageHeader title="Academic batches" description="Intakes for iCD / iCP programmes with their application forms." actions={<Button href="/admin/registry/batches/new" size="sm"><Plus className="h-4 w-4" /> New batch</Button>} />
      <Panel padded={false}>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <SearchBox defaultValue={q} placeholder="Search name or course code…" />
          <Button type="submit" variant="outline" size="sm">Search</Button>
          {q && <Button href="/admin/registry/batches" variant="ghost" size="sm">Reset</Button>}
        </form>
        <div className="p-5">
          <DataTable<Row>
            rows={rows.map((r) => ({ ...r }))}
            empty={<EmptyState icon={<Layers className="h-7 w-7" />} title="No batches yet" description="Create an intake batch to start collecting applications." action={<Button href="/admin/registry/batches/new" size="sm"><Plus className="h-4 w-4" /> New batch</Button>} />}
            columns={[
              { key: "batch_name", header: "Batch", render: (r) => <div><p className="font-semibold text-slate-900">{r.batch_name}</p><p className="text-[11px] text-slate-500">/academic-registration/{r.slug}</p></div> },
              { key: "course_code", header: "Course code", hideBelow: "md", render: (r) => <span className="font-mono text-xs text-slate-700">{r.course_code || "—"}</span> },
              { key: "applications", header: "Applications", render: (r) => <div><span className="font-semibold text-slate-900">{r.applications}</span>{r.pending > 0 && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{r.pending} to review</span>}</div> },
              { key: "is_open", header: "Status", render: (r) => <StatusBadge value={r.is_open ? "open" : "closed"} map={{ open: "green" }} /> },
              { key: "created_at", header: "Created", hideBelow: "lg", render: (r) => <span className="text-slate-600">{formatDate(r.created_at)}</span> },
              { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => <BatchRowActions id={r.id} name={r.batch_name} isOpen={r.is_open} isAdmin={hasRole(user, "admin")} /> },
            ]}
          />
          <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER))} baseHref={`/admin/registry/batches${qs({ q, page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
