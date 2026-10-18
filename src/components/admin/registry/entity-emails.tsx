"use client";

import * as React from "react";
import { Send, Code2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AInput, ASelect, AField, ATextarea, useToast } from "@/components/admin/ui";
import { RichText } from "@/components/admin/rich-text";
import { EMAIL_PLACEHOLDERS, type EmailTemplate, type EntityEmailSettings } from "@/lib/registry/fields";
import { sendTemplateTest } from "@/app/admin/(dashboard)/registry/email/actions";

export type EntityEmailsProps = {
  /** Hidden input that receives the JSON `email_settings` value. */
  name: string;
  initial: EntityEmailSettings;
  /** Global templates, shown when the mode is "default". */
  defaults: { reg: EmailTemplate; cert: EmailTemplate };
  /** Workshops have both templates; batches only the registration one. */
  showCert: boolean;
  entityType: "workshop" | "batch";
  entityId?: number;
};

type Draft = Partial<EmailTemplate> & { mode: "default" | "custom" | "off" };

export function EntityEmails({ name, initial, defaults, showCert, entityType, entityId }: EntityEmailsProps) {
  const [reg, setReg] = React.useState<Draft>({ mode: initial.reg?.mode || "default", ...initial.reg });
  const [cert, setCert] = React.useState<Draft>({ mode: initial.cert?.mode === "custom" ? "custom" : "default", ...initial.cert });
  const value = React.useMemo(() => JSON.stringify(showCert ? { reg, cert } : { reg }), [reg, cert, showCert]);
  return (
    <div className="space-y-6">
      <input type="hidden" name={name} value={value} />
      <TemplateEditor
        type="reg" title={entityType === "batch" ? "Application confirmation email" : "Registration confirmation email"}
        description={entityType === "batch" ? "Sent to the applicant right after submitting. The {workshop_title} placeholder carries the batch name." : "Sent to the registrant right after a successful registration."}
        draft={reg} onChange={setReg} global={defaults.reg} allowOff entityType={entityType} entityId={entityId}
      />
      {showCert && (
        <TemplateEditor type="cert" title="Certificate delivery email" description="Sent with the PDF attached when a certificate is issued or re-sent." draft={cert} onChange={setCert} global={defaults.cert} entityType={entityType} entityId={entityId} />
      )}
    </div>
  );
}

/** One template form section (also used standalone by the global email settings page). */
export function TemplateEditor({ type, title, description, draft, onChange, global, allowOff, entityType, entityId, standalone, errors }: {
  type: "reg" | "cert"; title: string; description?: string; draft: Draft; onChange: (d: Draft) => void; global: EmailTemplate; allowOff?: boolean;
  entityType?: "workshop" | "batch"; entityId?: number;
  /** Global template editing: no mode selector, fields are posted directly by name. */
  standalone?: boolean; errors?: Record<string, string>;
}) {
  const toast = useToast();
  const [rich, setRich] = React.useState(true);
  const [testTo, setTestTo] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const custom = standalone || draft.mode === "custom";
  const shown: EmailTemplate = custom ? { sender_name: draft.sender_name ?? "", reply_to: draft.reply_to ?? "", subject: draft.subject ?? "", body: draft.body ?? "" } : global;
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const placeholders = EMAIL_PLACEHOLDERS[type];

  const sendTest = async () => {
    setSending(true);
    try {
      const r = await sendTemplateTest({ type, template: custom ? { sender_name: draft.sender_name, reply_to: draft.reply_to, subject: draft.subject, body: draft.body } : {}, to: testTo, entityId, entityType });
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {!standalone && (
          <ASelect className="h-9 w-auto text-xs" value={draft.mode} onChange={(e) => set({ mode: e.target.value as Draft["mode"] })}>
            <option value="default">Use global template</option>
            <option value="custom">Customise for this {entityType === "batch" ? "batch" : "workshop"}</option>
            {allowOff && <option value="off">Do not send</option>}
          </ASelect>
        )}
      </header>
      {draft.mode === "off" && !standalone ? (
        <p className="px-4 py-4 text-sm text-slate-500">No {type === "reg" ? "confirmation" : "certificate"} email will be sent.</p>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AField label="Sender name" error={errors?.sender_name}>
              <AInput name={standalone ? "sender_name" : undefined} value={shown.sender_name} readOnly={!custom} onChange={(e) => set({ sender_name: e.target.value })} placeholder={global.sender_name} />
            </AField>
            <AField label="Reply-to address" error={errors?.reply_to}>
              <AInput name={standalone ? "reply_to" : undefined} type="email" value={shown.reply_to} readOnly={!custom} onChange={(e) => set({ reply_to: e.target.value })} placeholder={global.reply_to} />
            </AField>
          </div>
          <AField label="Subject" error={errors?.subject}>
            <AInput name={standalone ? "subject" : undefined} value={shown.subject} readOnly={!custom} onChange={(e) => set({ subject: e.target.value })} placeholder={global.subject} />
          </AField>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Body</p>
              {custom && (
                <button type="button" onClick={() => setRich((r) => !r)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  {rich ? <><Code2 className="h-3.5 w-3.5" /> Edit HTML</> : <><PenLine className="h-3.5 w-3.5" /> Rich text</>}
                </button>
              )}
            </div>
            {standalone && <input type="hidden" name="body" value={shown.body} />}
            {custom && rich ? (
              <RichText value={shown.body} onChange={(h) => set({ body: h })} minHeight={180} placeholder="Dear {student_name}, …" />
            ) : (
              <ATextarea value={shown.body} readOnly={!custom} onChange={(e) => set({ body: e.target.value })} rows={8} className="font-mono text-xs" />
            )}
            {errors?.body && <p className="mt-1 text-xs font-medium text-rose-600">{errors.body}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Placeholders:</span>
              {placeholders.map((p) => (
                <button key={p} type="button" disabled={!custom} onClick={() => { try { navigator.clipboard.writeText(p); } catch { /* ignore */ } }} title="Copy" className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-brand-50 disabled:cursor-default">{p}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
            <AInput type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className="h-9 max-w-xs" />
            <Button type="button" size="sm" variant="outline" loading={sending} onClick={sendTest} disabled={!testTo}><Send className="h-4 w-4" /> Send test</Button>
            <span className="text-xs text-slate-500">Renders with sample values{custom ? " from the fields above" : " from the global template"}.</span>
          </div>
        </div>
      )}
    </section>
  );
}
