import { Plus, Ticket } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, DataTable, Pagination, SearchBox, StatusBadge, EmptyState, ASelect } from "@/components/admin/ui";
import { WorkshopRowActions } from "@/components/admin/registry/workshop-row-actions";
import { certificatePrefix } from "@/lib/registry/service";
import { sp, spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";

type Row = { id: number; title: string; slug: string; status: string; cert_id_prefix: string; starts_at: string | null; seats: number | null; registrations: number; attended: number; certificates: number };
const PER = 20;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function WorkshopsPage({ searchParams }: AdminPageProps) {
  await connection();
  const spv = await searchParams;
  const q = sp(spv.q).trim();
  const status = sp(spv.status);
  const page = Math.max(1, spInt(spv.page, 1));
  const user = await getCurrentUser();
  const where = sql`where true ${q ? sql`and (w.title ilike ${"%" + q + "%"} or w.slug ilike ${"%" + q + "%"} or w.cert_id_prefix ilike ${"%" + q + "%"})` : sql``} ${status ? sql`and w.status = ${status}::public.workshop_status` : sql``}`;
  const [rows, [{ count }], [stats]] = await Promise.all([
    sql<Row[]>`select w.id, w.title, w.slug, w.status::text, w.cert_id_prefix, w.starts_at::text, w.seats,
        (select count(*) from public.reg_enrollments e where e.workshop_id = w.id)::int as registrations,
        (select count(*) from public.reg_attendance a where a.workshop_id = w.id and a.is_attended)::int as attended,
        (select count(*) from public.reg_enrollments e where e.workshop_id = w.id and e.certificate_code is not null)::int as certificates
      from public.reg_workshops w ${where} order by w.status = 'active' desc, w.starts_at desc nulls last, w.id desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.reg_workshops w ${where}`,
    sql<{ active: number; total: number; regs: number }[]>`select (select count(*) from public.reg_workshops where status = 'active')::int as active, (select count(*) from public.reg_workshops)::int as total, (select count(*) from public.reg_enrollments)::int as regs`,
  ]);
  const pages = Math.max(1, Math.ceil(count / PER));
  const isAdmin = hasRole(user, "admin");
  return (
    <>
      <PageHeader title="Workshops" description={`${stats.total} workshop${stats.total === 1 ? "" : "s"} · ${stats.active} active · ${stats.regs.toLocaleString()} registrations`} actions={<Button href="/admin/registry/workshops/new" size="sm"><Plus className="h-4 w-4" /> New workshop</Button>} />
      <Panel padded={false}>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <SearchBox defaultValue={q} placeholder="Search title, slug or prefix…" />
          <ASelect name="status" defaultValue={status} className="w-auto">
            <option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option>
          </ASelect>
          <Button type="submit" variant="outline" size="sm">Filter</Button>
          {(q || status) && <Button href="/admin/registry/workshops" variant="ghost" size="sm">Reset</Button>}
        </form>
        <div className="p-5">
          <DataTable<Row>
            rows={rows.map((r) => ({ ...r }))}
            empty={<EmptyState icon={<Ticket className="h-7 w-7" />} title="No workshops found" description="Create a workshop to open registrations and issue certificates." action={<Button href="/admin/registry/workshops/new" size="sm"><Plus className="h-4 w-4" /> New workshop</Button>} />}
            columns={[
              { key: "title", header: "Workshop", render: (r) => <div><p className="font-semibold text-slate-900">{r.title}</p><p className="font-mono text-[11px] text-slate-500">{certificatePrefix(r)}XXXXXXXX · /register/{r.slug}</p></div> },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "starts_at", header: "Starts", hideBelow: "lg", render: (r) => <span className="text-slate-600">{r.starts_at ? formatDate(r.starts_at, { hour: "numeric", minute: "2-digit" }) : "—"}</span> },
              { key: "registrations", header: "Registrations", hideBelow: "md", render: (r) => <div className="text-sm"><span className="font-semibold text-slate-900">{r.registrations}</span>{r.seats ? <span className="text-slate-400">/{r.seats}</span> : null}<p className="text-[11px] text-slate-500">{r.attended} attended · {r.certificates} certified</p></div> },
              { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => <WorkshopRowActions id={r.id} title={r.title} status={r.status} isAdmin={isAdmin} /> },
            ]}
          />
          <Pagination page={page} pages={pages} baseHref={`/admin/registry/workshops${qs({ q, status, page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
