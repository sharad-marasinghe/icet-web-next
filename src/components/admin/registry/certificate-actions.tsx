"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileDown, RefreshCw, Send, Ban, RotateCcw, Award, Search, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, AInput, ATextarea, AField, ASelect, Toggle, useToast, type ActionState } from "@/components/admin/ui";
import { generateCertificatePdf, resendCertificate, suspendCertificate, reactivateCertificate, searchStudents, manualIssue, type StudentHit } from "@/app/admin/(dashboard)/registry/certificates/actions";
import { CopyButton } from "./copy-button";

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState("");
  const run = async (key: string, fn: () => Promise<ActionState>) => {
    setBusy(key);
    try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); router.refresh(); return r; }
    catch (e) { toast({ tone: "error", message: e instanceof Error ? e.message : "Action failed" }); return null; }
    finally { setBusy(""); }
  };
  return { run, busy };
}

export function CertificateRowActions({ code, pdfUrl, suspended, isAdmin, hasWorkshop }: { code: string; pdfUrl: string | null; suspended: boolean; isAdmin: boolean; hasWorkshop: boolean }) {
  const { run, busy } = useRun();
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {pdfUrl ? <Button href={pdfUrl} external variant="outline" size="sm" className="h-8 px-2.5 text-xs"><FileDown className="h-3.5 w-3.5" /> PDF</Button>
        : <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={!hasWorkshop || busy === "pdf"} loading={busy === "pdf"} onClick={() => run("pdf", () => generateCertificatePdf(code))}><RefreshCw className="h-3.5 w-3.5" /> Generate PDF</Button>}
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" disabled={suspended || !hasWorkshop || busy === "send"} loading={busy === "send"} onClick={() => run("send", () => resendCertificate(code))}><Send className="h-3.5 w-3.5" /> Resend</Button>
      {isAdmin && (suspended
        ? <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-green-700 hover:bg-green-50" loading={busy === "re"} onClick={() => run("re", () => reactivateCertificate(code))}><RotateCcw className="h-3.5 w-3.5" /> Reactivate</Button>
        : <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50" onClick={() => setSuspendOpen(true)}><Ban className="h-3.5 w-3.5" /> Suspend</Button>)}
      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title={`Suspend ${code}`} footer={<><Button type="button" variant="ghost" size="sm" onClick={() => setSuspendOpen(false)}>Cancel</Button><Button type="button" variant="danger" size="sm" disabled={!reason.trim()} loading={busy === "sus"} onClick={async () => { const r = await run("sus", () => suspendCertificate(code, reason)); if (r?.ok) setSuspendOpen(false); }}>Suspend certificate</Button></>}>
        <p className="mb-3 text-sm text-slate-600">The public verifier will report this certificate as suspended and show the reason below. You can reactivate it later.</p>
        <AField label="Reason" required><ATextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Issued in error / fee outstanding" maxLength={500} /></AField>
      </Modal>
    </div>
  );
}

export function VerifyLink({ url }: { url: string }) {
  return <CopyButton value={url} label="Copy verify link" size="xs" />;
}

export function ManualIssueButton({ workshops }: { workshops: { id: number; title: string }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}><Award className="h-4 w-4" /> Manually issue certificate</Button>
      {open && <ManualIssueModal workshops={workshops} onClose={() => setOpen(false)} />}
    </>
  );
}

function ManualIssueModal({ workshops, onClose }: { workshops: { id: number; title: string }[]; onClose: () => void }) {
  const { run, busy } = useRun();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<StudentHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [student, setStudent] = React.useState<StudentHit | null>(null);
  const [workshopId, setWorkshopId] = React.useState<number>(workshops[0]?.id || 0);
  const [bypass, setBypass] = React.useState(false);
  const [email, setEmail] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) { setHits([]); return; }
      setSearching(true);
      searchStudents(q).then(setHits).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const enrol = student?.workshops.find((w) => w.id === workshopId);
  return (
    <Modal open onClose={onClose} title="Manually issue certificate" footer={<><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button type="button" size="sm" disabled={!student || !workshopId || (!bypass && !enrol?.attended)} loading={busy === "issue"} onClick={async () => { if (!student) return; const r = await run("issue", () => manualIssue(student.id, workshopId, bypass, email)); if (r?.ok) onClose(); }}>Issue certificate</Button></>}>
      <div className="space-y-4">
        <AField label="Student" hint="Search by name, email or student ID">
          {student ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm"><div><p className="font-semibold text-slate-900">{student.student_name}</p><p className="text-xs text-slate-600">{student.student_id} · {student.student_email}</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setStudent(null)}>Change</Button></div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <AInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing…" className="pl-9" autoFocus />
              {(hits.length > 0 || searching) && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-elev">
                  {searching && <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</li>}
                  {hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setStudent(h); setHits([]); }} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-brand-50"><span className="font-semibold text-slate-900">{h.student_name}</span><span className="text-xs text-slate-500">{h.student_id} · {h.student_email}</span></button></li>)}
                </ul>
              )}
            </div>
          )}
        </AField>
        <AField label="Workshop">
          <ASelect value={workshopId} onChange={(e) => setWorkshopId(Number(e.target.value))}>{workshops.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}</ASelect>
        </AField>
        {student && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {enrol ? <>Enrolled · {enrol.attended ? <span className="font-semibold text-green-700">attended</span> : <span className="font-semibold text-amber-700">not marked as attended</span>}{enrol.certificate_code && <> · already has certificate <span className="font-mono">{enrol.certificate_code}</span> (it will be regenerated)</>}</> : <>Not enrolled in this workshop — the student will be enrolled now (source: admin).</>}
          </p>
        )}
        <Toggle checked={bypass} onChange={setBypass} label="Bypass attendance check" description="Marks the student as attended and issues regardless of the attendance record." />
        <Toggle checked={email} onChange={setEmail} label="Email the certificate to the student" />
      </div>
    </Modal>
  );
}

export function CertDate({ value }: { value: string }) {
  return <>{formatDate(value)}</>;
}
