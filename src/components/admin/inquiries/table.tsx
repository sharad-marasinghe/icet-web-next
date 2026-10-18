"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Phone, MessageCircle, Inbox, CheckSquare } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge, EmptyState, ASelect, useToast } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { InquiryListRow } from "./query";
import { waLink, telLink } from "./links";
import { bulkInquiryStatus } from "@/app/admin/(dashboard)/inquiries/actions";

const STATUSES = ["new", "contacted", "qualified", "converted", "closed", "spam"];
const TYPE_TONE: Record<string, string> = { apply: "brand", contact: "slate", callback: "amber", brochure: "green" };

export function InquiriesTable({ rows, total }: { rows: InquiryListRow[]; total: number }) {
  const [rawSel, setSel] = React.useState<Set<string>>(new Set());
  const [status, setStatus] = React.useState("contacted");
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  // Only ids present on the current page count as selected (rows change after refresh/pagination).
  const sel = React.useMemo(() => new Set(rows.filter((r) => rawSel.has(r.id)).map((r) => r.id)), [rows, rawSel]);
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function apply() {
    if (!sel.size) return;
    setBusy(true);
    try {
      const r = await bulkInquiryStatus(Array.from(sel), status);
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "" });
      if (r?.ok) { setSel(new Set()); router.refresh(); }
    } finally { setBusy(false); }
  }
  if (!rows.length) return <EmptyState icon={<Inbox className="h-7 w-7" />} title="No inquiries match" description="Try different filters, or wait for the next website enquiry." />;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{total.toLocaleString()} inquir{total === 1 ? "y" : "ies"}{sel.size ? ` · ${sel.size} selected` : ""}</p>
        <div className={sel.size ? "flex items-center gap-2" : "hidden"}>
          <ASelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40" aria-label="New status">{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</ASelect>
          <Button type="button" size="sm" loading={busy} onClick={apply}><CheckSquare className="h-4 w-4" /> Set status for {sel.size}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 rounded border-slate-300" /></th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="hidden px-4 py-3 sm:table-cell">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 lg:table-cell">Assigned</th>
              <th className="hidden px-4 py-3 md:table-cell">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r) => {
              const wa = waLink(r.whatsapp || r.phone);
              return (
                <tr key={r.id} className={sel.has(r.id) ? "bg-brand-50/60" : "hover:bg-brand-50/40"}>
                  <td className="px-3 py-3 align-middle"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="h-4 w-4 rounded border-slate-300" /></td>
                  <td className="px-4 py-3 align-middle">
                    <Link href={`/admin/inquiries/${r.id}`} className="block">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{r.name}{r.program_code && <span className="rounded-md bg-navy px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{r.program_code}</span>}</span>
                      {r.intake && <span className="block text-xs text-slate-500">{r.intake}</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700"><Mail className="h-3.5 w-3.5 text-slate-400" /> {r.email}</a>}
                      {r.phone && (
                        <span className="inline-flex items-center gap-2">
                          <a href={telLink(r.phone)} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700"><Phone className="h-3.5 w-3.5 text-slate-400" /> {r.phone}</a>
                          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 font-semibold text-green-700 hover:bg-green-100" title="Open WhatsApp"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
                        </span>
                      )}
                      {!r.email && !r.phone && <span className="text-slate-400">No contact details</span>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 align-middle sm:table-cell"><StatusBadge value={r.type} map={TYPE_TONE} /></td>
                  <td className="px-4 py-3 align-middle"><StatusBadge value={r.status} /></td>
                  <td className="hidden px-4 py-3 align-middle text-slate-600 lg:table-cell">{r.assigned_name || <span className="text-slate-400">—</span>}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 align-middle text-slate-600 md:table-cell">{formatDateTime(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
