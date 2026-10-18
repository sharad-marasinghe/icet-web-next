import Link from "next/link";
import { connection } from "next/server";
import { Award, Ban, Filter, ArrowUpDown } from "lucide-react";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, DataTable, Pagination, SearchBox, ASelect, StatusBadge, EmptyState } from "@/components/admin/ui";
import { CertificateRowActions, ManualIssueButton, VerifyLink } from "@/components/admin/registry/certificate-actions";
import { sp, spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";

type Row = { id: number; certificate_id: string; course_name: string; issue_date: string; status: string; is_suspended: boolean; suspension_reason: string | null; pdf_url: string | null; workshop_id: number | null; student_id: string; student_name: string; student_email: string; workshop_title: string | null };
const PER = 20;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function CertificatesPage({ searchParams }: AdminPageProps) {
  await connection();
  const spv = await searchParams;
  const q = sp(spv.q).trim();
  const workshop = parseInt(sp(spv.workshop_id), 10) || 0;
  const status = ["active", "suspended"].includes(sp(spv.status)) ? sp(spv.status) : "";
  const sort = sp(spv.sort) === "code" ? "code" : "date";
  const dir = sp(spv.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, spInt(spv.page, 1));
  const user = await getCurrentUser();
  const like = "%" + q.replace(/[%_\\]/g, (m) => "\\" + m) + "%";
  const where = sql`where true
    ${workshop ? sql`and c.workshop_id = ${workshop}` : sql``}
    ${status === "active" ? sql`and not c.is_suspended and c.status = 'valid'` : status === "suspended" ? sql`and c.is_suspended` : sql``}
    ${q ? sql`and (c.certificate_id ilike ${like} or s.student_name ilike ${like} or s.student_email ilike ${like} or s.student_id ilike ${like})` : sql``}`;
  const order = sort === "code" ? (dir === "asc" ? sql`order by c.certificate_id asc` : sql`order by c.certificate_id desc`) : dir === "asc" ? sql`order by c.issue_date asc, c.id asc` : sql`order by c.issue_date desc, c.id desc`;
  const [rows, [{ count }], [totals], workshops] = await Promise.all([
    sql<Row[]>`select c.id, c.certificate_id, c.course_name, c.issue_date::text, c.status::text, c.is_suspended, c.suspension_reason, c.pdf_url, c.workshop_id, s.student_id, s.student_name, s.student_email, w.title as workshop_title
      from public.reg_certificates c join public.reg_students s on s.id = c.student_id left join public.reg_workshops w on w.id = c.workshop_id ${where} ${order} limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.reg_certificates c join public.reg_students s on s.id = c.student_id ${where}`,
    sql<{ total: number; suspended: number; month: number; in_workshop: number }[]>`select (select count(*) from public.reg_certificates)::int as total, (select count(*) from public.reg_certificates where is_suspended)::int as suspended,
      (select count(*) from public.reg_certificates where created_at > now() - interval '30 days')::int as month, (select count(*) from public.reg_certificates where workshop_id = ${workshop || 0})::int as in_workshop`,
    sql<{ id: number; title: string }[]>`select id, title from public.reg_workshops order by title`,
  ]);
  const base = { q, workshop_id: workshop || "", status, sort, dir };
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const sortLink = (col: "date" | "code") => `/admin/registry/certificates${qs({ ...base, sort: col, dir: sort === col && dir === "desc" ? "asc" : "desc" })}`;
  const selectedWorkshop = workshops.find((w) => w.id === workshop);

  return (
    <>
      <PageHeader title="Certificates" description="Every certificate issued through workshops, with verification status." actions={<ManualIssueButton workshops={workshops.map((w) => ({ ...w }))} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total issued" value={totals.total.toLocaleString()} icon={<Award className="h-5 w-5" />} />
        <StatCard label="Last 30 days" value={totals.month.toLocaleString()} tone="green" />
        <StatCard label="Suspended" value={totals.suspended.toLocaleString()} tone={totals.suspended ? "rose" : "slate"} icon={<Ban className="h-5 w-5" />} />
        <StatCard label={selectedWorkshop ? "In selected workshop" : "Workshops"} value={selectedWorkshop ? totals.in_workshop.toLocaleString() : workshops.length} hint={selectedWorkshop ? selectedWorkshop.title : "Select a workshop to see its count"} tone="brand" />
      </div>
      <Panel padded={false}>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <SearchBox defaultValue={q} placeholder="Certificate code, name, email, student ID…" />
          <ASelect name="workshop_id" defaultValue={workshop || ""} className="w-auto max-w-[260px]"><option value="">— All workshops —</option>{workshops.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}</ASelect>
          <ASelect name="status" defaultValue={status} className="w-auto"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></ASelect>
          <input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} />
          <Button type="submit" size="sm" variant="outline"><Filter className="h-4 w-4" /> Filter</Button>
          {(q || workshop || status) && <Button href="/admin/registry/certificates" variant="ghost" size="sm">Reset</Button>}
          <span className="ml-auto text-xs text-slate-500">{count.toLocaleString()} result{count === 1 ? "" : "s"}</span>
        </form>
        <div className="p-5">
          <DataTable<Row>
            rows={rows.map((r) => ({ ...r }))}
            empty={<EmptyState icon={<Award className="h-7 w-7" />} title="No certificates found" description="Issue certificates from a workshop or use the manual issue button." />}
            columns={[
              { key: "certificate_id", header: <Link href={sortLink("code")} className="inline-flex items-center gap-1 hover:text-brand-700">Certificate <ArrowUpDown className="h-3 w-3" /></Link>, render: (r) => <div><p className="font-mono text-xs font-semibold text-slate-900">{r.certificate_id}</p><div className="mt-1"><VerifyLink url={`${siteUrl}/verify-certificate?id=${encodeURIComponent(r.certificate_id)}`} /></div></div> },
              { key: "student", header: "Student", render: (r) => <div><p className="font-semibold text-slate-900">{r.student_name}</p><p className="text-xs text-slate-500">{r.student_id} · {r.student_email}</p></div> },
              { key: "workshop", header: "Workshop", hideBelow: "md", render: (r) => <span className="text-slate-700">{r.workshop_title || r.course_name}</span> },
              { key: "issue_date", header: <Link href={sortLink("date")} className="inline-flex items-center gap-1 hover:text-brand-700">Issued <ArrowUpDown className="h-3 w-3" /></Link>, hideBelow: "lg", render: (r) => <span className="text-slate-600">{formatDate(r.issue_date)}</span> },
              { key: "status", header: "Status", render: (r) => <div><StatusBadge value={r.is_suspended ? "suspended" : r.status === "valid" ? "active" : r.status} />{r.is_suspended && r.suspension_reason && <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-500" title={r.suspension_reason}>{r.suspension_reason}</p>}</div> },
              { key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => <CertificateRowActions code={r.certificate_id} pdfUrl={r.pdf_url} suspended={r.is_suspended} isAdmin={hasRole(user, "admin")} hasWorkshop={!!r.workshop_id} /> },
            ]}
          />
          <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER))} baseHref={`/admin/registry/certificates${qs({ ...base, page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
