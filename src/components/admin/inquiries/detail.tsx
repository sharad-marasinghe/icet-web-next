"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Mail, Trash2, StickyNote } from "lucide-react";
import { Panel, AField, ASelect, ATextarea, SubmitButton, ActionToast, initialActionState, useToast, type ActionState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { waLink, telLink } from "./links";
import { updateInquiryStatus, assignInquiry, addInquiryNote, deleteInquiry } from "@/app/admin/(dashboard)/inquiries/actions";
import { startTopLoader } from "@/components/ui/top-loader";

const STATUSES = ["new", "contacted", "qualified", "converted", "closed", "spam"];

export function InquiryActions({ id, status, assignedTo, staff, phone, whatsapp, email, waMessage, emailSubject, emailBody, canDelete }: {
  id: string; status: string; assignedTo: string | null; staff: { id: string; full_name: string; email: string }[];
  phone: string; whatsapp: string; email: string; waMessage: string; emailSubject: string; emailBody: string; canDelete: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<ActionState>) => {
    setBusy(key);
    try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "" }); if (r?.ok) router.refresh(); return r; } finally { setBusy(null); }
  };
  const wa = waLink(whatsapp || phone, waMessage);
  return (
    <Panel title="Follow-up">
      <div className="space-y-4">
        <AField label="Status" htmlFor="inq-status">
          <ASelect id="inq-status" value={status} disabled={busy === "status"} onChange={(e) => run("status", () => updateInquiryStatus(id, e.target.value))}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </ASelect>
        </AField>
        <AField label="Assigned to" htmlFor="inq-assign">
          <ASelect id="inq-assign" value={assignedTo || ""} disabled={busy === "assign"} onChange={(e) => run("assign", () => assignInquiry(id, e.target.value || null))}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
          </ASelect>
        </AField>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Quick actions</p>
          <div className="grid gap-2">
            {phone ? <Button href={telLink(phone)} variant="outline" size="sm" className="justify-start"><Phone className="h-4 w-4" /> Call {phone}</Button> : <Button variant="outline" size="sm" disabled className="justify-start"><Phone className="h-4 w-4" /> No phone number</Button>}
            {wa ? <Button href={wa} variant="accent" size="sm" className="justify-start"><MessageCircle className="h-4 w-4" /> WhatsApp with intro message</Button> : <Button variant="outline" size="sm" disabled className="justify-start"><MessageCircle className="h-4 w-4" /> No WhatsApp number</Button>}
            {email ? <Button href={`mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`} variant="outline" size="sm" className="justify-start"><Mail className="h-4 w-4" /> Email {email}</Button> : <Button variant="outline" size="sm" disabled className="justify-start"><Mail className="h-4 w-4" /> No email address</Button>}
          </div>
        </div>
        {canDelete && (
          <div className="border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" loading={busy === "delete"} onClick={async () => { if (!confirm("Delete this inquiry permanently? This cannot be undone.")) return; const r = await run("delete", () => deleteInquiry(id)); if (r?.ok) { startTopLoader(); router.replace("/admin/inquiries"); } }}><Trash2 className="h-4 w-4" /> Delete inquiry</Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function NotesPanel({ id, notes }: { id: string; notes: string }) {
  const [state, action] = useActionState(addInquiryNote, initialActionState);
  const ref = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) { ref.current?.reset(); router.refresh(); } }, [state, router]);
  const entries = notes ? notes.split(/\n\n(?=\[)/).filter(Boolean) : [];
  return (
    <Panel title="Internal notes" description="Visible to staff only. Each note is stamped with the time and your name.">
      <ActionToast state={state} />
      {entries.length ? (
        <ol className="mb-5 space-y-3">
          {entries.map((e, i) => {
            const m = e.match(/^\[([^\]]+)\]\n?([\s\S]*)$/);
            return (
              <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                {m ? <><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><StickyNote className="h-3.5 w-3.5" /> {m[1]}</p><p className="whitespace-pre-wrap text-sm text-slate-800">{m[2]}</p></> : <p className="whitespace-pre-wrap text-sm text-slate-800">{e}</p>}
              </li>
            );
          })}
        </ol>
      ) : <p className="mb-4 text-sm text-slate-500">No notes yet.</p>}
      <form ref={ref} action={action} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <AField label="Add a note" htmlFor="inq-note" error={state?.errors?.note}><ATextarea id="inq-note" name="note" rows={3} placeholder="Called – interested in the January intake, follow up next week…" required /></AField>
        <div className="flex justify-end"><SubmitButton size="sm" pendingText="Adding…"><StickyNote className="h-4 w-4" /> Add note</SubmitButton></div>
      </form>
    </Panel>
  );
}
