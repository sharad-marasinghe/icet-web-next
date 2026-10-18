"use client";

import * as React from "react";
import { Star, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Notice } from "@/components/ui/primitives";
import { useFormToken } from "./use-form-token";

export type FeedbackQuestionView = { id: number; question: string; field_type: "text" | "textarea" | "rating" | "yes_no" | "info"; is_required: boolean };

export function FeedbackForm({ slug, questions, submitLabel, introHtml }: { slug: string; questions: FeedbackQuestionView[]; submitLabel?: string; introHtml?: string }) {
  const { token, refresh } = useFormToken();
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [state, setState] = React.useState<{ status: "idle" | "submitting" | "done" | "error"; message?: string; redirect?: string | null }>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    for (const q of questions) {
      if (q.is_required && q.field_type !== "info" && !answers[String(q.id)]) {
        setState({ status: "error", message: `Please answer: ${q.question.replace(/<[^>]*>/g, "")}` });
        return;
      }
    }
    setState({ status: "submitting" });
    try {
      let t = token || (await refresh());
      let res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", "x-icet-form-token": t }, body: JSON.stringify({ slug, answers }) });
      if (res.status === 403) {
        t = await refresh();
        res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", "x-icet-form-token": t }, body: JSON.stringify({ slug, answers }) });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not submit feedback.");
      setState({ status: "done", message: data.message, redirect: data.redirect });
      if (data.redirect) setTimeout(() => { window.location.href = data.redirect; }, 1600);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Could not submit feedback." });
    }
  }

  if (state.status === "done") {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h3 className="mt-4 font-display text-2xl font-bold text-slate-900">{state.message}</h3>
        {state.redirect && (
          <p className="mt-3 text-slate-600">Redirecting you to Google Reviews… <a href={state.redirect} className="inline-flex items-center gap-1 font-semibold text-brand-700 underline">Open now <ExternalLink className="h-4 w-4" /></a></p>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-6 p-6 sm:p-8" noValidate>
      {introHtml && <div className="prose-icet text-[15px]" dangerouslySetInnerHTML={{ __html: introHtml }} />}
      <div className="hidden" aria-hidden><input type="text" name="website" tabIndex={-1} autoComplete="off" /></div>
      {questions.map((q) => {
        const key = String(q.id);
        if (q.field_type === "info") return <p key={q.id} className="whitespace-pre-line rounded-xl bg-surface p-4 text-[15px] text-slate-700">{q.question}</p>;
        return (
          <div key={q.id}>
            <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor={`fb-${q.id}`}>{q.question}{q.is_required && <span className="ml-1 text-rose-600">*</span>}</label>
            {q.field_type === "rating" ? (
              <div className="flex gap-1.5" role="radiogroup" aria-label={q.question}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={answers[key] === String(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setAnswers((a) => ({ ...a, [key]: String(n) }))}
                    className={cn("grid h-11 w-11 place-items-center rounded-xl border transition", Number(answers[key]) >= n ? "border-amber-300 bg-amber-50 text-amber-500" : "border-slate-200 bg-white text-slate-300 hover:text-amber-400")}>
                    <Star className="h-6 w-6 fill-current" />
                  </button>
                ))}
              </div>
            ) : q.field_type === "yes_no" ? (
              <div className="flex gap-2">
                {["Yes", "No"].map((o) => (
                  <button key={o} type="button" onClick={() => setAnswers((a) => ({ ...a, [key]: o }))} className={cn("rounded-xl border px-5 py-2.5 text-sm font-semibold transition", answers[key] === o ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300")}>{o}</button>
                ))}
              </div>
            ) : q.field_type === "textarea" ? (
              <Textarea id={`fb-${q.id}`} rows={4} value={answers[key] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))} />
            ) : (
              <Input id={`fb-${q.id}`} value={answers[key] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))} />
            )}
          </div>
        );
      })}
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Button type="submit" size="lg" disabled={state.status === "submitting"}>
        {state.status === "submitting" ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</> : submitLabel || "Submit Feedback"}
      </Button>
    </form>
  );
}
