"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Plug, Send, RotateCcw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, Panel, AInput, ASelect, AField, Toggle, SubmitButton, ActionToast, initialActionState, StatusBadge, useToast, ConfirmButton } from "@/components/admin/ui";
import type { EmailTemplate } from "@/lib/registry/fields";
import type { SmtpSettings } from "@/lib/mailer";
import { saveGlobalTemplate, resetGlobalTemplate, saveSmtpSettings, testSmtpConnection, sendSmtpTestEmail } from "@/app/admin/(dashboard)/registry/email/actions";
import { TemplateEditor } from "./entity-emails";
import { startTopLoader } from "@/components/ui/top-loader";

export type EmailLogRow = { id: number; to_email: string; subject: string; kind: string; status: string; error: string | null; entity_type: string | null; entity_id: string | null; created_at: string };
export type EntityLink = { id: number; label: string; kind: "workshop" | "batch"; customised: boolean };

export function EmailSettings({ templates, smtp, hasPass, log, entities, initialTab, logStatus }: { templates: { reg: EmailTemplate; cert: EmailTemplate }; smtp: Omit<SmtpSettings, "pass">; hasPass: boolean; log: EmailLogRow[]; entities: EntityLink[]; initialTab: string; logStatus: string }) {
  const router = useRouter();
  const [tab, setTab] = React.useState(["reg", "cert", "smtp", "log"].includes(initialTab) ? initialTab : "reg");
  const change = (id: string) => { setTab(id); startTopLoader(); router.replace(`/admin/registry/email?tab=${id}`); };
  return (
    <div className="space-y-5">
      <Panel title="Editing emails for" description="Global templates apply everywhere unless a workshop or batch overrides them in its own editor.">
        <EntitySelector entities={entities} />
      </Panel>
      <Tabs tabs={[{ id: "reg", label: "Registration confirmation" }, { id: "cert", label: "Certificate delivery" }, { id: "smtp", label: "SMTP" }, { id: "log", label: "Email log", count: log.length }]} active={tab} onChange={change} />
      {tab === "reg" && <GlobalTemplateForm key="reg" type="reg" template={templates.reg} />}
      {tab === "cert" && <GlobalTemplateForm key="cert" type="cert" template={templates.cert} />}
      {tab === "smtp" && <SmtpForm smtp={smtp} hasPass={hasPass} />}
      {tab === "log" && <EmailLog rows={log} status={logStatus} />}
    </div>
  );
}

function EntitySelector({ entities }: { entities: EntityLink[] }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ASelect className="w-auto max-w-md" defaultValue="" onChange={(e) => { const v = e.target.value; if (!v) return; const [kind, id] = v.split(":"); startTopLoader(); router.push(kind === "workshop" ? `/admin/registry/workshops/${id}` : `/admin/registry/batches/${id}`); }}>
        <option value="">Global defaults (this page)</option>
        <optgroup label="Workshops">{entities.filter((e) => e.kind === "workshop").map((e) => <option key={`w${e.id}`} value={`workshop:${e.id}`}>{e.label}{e.customised ? " · customised" : ""}</option>)}</optgroup>
        <optgroup label="Academic batches">{entities.filter((e) => e.kind === "batch").map((e) => <option key={`b${e.id}`} value={`batch:${e.id}`}>{e.label}{e.customised ? " · customised" : ""}</option>)}</optgroup>
      </ASelect>
      <span className="text-xs text-slate-500">Selecting an entry opens its editor, where the Response emails section holds the override.</span>
    </div>
  );
}

function GlobalTemplateForm({ type, template }: { type: "reg" | "cert"; template: EmailTemplate }) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(saveGlobalTemplate, initialActionState);
  const [draft, setDraft] = React.useState<Partial<EmailTemplate> & { mode: "default" | "custom" | "off" }>({ mode: "custom", ...template });
  React.useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      <ActionToast state={state} />
      <input type="hidden" name="type" value={type} />
      <TemplateEditor type={type} standalone title={type === "reg" ? "Registration confirmation (global)" : "Certificate delivery (global)"} description={type === "reg" ? "Sent after a workshop registration or batch application unless the entity overrides or disables it." : "Sent with the certificate PDF attached when certificates are issued or re-sent."} draft={draft} onChange={setDraft} global={template} errors={state?.errors} />
      <div className="flex items-center justify-between">
        <ConfirmButton variant="ghost" size="sm" message="Reset this template to the built-in default wording?" onConfirm={async () => { const r = await resetGlobalTemplate(type); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); router.refresh(); }}><RotateCcw className="h-3.5 w-3.5" /> Reset to default</ConfirmButton>
        <SubmitButton size="sm"><Save className="h-4 w-4" /> Save template</SubmitButton>
      </div>
    </form>
  );
}

function SmtpForm({ smtp, hasPass }: { smtp: Omit<SmtpSettings, "pass">; hasPass: boolean }) {
  const router = useRouter();
  const [saveState, saveAction] = useActionState(saveSmtpSettings, initialActionState);
  const [testState, testAction] = useActionState(testSmtpConnection, initialActionState);
  const [mailState, mailAction] = useActionState(sendSmtpTestEmail, initialActionState);
  const [enabled, setEnabled] = React.useState(smtp.enabled);
  React.useEffect(() => { if (saveState?.ok) router.refresh(); }, [saveState, router]);
  const errors = { ...(saveState?.errors || {}), ...(testState?.errors || {}), ...(mailState?.errors || {}) };
  return (
    <form action={saveAction} className="space-y-4">
      <ActionToast state={saveState} /><ActionToast state={testState} /><ActionToast state={mailState} />
      <Panel title="SMTP server" description="Outgoing mail for confirmations, certificates and notifications. Environment variables (SMTP_HOST…) are used as a fallback when nothing is saved here.">
        <div className="space-y-4">
          <Toggle name="enabled" checked={enabled} onChange={setEnabled} label="Enable SMTP sending" description="When disabled, emails are logged as failed and nothing is sent." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AField label="Host" required={enabled} error={errors.host}><AInput name="host" defaultValue={smtp.host} placeholder="smtp.gmail.com" /></AField>
            <AField label="Port" error={errors.port}><AInput name="port" type="number" defaultValue={smtp.port} /></AField>
            <AField label="Security" error={errors.secure}><ASelect name="secure" defaultValue={smtp.secure}><option value="none">None</option><option value="tls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option></ASelect></AField>
            <AField label="Username" error={errors.user}><AInput name="user" defaultValue={smtp.user} autoComplete="off" /></AField>
            <AField label="Password" hint={hasPass ? "Leave blank to keep the saved password." : "Not set."} error={errors.pass}><AInput name="pass" type="password" placeholder={hasPass ? "••••••••" : ""} autoComplete="new-password" /></AField>
            <AField label="From address" error={errors.from_email}><AInput name="from_email" type="email" defaultValue={smtp.from_email} placeholder="noreply@icet.lk" /></AField>
            <AField label="From name" error={errors.from_name}><AInput name="from_name" defaultValue={smtp.from_name} placeholder="iCET" /></AField>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <SubmitButton size="sm"><Save className="h-4 w-4" /> Save SMTP settings</SubmitButton>
            <Button type="submit" formAction={testAction} variant="outline" size="sm"><Plug className="h-4 w-4" /> Test connection</Button>
            <div className="ml-auto flex items-center gap-2">
              <AInput name="test_to" type="email" placeholder="Send test email to…" className="h-9 w-56" />
              <Button type="submit" formAction={mailAction} variant="outline" size="sm"><Send className="h-4 w-4" /> Send test email</Button>
            </div>
          </div>
          {errors.test_to && <p className="text-xs font-medium text-rose-600">{errors.test_to}</p>}
        </div>
      </Panel>
    </form>
  );
}

function EmailLog({ rows, status }: { rows: EmailLogRow[]; status: string }) {
  return (
    <Panel title="Email log" description="The last 100 messages attempted by the site." padded={false} actions={
      <div className="flex gap-1">{[["", "All"], ["sent", "Sent"], ["failed", "Failed"]].map(([v, l]) => <Link key={v} href={`/admin/registry/email?tab=log${v ? `&status=${v}` : ""}`} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</Link>)}</div>
    }>
      {rows.length === 0 ? <p className="p-5 text-sm text-slate-500">No emails logged yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-600">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-2 text-xs text-slate-800">{r.to_email}</td>
                  <td className="px-4 py-2 text-xs text-slate-800"><p className="max-w-md truncate" title={r.subject}>{r.subject}</p>{r.entity_type && <p className="text-[11px] text-slate-400">{r.entity_type} #{r.entity_id}</p>}</td>
                  <td className="px-4 py-2 text-xs capitalize text-slate-600">{r.kind}</td>
                  <td className="px-4 py-2"><StatusBadge value={r.status} />{r.error && <p className="mt-1 max-w-xs text-[11px] text-rose-600" title={r.error}>{r.error.slice(0, 160)}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
