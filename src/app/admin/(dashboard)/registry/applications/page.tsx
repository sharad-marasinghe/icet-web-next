import Link from "next/link";
import { connection } from "next/server";
import { Download, Filter, ClipboardList } from "lucide-react";
import { sql } from "@/lib/db";
import { cn } from "@/lib/utils";
import { sanitizeInline } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Pagination, SearchBox, AInput, ASelect, EmptyState } from "@/components/admin/ui";
import { ApplicationsTable, type ApplicationRow } from "@/components/admin/registry/applications-table";
import { normalizeIdentityFields, sanitizeForm, type FormFields } from "@/lib/registry/fields";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";
import { readApplicationFilters, applicationWhere } from "./query";

const PER = 25;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function ApplicationsPage({ searchParams }: AdminPageProps) {
  await connection();
  const spv = await searchParams;
  const f = readApplicationFilters(spv);
  const page = Math.max(1, spInt(spv.page, 1));
  const batches = await sql<{ id: number; batch_name: string; course_code: string; is_open: boolean; form_fields: FormFields; total: number }[]>`
    select b.id, b.batch_name, b.course_code, b.is_open, b.form_fields, (select count(*) from public.reg_applications a where a.batch_id = b.id)::int as total from public.reg_batches b order by b.is_open desc, b.created_at desc`;
  if (!f.batch && batches[0]) f.batch = batches[0].id;
  const batch = batches.find((b) => b.id === f.batch);

  if (!batch) {
    return (
      <>
        <PageHeader title="Applications" description="Review queue for academic intake applications." />
        <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No academic batches yet" description="Create a batch first; its applications will appear here." action={<Button href="/admin/registry/batches/new" size="sm">Create a batch</Button>} />
      </>
    );
  }

  const form = normalizeIdentityFields(sanitizeForm(batch.form_fields, sanitizeInline));
  const filterable = Object.entries(form).filter(([, c]) => c.enabled && c.filterable);
  const [rows, counts, values] = await Promise.all([
    sql<ApplicationRow[]>`select a.id, a.reference_no, a.status::text, a.submitted_at::text, a.reviewed_at::text, s.student_id, s.student_name, s.student_email, s.student_phone,
        (select count(*) from public.reg_application_files fl where fl.application_id = a.id)::int as files
      from public.reg_applications a join public.reg_students s on s.id = a.student_id ${applicationWhere(f)} order by a.submitted_at desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ status: string; n: number }[]>`select a.status::text, count(*)::int as n from public.reg_applications a join public.reg_students s on s.id = a.student_id ${applicationWhere(f, false)} group by a.status`,
    f.fieldKey ? sql<{ value_text: string; n: number }[]>`select value_text, count(*)::int as n from public.reg_application_answers where batch_id = ${f.batch} and field_key = ${f.fieldKey} and value_text is not null group by value_text order by n desc, value_text asc limit 200` : Promise.resolve([] as { value_text: string; n: number }[]),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const total = counts.reduce((a, c) => a + c.n, 0);
  const shown = f.status ? countOf(f.status) : total;
  const base = { batch_id: f.batch, q: f.q, date_from: f.from, date_to: f.to, field_key: f.fieldKey, field_val: f.fieldVal };

  return (
    <>
      <PageHeader title="Applications" description="Review queue for academic intake applications." actions={<Button href={`/admin/api/registry/applications.csv${qs({ ...base, status: f.status })}`} external variant="outline" size="sm"><Download className="h-4 w-4" /> Export CSV</Button>} />
      <Panel padded={false}>
        <form className="space-y-3 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">Intake
              <ASelect name="batch_id" defaultValue={f.batch} className="w-auto max-w-[280px]">{batches.map((b) => <option key={b.id} value={b.id}>{b.batch_name}{b.course_code ? ` (${b.course_code})` : ""} · {b.total}</option>)}</ASelect>
            </label>
            <SearchBox defaultValue={f.q} placeholder="Reference, name, email or student ID…" />
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-600">Submitted</span>
              <AInput type="date" name="date_from" defaultValue={f.from} className="h-8 w-auto text-xs" /><span className="text-xs text-slate-400">to</span><AInput type="date" name="date_to" defaultValue={f.to} className="h-8 w-auto text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-600">Answer</span>
              <ASelect name="field_key" defaultValue={f.fieldKey} className="h-8 w-auto text-xs">
                <option value="">— Filterable field —</option>
                {filterable.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </ASelect>
              <ASelect name="field_val" defaultValue={f.fieldVal} className="h-8 w-auto max-w-[220px] text-xs" disabled={!f.fieldKey}>
                <option value="">{f.fieldKey ? "— Any value —" : "Choose a field, then Filter"}</option>
                {values.map((v) => <option key={v.value_text} value={v.value_text}>{v.value_text} ({v.n})</option>)}
              </ASelect>
            </div>
            {f.status && <input type="hidden" name="status" value={f.status} />}
            <Button type="submit" size="sm"><Filter className="h-4 w-4" /> Filter</Button>
            {(f.q || f.from || f.to || f.fieldKey) && <Button href={`/admin/registry/applications?batch_id=${f.batch}`} variant="ghost" size="sm">Reset</Button>}
            {filterable.length === 0 && <span className="text-xs text-slate-500">Tip: mark questions as <em>filterable</em> in the batch form builder to filter by answer.</span>}
          </div>
        </form>
        <div className="scrollbar-none -mb-px flex gap-1 overflow-x-auto border-b border-slate-200 px-5" role="tablist">
          {[["", "All", total] as const, ...APPLICATION_STATUSES.map((s) => [s, APPLICATION_STATUS_LABELS[s], countOf(s)] as const)].map(([s, label, n]) => (
            <Link key={s} href={`/admin/registry/applications${qs({ ...base, status: s })}`} role="tab" aria-selected={f.status === s} className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition", f.status === s ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
              {label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{n}</span>
            </Link>
          ))}
        </div>
        <div className="p-5">
          <ApplicationsTable rows={rows.map((r) => ({ ...r }))} />
          <Pagination page={page} pages={Math.max(1, Math.ceil(shown / PER))} baseHref={`/admin/registry/applications${qs({ ...base, status: f.status, page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
