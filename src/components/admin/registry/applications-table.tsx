"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASelect, StatusBadge, useToast } from "@/components/admin/ui";
import { bulkSetApplicationStatus } from "@/app/admin/(dashboard)/registry/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "./shared";

export type ApplicationRow = { id: number; reference_no: string; status: string; submitted_at: string; student_id: string; student_name: string; student_email: string; student_phone: string | null; files: number; reviewed_at: string | null };

export function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = React.useState<number[]>([]);
  const [status, setStatus] = React.useState("under_review");
  const [busy, setBusy] = React.useState(false);
  const all = rows.length > 0 && sel.length === rows.length;
  const apply = async () => {
    if (!sel.length) return;
    if (!confirm(`Set ${sel.length} application${sel.length === 1 ? "" : "s"} to "${APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS]}"?`)) return;
    setBusy(true);
    try { const r = await bulkSetApplicationStatus(sel, status); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); setSel([]); router.refresh(); }
    finally { setBusy(false); }
  };
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">No applications match these filters.</div>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">{sel.length} selected</span>
        <ASelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto text-xs" disabled={!sel.length}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>Mark as {APPLICATION_STATUS_LABELS[s]}</option>)}
        </ASelect>
        <Button type="button" size="sm" variant="outline" disabled={!sel.length} loading={busy} onClick={apply}>Apply</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" checked={all} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} className="h-4 w-4 rounded border-slate-300 text-brand-600" aria-label="Select all" /></th>
              <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Applicant</th><th className="hidden px-4 py-3 md:table-cell">Contact</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 lg:table-cell">Submitted</th><th className="px-4 py-3 text-right">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-brand-50/30">
                <td className="px-4 py-3"><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} className="h-4 w-4 rounded border-slate-300 text-brand-600" aria-label={`Select ${r.reference_no}`} /></td>
                <td className="px-4 py-3"><Link href={`/admin/registry/applications/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">{r.reference_no}</Link></td>
                <td className="px-4 py-3"><Link href={`/admin/registry/applications/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{r.student_name}</Link><p className="font-mono text-[11px] text-slate-500">{r.student_id}</p></td>
                <td className="hidden px-4 py-3 text-xs text-slate-600 md:table-cell">{r.student_email}{r.student_phone && <><br />{r.student_phone}</>}</td>
                <td className="px-4 py-3"><StatusBadge value={r.status} />{r.reviewed_at && <p className="mt-0.5 text-[10.5px] text-slate-400">reviewed {formatDateTime(r.reviewed_at)}</p>}</td>
                <td className="hidden px-4 py-3 text-xs text-slate-600 lg:table-cell">{formatDateTime(r.submitted_at)}</td>
                <td className="px-4 py-3 text-right text-xs text-slate-600">{r.files || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
