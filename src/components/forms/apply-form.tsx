"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Input, Textarea, Select, Field, Notice } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useFormToken, readUtm } from "./use-form-token";

export type ProgramOption = { code: string; name: string; qualification: string };

export function ApplyForm({ programs, intakeLabel, preselect, successMessage, compact }: { programs: ProgramOption[]; intakeLabel?: string; preselect?: string; successMessage?: string; compact?: boolean }) {
  const { token, refresh } = useFormToken();
  const [state, setState] = React.useState<{ status: "idle" | "submitting" | "done" | "error"; message?: string }>({ status: "idle" });
  const [program, setProgram] = React.useState(preselect || "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!fd.get("gdpr")) {
      setState({ status: "error", message: "Please accept the privacy policy to continue." });
      return;
    }
    setState({ status: "submitting" });
    const payload = {
      type: "apply",
      name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), whatsapp: fd.get("whatsapp"),
      program_code: fd.get("program_code"), intake: intakeLabel,
      message: fd.get("message"),
      data: { ol_results: fd.get("ol_results"), al_results: fd.get("al_results"), university: fd.get("university"), current_status: fd.get("current_status"), preferred_mode: fd.get("preferred_mode") },
      utm: readUtm(), page_path: window.location.pathname, website: fd.get("website"),
    };
    try {
      let t = token || (await refresh());
      let res = await fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json", "x-icet-form-token": t }, body: JSON.stringify(payload) });
      if (res.status === 403) {
        t = await refresh();
        res = await fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json", "x-icet-form-token": t }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong.");
      setState({ status: "done" });
      form.reset();
      try { window.dispatchEvent(new CustomEvent("icet:lead", { detail: { type: "apply" } })); } catch {}
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    }
  }

  if (state.status === "done") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h3 className="mt-4 font-display text-2xl font-bold text-slate-900">Inquiry received!</h3>
        <p className="mt-2 text-slate-600">{successMessage || "Thank you! Our student counsellor will contact you shortly on WhatsApp or by phone."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/professional-it-courses-in-sri-lanka" variant="outline">Explore programmes</Button>
          <Button onClick={() => setState({ status: "idle" })} variant="ghost">Submit another</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="hidden" aria-hidden><input type="text" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="ap-name" required><Input id="ap-name" name="name" required autoComplete="name" placeholder="Your full name" /></Field>
        <Field label="Contact number" htmlFor="ap-phone" required><Input id="ap-phone" name="phone" type="tel" required autoComplete="tel" placeholder="07X XXX XXXX" /></Field>
        <Field label="Email" htmlFor="ap-email" required><Input id="ap-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></Field>
        <Field label="WhatsApp number" htmlFor="ap-wa" hint="(if different)"><Input id="ap-wa" name="whatsapp" type="tel" placeholder="07X XXX XXXX" /></Field>
      </div>
      <Field label="Programme of interest" htmlFor="ap-prog" required>
        <Select id="ap-prog" name="program_code" required value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">Select a programme</option>
          {programs.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name} ({p.qualification})</option>)}
          <option value="undecided">Not sure yet — please advise me</option>
        </Select>
      </Field>
      {!compact && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current status" htmlFor="ap-status">
            <Select id="ap-status" name="current_status" defaultValue="">
              <option value="">Select…</option>
              <option>Completed O/L</option><option>Completed A/L</option><option>University undergraduate</option><option>Graduate</option><option>Working professional</option><option>Other</option>
            </Select>
          </Field>
          <Field label="Preferred mode" htmlFor="ap-mode">
            <Select id="ap-mode" name="preferred_mode" defaultValue="">
              <option value="">Select…</option><option>Physical (Panadura)</option><option>Online</option><option>Hybrid</option><option>Weekday</option><option>Weekend</option>
            </Select>
          </Field>
          <Field label="O/L Maths & English results" htmlFor="ap-ol"><Input id="ap-ol" name="ol_results" placeholder="e.g. Maths B, English C" /></Field>
          <Field label="A/L results & stream" htmlFor="ap-al"><Input id="ap-al" name="al_results" placeholder="e.g. Physical Science – 3 passes" /></Field>
          <Field label="University (if applicable)" htmlFor="ap-uni" className="sm:col-span-2" hint="📌 උසස් අධ්‍යාපනය හදාරන සිසුවෙකු නම්, විශ්වවිද්‍යාලයේ නම සඳහන් කරන්න."><Input id="ap-uni" name="university" placeholder="University name" /></Field>
        </div>
      )}
      <Field label="Anything else we should know?" htmlFor="ap-msg"><Textarea id="ap-msg" name="message" rows={3} placeholder="Questions about schedules, fees, scholarships…" /></Field>
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" name="gdpr" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" required />
        <span>I agree to the processing of my personal data as outlined in iCET&apos;s <Link href="/privacy-policy" className="text-brand-700 underline">Privacy Policy</Link>. <span className="text-rose-600">*</span></span>
      </label>
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={state.status === "submitting"}>
        {state.status === "submitting" ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</> : <>Submit inquiry <ArrowRight className="h-5 w-5" /></>}
      </Button>
      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-accent-600" /> Your details are only used to contact you about iCET programmes.</p>
    </form>
  );
}
