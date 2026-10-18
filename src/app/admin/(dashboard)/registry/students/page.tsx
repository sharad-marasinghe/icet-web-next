import { Download, Filter } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Pagination, SearchBox, AInput, ASelect } from "@/components/admin/ui";
import { StudentsTable, AddStudentButton } from "@/components/admin/registry/students-table";
import { SOCIAL_SOURCES, STANDARD_FIELDS, normalizeSource, sourceLabel } from "@/lib/registry/fields";
import { spInt, qs, type AdminPageProps } from "@/components/admin/registry/shared";
import { readStudentFilters, listStudents, availableExtraKeys, isFiltered } from "./query";

const PER = 20;

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function StudentsPage({ searchParams }: AdminPageProps) {
  await connection();
  const spv = await searchParams;
  const f = readStudentFilters(spv);
  const page = Math.max(1, spInt(spv.page, 1));
  const user = await getCurrentUser();
  const wsId = f.workshop && f.workshop !== "unassigned" ? parseInt(f.workshop, 10) : 0;
  const [{ rows, total }, workshops, batches, extraKeys, sourceRows, [{ all }]] = await Promise.all([
    listStudents(f, page, PER),
    sql<{ id: number; title: string }[]>`select id, title from public.reg_workshops order by title asc`,
    sql<{ id: number; batch_name: string }[]>`select id, batch_name from public.reg_batches order by batch_name asc`,
    availableExtraKeys(),
    wsId
      ? sql<{ source: string }[]>`select distinct coalesce(nullif(registration_source, ''), 'direct') as source from public.reg_enrollments where workshop_id = ${wsId} order by 1`
      : sql<{ source: string }[]>`select distinct coalesce(nullif(registration_source, ''), 'direct') as source from public.reg_enrollments order by 1`,
    sql<{ all: number }[]>`select count(*)::int as all from public.reg_students`,
  ]);
  const sources = new Map<string, string>();
  for (const s of [...Object.keys(SOCIAL_SOURCES), "direct", ...sourceRows.map((r) => r.source)]) { const n = normalizeSource(s); sources.set(n, sourceLabel(n)); }
  const fieldOptions = new Map<string, string>(Object.entries(STANDARD_FIELDS).filter(([k]) => !["student_name", "student_email", "student_id", "student_phone"].includes(k)));
  for (const k of extraKeys) if (!fieldOptions.has(k)) fieldOptions.set(k, k);
  const filterQs = { q: f.q, workshop_id: f.workshop, batch_id: f.batch || "", attendance: f.attendance, source: f.source, date_from: f.from, date_to: f.to, extra_key: f.extraKey, extra_val: f.extraVal };
  const wsOptions = workshops.map((w) => ({ id: w.id, label: w.title }));
  const btOptions = batches.map((b) => ({ id: b.id, label: b.batch_name }));
  const filtered = isFiltered(f);

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-3">Students directory <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700 ring-1 ring-inset ring-brand-200">{all.toLocaleString()}</span></span>}
        description="Everyone who registered for a workshop or applied to a batch."
        actions={<>
          <AddStudentButton workshops={wsOptions} batches={btOptions} />
          <Button href={`/admin/api/registry/students.csv${qs(filterQs)}`} external variant="outline" size="sm"><Download className="h-4 w-4" /> Export CSV</Button>
          <Button href={`/admin/api/registry/students.csv${qs({ ...filterQs, attendance: "attended" })}`} external variant="outline" size="sm"><Download className="h-4 w-4" /> Export CSV (attended only)</Button>
        </>}
      />
      <Panel padded={false}>
        <form className="space-y-3 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox defaultValue={f.q} placeholder="Search ID, name, email, phone…" />
            <ASelect name="workshop_id" defaultValue={f.workshop} className="w-auto max-w-[240px]">
              <option value="">— All workshops —</option>
              <option value="unassigned">⚠ Not enrolled in any workshop</option>
              {workshops.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
            </ASelect>
            <ASelect name="batch_id" defaultValue={f.batch || ""} className="w-auto max-w-[200px]">
              <option value="">— All batches —</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
            </ASelect>
            <ASelect name="attendance" defaultValue={f.attendance} className="w-auto">
              <option value="">— Attendance —</option><option value="attended">Attended only</option><option value="not_attended">Not attended only</option>
            </ASelect>
            <ASelect name="source" defaultValue={f.source} className="w-auto">
              <option value="">— All sources —</option>
              {[...sources.entries()].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </ASelect>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-600">Registered</span>
              <AInput type="date" name="date_from" defaultValue={f.from} className="h-8 w-auto text-xs" /><span className="text-xs text-slate-400">to</span><AInput type="date" name="date_to" defaultValue={f.to} className="h-8 w-auto text-xs" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <ASelect name="extra_key" defaultValue={f.extraKey} className="h-8 w-auto text-xs">
                <option value="">— Any additional field —</option>
                {[...fieldOptions.entries()].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </ASelect>
              <AInput name="extra_val" defaultValue={f.extraVal} placeholder="Field value contains…" className="h-8 w-44 text-xs" />
            </div>
            <Button type="submit" size="sm"><Filter className="h-4 w-4" /> Filter</Button>
            {filtered && <Button href="/admin/registry/students" variant="ghost" size="sm">Reset</Button>}
            {filtered && <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">Filtered students: {total.toLocaleString()}</span>}
          </div>
        </form>
        <div className="p-5">
          <StudentsTable rows={rows} workshops={wsOptions} batches={btOptions} isAdmin={hasRole(user, "admin")} />
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} baseHref={`/admin/registry/students${qs({ ...filterQs, page: "__PAGE__" })}`} />
        </div>
      </Panel>
    </>
  );
}
