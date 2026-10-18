"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Upload, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Notice } from "@/components/ui/primitives";
import { useFormToken } from "./use-form-token";
import { buildPages, fieldName, isMulti, UPLOAD_ACCEPT, type FormFields, type FieldConfig } from "@/lib/registry/fields";

export type RegistrationFormProps = {
  mode: "workshop" | "batch";
  targetId: number;
  title: string;
  description?: string;
  fields: FormFields;          // already sanitised + identity-normalised on the server
  sourceTracking?: boolean;
  showHeader?: boolean;
  successTitle?: string;
};

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string } | { kind: "done"; message: string; reference: string; emailSent: boolean };

export function RegistrationForm({ mode, targetId, title, description, fields, sourceTracking, showHeader, successTitle }: RegistrationFormProps) {
  const pages = React.useMemo(() => buildPages(fields), [fields]);
  const [page, setPage] = React.useState(0);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const formRef = React.useRef<HTMLFormElement>(null);
  const { token, refresh } = useFormToken();
  const total = pages.length;
  const hasUploads = Object.values(fields).some((c) => c.enabled && c.type === "file");

  const referrer = React.useRef<string>("");
  React.useEffect(() => {
    referrer.current = document.referrer || "";
  }, []);
  const readAttribution = () => {
    const sp = new URLSearchParams(window.location.search);
    const norm = (v: string | null, max: number) => (v || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, max);
    const src = norm(sp.get("utm_source"), 100);
    let ref = "";
    try { ref = referrer.current ? new URL(referrer.current).hostname.replace(/^www\./, "") : ""; } catch { ref = ""; }
    const fromRef = /facebook|fb\.com/.test(ref) ? "facebook" : /instagram/.test(ref) ? "instagram" : /linkedin/.test(ref) ? "linkedin" : /tiktok/.test(ref) ? "tiktok" : /youtube|youtu\.be/.test(ref) ? "youtube" : /twitter|x\.com/.test(ref) ? "x" : /whatsapp/.test(ref) ? "whatsapp" : "";
    return { source: src || fromRef || "direct", medium: norm(sp.get("utm_medium"), 100) || (fromRef ? "social" : ""), campaign: norm(sp.get("utm_campaign"), 150) };
  };

  function validatePage(i: number): boolean {
    const form = formRef.current;
    if (!form) return true;
    const container = form.querySelector<HTMLElement>(`[data-page="${i}"]`);
    if (!container) return true;
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    for (const el of inputs) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    // required checkbox groups
    for (const group of Array.from(container.querySelectorAll<HTMLElement>("[data-required-group]"))) {
      const any = group.querySelector<HTMLInputElement>("input:checked");
      if (!any) {
        group.querySelector<HTMLInputElement>("input")?.focus();
        setStatus({ kind: "error", message: `Please select at least one option for "${group.dataset.label}".` });
        return false;
      }
    }
    setStatus({ kind: "idle" });
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validatePage(page)) return;
    for (let i = 0; i < total; i++) if (!validatePage(i)) { setPage(i); return; }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set(mode === "workshop" ? "workshop_id" : "batch_id", String(targetId));
    fd.set("source_tracking", sourceTracking ? "true" : "false");
    if (sourceTracking) {
      const attribution = readAttribution();
      fd.set("registration_source", attribution.source);
      fd.set("registration_medium", attribution.medium);
      fd.set("registration_campaign", attribution.campaign);
    }
    setStatus({ kind: "submitting" });
    try {
      let t = token || (await refresh());
      let res = await fetch("/api/register", { method: "POST", headers: { "x-icet-form-token": t }, body: fd });
      if (res.status === 403) {
        t = await refresh();
        res = await fetch("/api/register", { method: "POST", headers: { "x-icet-form-token": t }, body: fd });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Registration failed. Please try again.");
      setStatus({ kind: "done", message: data.message, reference: data.reference_no || data.student_id, emailSent: data.email_sent !== false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Registration failed." });
    }
  }

  if (status.kind === "done") {
    return (
      <div className="card p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">{successTitle || (mode === "batch" ? "Application submitted!" : "You're registered!")}</h2>
        <p className="mt-2 text-slate-600">{status.message}</p>
        <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-xl bg-surface px-6 py-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Your reference</span>
          <span className="font-mono text-2xl font-bold text-brand-700">{status.reference}</span>
        </div>
        {!status.emailSent && <Notice tone="warning" className="mt-5 text-left">We could not send a confirmation email. Please save your reference number.</Notice>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="outline">Back to home</Button>
          <Button href="/events">See more events</Button>
        </div>
      </div>
    );
  }

  const progress = total > 1 ? Math.round(((page + 1) / total) * 100) : 100;

  return (
    <div className="card overflow-hidden">
      {showHeader && (
        <div className="bg-navy-grad px-6 py-7 text-white sm:px-8">
          <p className="eyebrow text-brand-200">{mode === "batch" ? "Academic registration" : "Workshop registration"}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">{title}</h2>
          {description && <div className="mt-2 text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: description }} />}
        </div>
      )}
      {total > 1 && (
        <div className="border-b border-slate-200 bg-surface px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Step {page + 1} of {total}{pages[page].title ? ` · ${pages[page].title}` : ""}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={page + 1}>
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} noValidate encType={hasUploads ? "multipart/form-data" : undefined} className="px-6 py-7 sm:px-8">
        <div className="hidden" aria-hidden><input type="text" name="icet_hp_email_confirm" tabIndex={-1} autoComplete="off" /></div>
        {pages.map((p, i) => (
          <div key={i} data-page={i} hidden={i !== page} className="space-y-6">
            {p.title && <h3 className="font-display text-xl font-bold text-slate-900">{p.title}</h3>}
            {p.desc && <div className="prose-icet -mt-3 text-[15px] text-slate-600" dangerouslySetInnerHTML={{ __html: p.desc }} />}
            <div className="grid gap-5 sm:grid-cols-2">
              {p.fields.map(([key, conf]) => <FieldRenderer key={key} fieldKey={key} conf={conf} active={i === page} />)}
            </div>
          </div>
        ))}
        {status.kind === "error" && <Notice tone="error" className="mt-6">{status.message}</Notice>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <div>
            {page > 0 && (
              <Button type="button" variant="outline" onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>
          {page < total - 1 ? (
            <Button type="button" size="lg" onClick={() => { if (validatePage(page)) { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={status.kind === "submitting"}>
              {status.kind === "submitting" ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</> : <>{mode === "batch" ? "Submit application" : "Register now"} <ArrowRight className="h-4 w-4" /></>}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function FieldRenderer({ fieldKey, conf, active }: { fieldKey: string; conf: FieldConfig; active: boolean }) {
  const id = `f_${fieldKey}`;
  const name = fieldName(fieldKey, conf);
  const span = conf.width === "half" ? "" : "sm:col-span-2";
  const label = (
    <span className="mb-1.5 block text-sm font-semibold text-slate-800">
      {conf.label}{conf.required && <span className="ml-1 text-rose-600" aria-hidden>*</span>}
    </span>
  );
  const help = conf.help ? <div className="mb-2 text-sm text-slate-500 [&_a]:text-brand-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: conf.help }} /> : null;
  // Inactive pages must not block native validation of the visible page.
  const req = conf.required && active;

  if (conf.type === "heading") {
    return (
      <div className="sm:col-span-2 border-t border-slate-200 pt-5 first:border-0 first:pt-0">
        <h4 className="font-display text-lg font-bold text-slate-900">{conf.label}</h4>
        {conf.help && <div className="mt-1 text-sm text-slate-600 [&_a]:text-brand-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: conf.help }} />}
      </div>
    );
  }
  if (conf.type === "radio" || conf.type === "checkbox") {
    const control = conf.type === "checkbox" || isMulti(conf) ? "checkbox" : "radio";
    const nm = control === "checkbox" ? (name.endsWith("[]") ? name : name.replace(/\]$/, "][]")) : name;
    return (
      <fieldset className={cn(span)} data-required-group={conf.required && control === "checkbox" ? "1" : undefined} data-label={conf.label}>
        <legend className="mb-1.5 text-sm font-semibold text-slate-800">{conf.label}{conf.required && <span className="ml-1 text-rose-600">*</span>}</legend>
        {help}
        <div className={cn("grid gap-2", conf.options.length > 3 && "sm:grid-cols-2")}>
          {conf.options.map((o, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 transition hover:border-brand-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type={control} name={nm} value={o} required={req && control === "radio"} className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500" />
              {o}
            </label>
          ))}
          {!conf.options.length && <span className="text-sm text-slate-400">No options configured.</span>}
        </div>
      </fieldset>
    );
  }
  return (
    <div className={span}>
      <label htmlFor={id}>{label}</label>
      {help}
      {conf.type === "textarea" ? (
        <Textarea id={id} name={name} rows={3} required={req} maxLength={conf.maxlength || undefined} placeholder={conf.placeholder || conf.label} />
      ) : conf.type === "select" ? (
        <Select id={id} name={isMulti(conf) ? name : name} multiple={isMulti(conf)} required={req} defaultValue={isMulti(conf) ? [] : ""} size={isMulti(conf) ? 5 : undefined}>
          {!isMulti(conf) && <option value="">Select {conf.label}</option>}
          {conf.options.map((o, i) => <option key={i} value={o}>{o}</option>)}
        </Select>
      ) : conf.type === "file" ? (
        <FileInput id={id} name={name} required={req} />
      ) : (
        <Input
          id={id} name={name} type={conf.type === "text" ? "text" : conf.type} required={req}
          pattern={conf.pattern || undefined} min={conf.min || undefined} max={conf.max || undefined} maxLength={conf.maxlength || undefined}
          placeholder={conf.placeholder || conf.label}
          autoComplete={fieldKey === "student_name" ? "name" : fieldKey === "student_email" ? "email" : fieldKey === "student_phone" ? "tel" : "off"}
          inputMode={conf.type === "tel" ? "tel" : conf.type === "number" ? "numeric" : undefined}
        />
      )}
    </div>
  );
}

function FileInput({ id, name, required }: { id: string; name: string; required?: boolean }) {
  const [file, setFile] = React.useState<File | null>(null);
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border-2 border-dashed px-4 py-3 text-sm transition", file ? "border-green-300 bg-green-50 text-green-800" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:bg-brand-50")}>
      {file ? <FileCheck2 className="h-5 w-5 shrink-0" /> : <Upload className="h-5 w-5 shrink-0 text-brand-600" />}
      <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${(file.size / 1048576).toFixed(2)} MB` : "Choose a file (PDF, JPG, PNG, WEBP · max 10 MB)"}</span>
      <input id={id} name={name} type="file" accept={UPLOAD_ACCEPT} required={required} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
    </label>
  );
}
