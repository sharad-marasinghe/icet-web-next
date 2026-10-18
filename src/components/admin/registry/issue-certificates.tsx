"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal, Toggle, useToast } from "@/components/admin/ui";
import { setWorkshopStatus } from "@/app/admin/(dashboard)/registry/workshops/actions";

type Student = { student_id: number; student_code: string; student_name: string; student_email: string; is_attended: boolean; certificate_code: string | null };
type Result = { student_id: number; ok: boolean; code?: string; emailed?: boolean; error?: string };

const CHUNK = 5;

export function IssueCertificatesButton({ workshopId, workshopTitle, status, variant = "outline", size = "sm", children }: { workshopId: number; workshopTitle: string; status: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}><Award className="h-4 w-4" /> {children ?? "Issue certificates"}</Button>
      {open && <IssueModal workshopId={workshopId} workshopTitle={workshopTitle} status={status} onClose={() => setOpen(false)} />}
    </>
  );
}

function IssueModal({ workshopId, workshopTitle, status, onClose }: { workshopId: number; workshopTitle: string; status: string; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [onlyAttended, setOnlyAttended] = React.useState(true);
  const [skipIssued, setSkipIssued] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [results, setResults] = React.useState<Result[]>([]);
  const [finished, setFinished] = React.useState(false);
  const [marking, setMarking] = React.useState(false);
  const abort = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    fetch(`/admin/api/registry/workshops/${workshopId}/attendance`, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Could not load enrolments"); return r.json(); })
      .then((d: { students: Student[] }) => { if (alive) setStudents(d.students); })
      .catch((e) => toast({ tone: "error", message: e instanceof Error ? e.message : "Failed to load" }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [workshopId, toast]);

  const attended = students.filter((s) => s.is_attended);
  const targets = students.filter((s) => (!onlyAttended || s.is_attended) && (!skipIssued || !s.certificate_code));

  const run = async () => {
    setRunning(true); setFinished(false); setResults([]); setDone(0); abort.current = false;
    const ids = targets.map((s) => s.student_id);
    const all: Result[] = [];
    for (let i = 0; i < ids.length && !abort.current; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        const res = await fetch("/admin/api/registry/issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workshop_id: workshopId, student_ids: chunk, require_attendance: onlyAttended }) });
        const data = (await res.json()) as { results?: Result[]; error?: string };
        if (!res.ok || !data.results) throw new Error(data.error || `Request failed (${res.status})`);
        all.push(...data.results);
      } catch (e) {
        all.push(...chunk.map((id) => ({ student_id: id, ok: false, error: e instanceof Error ? e.message : "Request failed" })));
      }
      setResults([...all]);
      setDone(Math.min(ids.length, i + CHUNK));
    }
    setRunning(false); setFinished(true);
    router.refresh();
  };

  const nameOf = (id: number) => students.find((s) => s.student_id === id)?.student_name || `#${id}`;
  const okCount = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok);
  const notEmailed = results.filter((r) => r.ok && r.emailed === false);
  const pct = targets.length ? Math.round((done / targets.length) * 100) : 0;

  const markCompleted = async () => {
    setMarking(true);
    try {
      const r = await setWorkshopStatus(workshopId, "completed");
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" });
      if (r?.ok) { router.refresh(); onClose(); }
    } finally { setMarking(false); }
  };

  return (
    <Modal open onClose={() => { abort.current = true; onClose(); }} title={<span>Issue certificates <span className="text-slate-400">· {workshopTitle}</span></span>} footer={
      <>
        {finished && status !== "completed" && <Button type="button" variant="secondary" size="sm" loading={marking} onClick={markCompleted}>Mark workshop completed</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={() => { abort.current = true; onClose(); }}>{running ? "Stop & close" : "Close"}</Button>
        {!finished && <Button type="button" size="sm" onClick={run} disabled={loading || running || targets.length === 0} loading={running}>Issue {targets.length} certificate{targets.length === 1 ? "" : "s"}</Button>}
      </>
    }>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading enrolments…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Enrolled" value={students.length} />
            <Stat label="Attended" value={attended.length} tone="green" />
            <Stat label="Already issued" value={students.filter((s) => s.certificate_code).length} tone="slate" />
          </div>
          {!running && !finished && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <Toggle checked={onlyAttended} onChange={setOnlyAttended} label="Only students marked as attended" description="Recommended. Unticking issues certificates to every enrolled student." />
              <Toggle checked={skipIssued} onChange={setSkipIssued} label="Skip students who already have a certificate" description="When off, existing certificates are regenerated and the email re-sent." />
              <p className="text-xs text-slate-500">{targets.length} student{targets.length === 1 ? "" : "s"} will be processed in batches of {CHUNK}. Each receives the PDF by email.</p>
            </div>
          )}
          {(running || finished) && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600"><span>{running ? "Issuing…" : "Finished"}</span><span>{done}/{targets.length} · {pct}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> {okCount} issued</span>
                {notEmailed.length > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4" /> {notEmailed.length} issued but email failed</span>}
                {failures.length > 0 && <span className="inline-flex items-center gap-1 text-rose-700"><AlertTriangle className="h-4 w-4" /> {failures.length} failed</span>}
              </div>
              {(failures.length > 0 || notEmailed.length > 0) && (
                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50/50 p-2 text-xs">
                  {failures.map((f) => <li key={f.student_id}><strong>{nameOf(f.student_id)}</strong>: {f.error || "Unknown error"}</li>)}
                  {notEmailed.map((f) => <li key={`e${f.student_id}`} className="text-amber-800"><strong>{nameOf(f.student_id)}</strong> ({f.code}): certificate created but the email failed{f.error ? ` — ${f.error}` : ""}.</li>)}
                </ul>
              )}
            </div>
          )}
          {!running && !finished && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Certificate</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.student_id} className={targets.includes(s) ? "" : "opacity-40"}>
                      <td className="px-3 py-1.5"><p className="font-semibold text-slate-900">{s.student_name}</p><p className="text-slate-500">{s.student_email}</p></td>
                      <td className="px-3 py-1.5">{s.is_attended ? <span className="font-semibold text-green-700">Attended</span> : <span className="text-slate-400">Not attended</span>}</td>
                      <td className="px-3 py-1.5 font-mono">{s.certificate_code || <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                  {students.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">Nobody is enrolled in this workshop yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone = "brand" }: { label: string; value: number; tone?: "brand" | "green" | "slate" }) {
  const cls = { brand: "bg-brand-50 text-brand-700", green: "bg-green-50 text-green-700", slate: "bg-slate-100 text-slate-700" }[tone];
  return <div className={`rounded-xl p-3 ${cls}`}><p className="font-display text-2xl font-extrabold">{value}</p><p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p></div>;
}
