"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Award, Send, Unlink, Trash2, Plus, Check, X, Loader2, UserPlus, FileDown, FileText } from "lucide-react";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, AInput, ASelect, AField, SubmitButton, ActionToast, initialActionState, StatusBadge, useToast, ConfirmButton, type ActionState } from "@/components/admin/ui";
import { sourceLabel, STANDARD_FIELDS } from "@/lib/registry/fields";
import type { StudentRow } from "@/app/admin/(dashboard)/registry/students/query";
import { toggleAttendance, addStudent, editStudent, issueSingleCertificate, resendCertificateEmail, unassignWorkshop, deleteStudent, getStudentDetails, type StudentDetails } from "@/app/admin/(dashboard)/registry/students/actions";

export type Option = { id: number; label: string };

export function StudentsTable({ rows, workshops, batches, isAdmin }: { rows: StudentRow[]; workshops: Option[]; batches: Option[]; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [details, setDetails] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<StudentRow | null>(null);
  const [busy, setBusy] = React.useState<string>("");

  const run = async (key: string, fn: () => Promise<ActionState>) => {
    setBusy(key);
    try {
      const r = await fn();
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", message: e instanceof Error ? e.message : "Action failed" });
    } finally { setBusy(""); }
  };

  if (!rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">No students match these filters.</div>;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Name</th><th className="hidden px-4 py-3 md:table-cell">Email</th><th className="hidden px-4 py-3 lg:table-cell">Primary batch</th>
              <th className="px-4 py-3">Workshops & attendance</th><th className="hidden px-4 py-3 xl:table-cell">Sources</th><th className="hidden px-4 py-3 lg:table-cell">Registered</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((s) => (
              <tr key={s.id} className="align-top hover:bg-brand-50/30">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.student_id}</td>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{s.student_name}</p>{s.student_phone && <p className="text-xs text-slate-500">{s.student_phone}</p>}</td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{s.student_email.endsWith("@applications.invalid") ? <span className="text-slate-400">not collected</span> : s.student_email}</td>
                <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{s.batch_name || "—"}</td>
                <td className="px-4 py-3">
                  {s.enrollments.length === 0 ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Not enrolled</span> : (
                    <ul className="space-y-1.5">
                      {s.enrollments.map((e) => {
                        const key = `${s.id}:${e.workshop_id}`;
                        return (
                          <li key={e.workshop_id} className="flex flex-wrap items-center gap-1.5">
                            <button type="button" disabled={busy === `att${key}`} onClick={() => run(`att${key}`, () => toggleAttendance(s.id, e.workshop_id, !e.is_attended))} title={e.is_attended ? "Mark as not attended" : "Mark as attended"}
                              className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset transition", e.is_attended ? "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100" : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100")}>
                              {busy === `att${key}` ? <Loader2 className="h-3 w-3 animate-spin" /> : e.is_attended ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{e.is_attended ? "Attended" : "Absent"}
                            </button>
                            <span className="max-w-[180px] truncate text-xs font-medium text-slate-800" title={e.title}>{e.title}</span>
                            {e.certificate_code ? <span className="font-mono text-[10.5px] text-brand-700" title={e.email_sent_status ? "Certificate email sent" : "Certificate email not sent"}>{e.certificate_code}{e.email_sent_status ? " ✓" : ""}</span> : null}
                            <span className="inline-flex gap-0.5">
                              {!e.certificate_code && <IconBtn title={e.is_attended ? "Issue certificate" : "Mark attendance before issuing"} disabled={!e.is_attended || busy === `iss${key}`} onClick={() => run(`iss${key}`, () => issueSingleCertificate(s.id, e.workshop_id))}><Award className="h-3.5 w-3.5" /></IconBtn>}
                              {e.certificate_code && <IconBtn title="Resend certificate email" disabled={busy === `rs${key}`} onClick={() => run(`rs${key}`, () => resendCertificateEmail(s.id, e.workshop_id))}><Send className="h-3.5 w-3.5" /></IconBtn>}
                              <IconBtn title="Unassign workshop" tone="danger" disabled={busy === `un${key}`} onClick={() => { if (confirm(`Remove ${s.student_name} from "${e.title}"?`)) run(`un${key}`, () => unassignWorkshop(s.id, e.workshop_id)); }}><Unlink className="h-3.5 w-3.5" /></IconBtn>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </td>
                <td className="hidden px-4 py-3 xl:table-cell">
                  <div className="flex flex-wrap gap-1">{[...new Set(s.enrollments.map((e) => e.registration_source))].map((src) => <span key={src} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{sourceLabel(src)}</span>)}</div>
                </td>
                <td className="hidden px-4 py-3 text-xs text-slate-600 lg:table-cell">{formatDateTime(s.registered_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setDetails(s.id)}><Eye className="h-3.5 w-3.5" /> Details</Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    {isAdmin && <ConfirmButton variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50" message={`Delete ${s.student_name} (${s.student_id})? Enrolments, attendance, certificates and applications of this student are removed.`} onConfirm={() => run(`del${s.id}`, () => deleteStudent(s.id))}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {details !== null && <DetailsModal studentPk={details} onClose={() => setDetails(null)} />}
      {editing && <EditStudentModal key={editing.id} student={editing} workshops={workshops} batches={batches} onClose={() => setEditing(null)} />}
    </>
  );
}

function IconBtn({ children, title, onClick, disabled, tone }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={cn("grid h-6 w-6 place-items-center rounded-md text-slate-500 disabled:opacity-30", tone === "danger" ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-brand-50 hover:text-brand-700")}>{children}</button>;
}

/* ───────────── Details modal ───────────── */
function DetailsModal({ studentPk, onClose }: { studentPk: number; onClose: () => void }) {
  const [data, setData] = React.useState<StudentDetails | null | undefined>(undefined);
  React.useEffect(() => { getStudentDetails(studentPk).then(setData).catch(() => setData(null)); }, [studentPk]);
  const s = data?.student;
  return (
    <Modal open onClose={onClose} title={s ? <span>{s.student_name} <span className="font-mono text-sm text-slate-400">{s.student_id}</span></span> : "Student details"} wide>
      {data === undefined ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : !data || !s ? <p className="text-sm text-rose-600">Student not found.</p> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Identity</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {[["Student ID", s.student_id], ["Name", s.student_name], ["Email", s.student_email], ["Phone", s.student_phone || "—"], ["Primary batch", s.batch_name || "—"], ["Registered", formatDateTime(s.registered_at)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd></div>
              ))}
            </dl>
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Additional fields</h3>
            {Object.keys(s.extra_fields || {}).length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : (
              <table className="w-full rounded-xl border border-slate-200 text-sm"><tbody className="divide-y divide-slate-100">
                {Object.entries(s.extra_fields).map(([k, v]) => <tr key={k}><td className="px-3 py-2 text-slate-500">{STANDARD_FIELDS[k] || k}</td><td className="px-3 py-2 font-medium text-slate-900">{String(v)}</td></tr>)}
              </tbody></table>
            )}
          </section>
          <section className="space-y-5">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Workshop enrolments</h3>
              {data.enrollments.length === 0 ? <p className="text-sm text-slate-500">Not enrolled in any workshop.</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {data.enrollments.map((e) => (
                    <li key={e.workshop_id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{e.title}</span><StatusBadge value={e.is_attended ? "attended" : "absent"} map={{ attended: "green", absent: "slate" }} /></div>
                      <p className="mt-0.5 text-xs text-slate-500">Enrolled {formatDate(e.enrolled_at)} · Source {sourceLabel(e.registration_source)}{e.registration_campaign ? ` · ${e.registration_campaign}` : ""}</p>
                      <p className="text-xs text-slate-600">Certificate: {e.certificate_code ? <span className="font-mono text-brand-700">{e.certificate_code}</span> : "not issued"} · Email: {e.email_sent_status ? <span className="text-green-700">sent</span> : "not sent"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Certificates</h3>
              {data.certificates.length === 0 ? <p className="text-sm text-slate-500">No certificates.</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {data.certificates.map((c) => (
                    <li key={c.certificate_id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div><p className="font-mono text-xs font-semibold text-slate-900">{c.certificate_id}</p><p className="text-xs text-slate-500">{c.course_name} · {formatDate(c.issue_date)}</p></div>
                      <div className="flex items-center gap-2"><StatusBadge value={c.is_suspended ? "suspended" : c.status} />{c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="text-brand-700" title="Open PDF"><FileDown className="h-4 w-4" /></a>}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Applications</h3>
              {data.applications.length === 0 ? <p className="text-sm text-slate-500">No applications.</p> : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {data.applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div><a href={`/admin/registry/applications/${a.id}`} className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand-700 hover:underline"><FileText className="h-3.5 w-3.5" />{a.reference_no}</a><p className="text-xs text-slate-500">{a.batch_name} · {formatDate(a.submitted_at)}</p></div>
                      <StatusBadge value={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

/* ───────────── Extra fields editor ───────────── */
function ExtraFieldsEditor({ initial }: { initial: Record<string, string> }) {
  const [pairs, setPairs] = React.useState<{ k: string; v: string }[]>(() => Object.entries(initial || {}).map(([k, v]) => ({ k, v: String(v) })));
  const json = React.useMemo(() => { const o: Record<string, string> = {}; for (const p of pairs) if (p.k.trim()) o[p.k.trim()] = p.v; return JSON.stringify(o); }, [pairs]);
  const set = (i: number, patch: Partial<{ k: string; v: string }>) => setPairs((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div>
      <input type="hidden" name="extra_fields" value={json} />
      <div className="space-y-1.5">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <AInput list="extra-keys" value={p.k} onChange={(e) => set(i, { k: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="key" className="h-9 w-40 font-mono text-xs" />
            <AInput value={p.v} onChange={(e) => set(i, { v: e.target.value })} placeholder="value" className="h-9" />
            <button type="button" onClick={() => setPairs((l) => l.filter((_, j) => j !== i))} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <datalist id="extra-keys">{Object.keys(STANDARD_FIELDS).filter((k) => !["student_name", "student_email", "student_id", "student_phone"].includes(k)).map((k) => <option key={k} value={k}>{STANDARD_FIELDS[k]}</option>)}</datalist>
      <button type="button" onClick={() => setPairs((l) => [...l, { k: "", v: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Plus className="h-3.5 w-3.5" /> Add field</button>
    </div>
  );
}

function WorkshopMultiSelect({ workshops, selected }: { workshops: Option[]; selected: number[] }) {
  const [sel, setSel] = React.useState<number[]>(selected);
  return (
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
      {workshops.length === 0 && <p className="text-xs text-slate-500">No workshops exist yet.</p>}
      {workshops.map((w) => (
        <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
          <input type="checkbox" name="workshop_ids" value={w.id} checked={sel.includes(w.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, w.id] : s.filter((x) => x !== w.id)))} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          <span className="truncate">{w.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ───────────── Edit modal ───────────── */
function EditStudentModal({ student, workshops, batches, onClose }: { student: StudentRow; workshops: Option[]; batches: Option[]; onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(editStudent, initialActionState);
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  const errors = state?.errors || {};
  return (
    <Modal open onClose={onClose} title={`Edit ${student.student_name}`}>
      <form action={action} className="space-y-4">
        <ActionToast state={state} />
        <input type="hidden" name="id" value={student.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AField label="Student ID" required error={errors.student_id}><AInput name="student_id" defaultValue={student.student_id} className="font-mono" /></AField>
          <AField label="Primary batch" error={errors.batch_id}><ASelect name="batch_id" defaultValue={student.batch_id ?? ""}><option value="">— None —</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</ASelect></AField>
          <AField label="Full name" required error={errors.student_name}><AInput name="student_name" defaultValue={student.student_name} required /></AField>
          <AField label="Email" required error={errors.student_email}><AInput name="student_email" type="email" defaultValue={student.student_email} required /></AField>
          <AField label="Phone" error={errors.student_phone}><AInput name="student_phone" defaultValue={student.student_phone || ""} /></AField>
        </div>
        <AField label="Workshops" hint="Deselecting removes the enrolment and attendance record."><WorkshopMultiSelect workshops={workshops} selected={student.enrollments.map((e) => e.workshop_id)} /></AField>
        <AField label="Additional fields"><ExtraFieldsEditor initial={student.extra_fields || {}} /></AField>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm">Save changes</SubmitButton></div>
      </form>
    </Modal>
  );
}

/* ───────────── Add student ───────────── */
export function AddStudentButton({ workshops, batches }: { workshops: Option[]; batches: Option[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add new student</Button>
      {open && <AddStudentModal workshops={workshops} batches={batches} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddStudentModal({ workshops, batches, onClose }: { workshops: Option[]; batches: Option[]; onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(addStudent, initialActionState);
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  const errors = state?.errors || {};
  return (
    <Modal open onClose={onClose} title="Add new student">
      <form action={action} className="space-y-4">
        <ActionToast state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AField label="Student ID" hint="Leave blank to generate ICET-REG-XXXXXXXX" error={errors.student_id}><AInput name="student_id" className="font-mono" placeholder="auto" /></AField>
          <AField label="Primary batch" error={errors.batch_id}><ASelect name="batch_id" defaultValue=""><option value="">— None —</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</ASelect></AField>
          <AField label="Full name" required error={errors.student_name}><AInput name="student_name" required /></AField>
          <AField label="Email" required error={errors.student_email}><AInput name="student_email" type="email" required /></AField>
          <AField label="Phone" error={errors.student_phone}><AInput name="student_phone" placeholder="+94 7X XXX XXXX" /></AField>
        </div>
        <AField label="Enrol in workshops"><WorkshopMultiSelect workshops={workshops} selected={[]} /></AField>
        <AField label="Additional fields"><ExtraFieldsEditor initial={{}} /></AField>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm" pendingText="Adding…">Add student</SubmitButton></div>
      </form>
    </Modal>
  );
}
