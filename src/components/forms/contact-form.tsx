"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Input, Textarea, Field, Notice } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useFormToken, readUtm } from "./use-form-token";

export function ContactForm({ successMessage }: { successMessage?: string }) {
  const { token, refresh } = useFormToken();
  const [state, setState] = React.useState<{ status: "idle" | "submitting" | "done" | "error"; message?: string }>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState({ status: "submitting" });
    const payload = { type: "contact", name: `${fd.get("first_name") || ""} ${fd.get("last_name") || ""}`.trim(), email: fd.get("email"), phone: fd.get("phone"), message: fd.get("message"), data: { subject: fd.get("subject") }, utm: readUtm(), page_path: window.location.pathname, website: fd.get("website") };
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
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (state.status === "done") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h3 className="mt-3 font-display text-xl font-bold text-slate-900">Message sent</h3>
        <p className="mt-1 text-slate-600">{successMessage || "Thanks for reaching out. We'll reply within one working day."}</p>
        <Button onClick={() => setState({ status: "idle" })} variant="outline" className="mt-5">Send another message</Button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="hidden" aria-hidden><input type="text" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="c-fn" required><Input id="c-fn" name="first_name" required autoComplete="given-name" /></Field>
        <Field label="Last name" htmlFor="c-ln"><Input id="c-ln" name="last_name" autoComplete="family-name" /></Field>
        <Field label="Email" htmlFor="c-email" required><Input id="c-email" name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" name="phone" type="tel" autoComplete="tel" /></Field>
      </div>
      <Field label="Subject" htmlFor="c-subject"><Input id="c-subject" name="subject" placeholder="How can we help?" /></Field>
      <Field label="Message" htmlFor="c-msg" required><Textarea id="c-msg" name="message" rows={5} required /></Field>
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Button type="submit" size="lg" disabled={state.status === "submitting"}>
        {state.status === "submitting" ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending…</> : <>Send message <Send className="h-4 w-4" /></>}
      </Button>
    </form>
  );
}
