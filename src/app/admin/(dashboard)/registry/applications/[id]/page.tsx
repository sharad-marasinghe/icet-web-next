import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Download, Mail, Phone, UserRound } from "lucide-react";
import { sql } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { sanitizeInline } from "@/lib/sanitize";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ApplicationReviewForm } from "@/components/admin/registry/application-review";
import { buildPages, normalizeIdentityFields, sanitizeForm, type FormFields } from "@/lib/registry/fields";
import type { AdminPageProps } from "@/components/admin/registry/shared";

type App = { id: number; batch_id: number; reference_no: string; status: string; answers_json: Record<string, string | string[]>; review_notes: string | null; reviewed_at: string | null; reviewer: string | null; submitted_at: string; form_version: number;
  student_pk: number; student_id: string; student_name: string; student_email: string; student_phone: string | null; batch_name: string; course_code: string; form_fields: FormFields };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function ApplicationDetailPage({ params }: AdminPageProps<{ id: string }>) {
  await connection();
  const { id } = await params;
  const appId = parseInt(id, 10);
  if (!Number.isFinite(appId)) notFound();
  const user = await getCurrentUser();
  const app = (await sql<App[]>`select a.id, a.batch_id, a.reference_no, a.status::text, a.answers_json, a.review_notes, a.reviewed_at::text, p.full_name as reviewer, a.submitted_at::text, a.form_version,
      s.id as student_pk, s.student_id, s.student_name, s.student_email, s.student_phone, b.batch_name, b.course_code, b.form_fields
    from public.reg_applications a join public.reg_students s on s.id = a.student_id join public.reg_batches b on b.id = a.batch_id left join public.profiles p on p.id = a.reviewed_by where a.id = ${appId}`)[0];
  if (!app) notFound();
  const files = await sql<{ id: number; field_key: string; original_name: string; mime_type: string; size_bytes: number }[]>`select id, field_key, original_name, mime_type, size_bytes from public.reg_application_files where application_id = ${appId} order by id`;
  const form = normalizeIdentityFields(sanitizeForm(app.form_fields, sanitizeInline));
  const pages = buildPages(form);
  const answers = app.answers_json || {};
  const known = new Set(Object.keys(form));
  const orphan = Object.entries(answers).filter(([k]) => !known.has(k));
  const render = (v: string | string[] | undefined) => (v === undefined || v === "" || (Array.isArray(v) && !v.length) ? <span className="text-slate-400">—</span> : Array.isArray(v) ? v.join(", ") : v);
  const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <>
      <PageHeader title={<span className="inline-flex items-center gap-3">{app.reference_no} <StatusBadge value={app.status} /></span>} breadcrumbs={[{ label: "Registry" }, { label: "Applications", href: `/admin/registry/applications?batch_id=${app.batch_id}` }, { label: app.reference_no }]} description={`${app.batch_name}${app.course_code ? ` (${app.course_code})` : ""} · submitted ${formatDateTime(app.submitted_at)} · form v${app.form_version}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {pages.map((p, i) => {
            const groups: { heading: { title: string; desc: string } | null; fields: typeof p.fields }[] = [{ heading: null, fields: [] }];
            for (const [k, c] of p.fields) {
              if (c.type === "heading") groups.push({ heading: { title: c.label, desc: c.help }, fields: [] });
              else groups[groups.length - 1].fields.push([k, c]);
            }
            return (
              <Panel key={i} title={p.title || (pages.length > 1 ? `Page ${i + 1}` : "Answers")} description={p.desc ? <span dangerouslySetInnerHTML={{ __html: p.desc }} /> : undefined}>
                {groups.filter((g) => g.heading || g.fields.length).map((g, gi) => (
                  <div key={gi} className={gi > 0 ? "mt-5 border-t border-slate-100 pt-4" : ""}>
                    {g.heading && <h3 className="mb-2 text-sm font-bold text-slate-900">{g.heading.title}{g.heading.desc && <span className="ml-2 text-xs font-normal text-slate-500" dangerouslySetInnerHTML={{ __html: g.heading.desc }} />}</h3>}
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                      {g.fields.map(([k, c]) => (
                        <div key={k} className={c.width === "half" ? "" : "sm:col-span-2"}>
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.label}</dt>
                          <dd className="mt-0.5 text-sm text-slate-900">
                            {c.type === "file" ? (() => { const fl = files.filter((x) => x.field_key === k); return fl.length ? fl.map((x) => <a key={x.id} href={`/admin/api/registry/application-file/${x.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><Download className="h-3.5 w-3.5" /> {x.original_name} <span className="text-xs font-normal text-slate-400">({fmtSize(x.size_bytes)})</span></a>) : render(undefined); })() : render(answers[k])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </Panel>
            );
          })}
          {orphan.length > 0 && (
            <Panel title="Answers from a previous form version" description="These questions are no longer part of the form.">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{orphan.map(([k, v]) => <div key={k}><dt className="font-mono text-xs text-slate-500">{k}</dt><dd className="text-sm text-slate-900">{render(v)}</dd></div>)}</dl>
            </Panel>
          )}
          <Panel title="Documents" description={files.length ? `${files.length} file${files.length === 1 ? "" : "s"} stored privately` : "No documents uploaded"}>
            {files.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {files.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div><p className="font-semibold text-slate-900">{x.original_name}</p><p className="text-xs text-slate-500">{form[x.field_key]?.label || x.field_key} · {x.mime_type} · {fmtSize(x.size_bytes)}</p></div>
                    <a href={`/admin/api/registry/application-file/${x.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700"><Download className="h-3.5 w-3.5" /> Download</a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Panel title="Applicant">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-900">{app.student_name}</p>
                <p className="font-mono text-xs text-slate-500">{app.student_id}</p>
                {!app.student_email.endsWith("@applications.invalid") && <a href={`mailto:${app.student_email}`} className="mt-1 flex items-center gap-1.5 text-slate-700 hover:text-brand-700"><Mail className="h-3.5 w-3.5" /> {app.student_email}</a>}
                {app.student_phone && <a href={`tel:${app.student_phone}`} className="flex items-center gap-1.5 text-slate-700 hover:text-brand-700"><Phone className="h-3.5 w-3.5" /> {app.student_phone}</a>}
                <Link href={`/admin/registry/students?q=${encodeURIComponent(app.student_id)}`} className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">Open in students directory</Link>
              </div>
            </div>
          </Panel>
          <Panel title="Review" description={app.reviewed_at ? `Last reviewed ${formatDateTime(app.reviewed_at)}${app.reviewer ? ` by ${app.reviewer}` : ""}` : "Not reviewed yet"}>
            <ApplicationReviewForm id={app.id} status={app.status} notes={app.review_notes || ""} isAdmin={hasRole(user, "admin")} batchId={app.batch_id} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
