import type { Metadata } from "next";
import { connection } from "next/server";
import { Inbox, PhoneCall, Trophy, CalendarDays, Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader, Panel, StatCard, Pagination, AInput, ASelect, SearchBox } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { INQUIRY_STATUSES, INQUIRY_TYPES, parseInquiryFilters, inquiryWhere, filtersToQuery, type InquiryListRow } from "@/components/admin/inquiries/query";
import { InquiriesTable } from "@/components/admin/inquiries/table";

export const metadata: Metadata = { title: "Inquiries" };
const PER = 25;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireUser("viewer");
  const sp = await searchParams;
  const f = parseInquiryFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = inquiryWhere(f, me.id);
  const [rows, [{ count }], [stats], staff, programs] = await Promise.all([
    sql<InquiryListRow[]>`select i.id, i.type, i.name, i.email, i.phone, i.whatsapp, i.program_code, i.intake, i.status, i.assigned_to, p.full_name as assigned_name, i.created_at::text, i.page_path
      from public.inquiries i left join public.profiles p on p.id = i.assigned_to ${where} order by i.created_at desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.inquiries i ${where}`,
    sql<{ new_count: number; contacted_month: number; converted_month: number; received_month: number }[]>`
      select (select count(*) from public.inquiries where status = 'new')::int as new_count,
             (select count(*) from public.inquiries where status in ('contacted','qualified') and updated_at >= date_trunc('month', now()))::int as contacted_month,
             (select count(*) from public.inquiries where status = 'converted' and updated_at >= date_trunc('month', now()))::int as converted_month,
             (select count(*) from public.inquiries where created_at >= date_trunc('month', now()))::int as received_month`,
    sql<{ id: string; full_name: string; email: string }[]>`select id, full_name, email from public.profiles where is_active order by full_name, email`,
    sql<{ program_code: string }[]>`select distinct program_code from public.inquiries where program_code is not null and program_code <> '' order by 1`,
  ]);
  const pages = Math.max(1, Math.ceil(count / PER));
  const filtered = Object.values(f).some(Boolean);
  const exportHref = `/admin/api/system/inquiries.csv?${filtersToQuery(f)}`;

  return (
    <>
      <PageHeader title="Inquiries" description="Every enquiry, call-back and brochure request from the website, with follow-up tracking." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Inquiries" }]}
        actions={<a href={exportHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:border-brand-600 hover:text-brand-700"><Download className="h-4 w-4" /> Export CSV</a>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New" value={stats.new_count} hint="Awaiting first contact" icon={<Inbox className="h-5 w-5" />} href="/admin/inquiries?status=new" />
        <StatCard label="Contacted this month" value={stats.contacted_month} hint="Contacted or qualified" icon={<PhoneCall className="h-5 w-5" />} tone="amber" href={`/admin/inquiries?status=contacted&from=${new Date().toISOString().slice(0, 8)}01`} />
        <StatCard label="Converted this month" value={stats.converted_month} hint="Enrolled students" icon={<Trophy className="h-5 w-5" />} tone="green" href={`/admin/inquiries?status=converted&from=${new Date().toISOString().slice(0, 8)}01`} />
        <StatCard label="Received this month" value={stats.received_month} hint="All types" icon={<CalendarDays className="h-5 w-5" />} tone="slate" href={`/admin/inquiries?from=${new Date().toISOString().slice(0, 8)}01`} />
      </div>
      <Panel className="mt-6" padded={false}>
        <form className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="xl:col-span-2"><SearchBox defaultValue={f.q} placeholder="Name, email or phone…" /></div>
          <ASelect name="status" defaultValue={f.status} aria-label="Status"><option value="">All statuses</option>{INQUIRY_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</ASelect>
          <ASelect name="type" defaultValue={f.type} aria-label="Type"><option value="">All types</option>{INQUIRY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</ASelect>
          <ASelect name="program" defaultValue={f.program} aria-label="Programme"><option value="">All programmes</option>{programs.map((p) => <option key={p.program_code} value={p.program_code}>{p.program_code}</option>)}</ASelect>
          <ASelect name="assigned" defaultValue={f.assigned} aria-label="Assigned to">
            <option value="">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
          </ASelect>
          <div className="flex gap-2">
            <AInput type="date" name="from" defaultValue={f.from} aria-label="From date" />
            <AInput type="date" name="to" defaultValue={f.to} aria-label="To date" />
          </div>
          <div className="flex gap-2 md:col-span-3 xl:col-span-7 xl:justify-end">
            <Button type="submit" size="sm" className="h-10">Apply filters</Button>
            {filtered && <Button href="/admin/inquiries" variant="ghost" size="sm" className="h-10">Clear</Button>}
          </div>
        </form>
        <div className="p-4">
          <InquiriesTable rows={rows.map((r) => ({ ...r }))} total={count} />
          <Pagination page={page} pages={pages} baseHref={`/admin/inquiries?${filtersToQuery(f, { page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
