"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AField, AInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { startTopLoader } from "@/components/ui/top-loader";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const [mode, setMode] = React.useState<"login" | "reset">("login");
  const [info, setInfo] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const supabase = createClient();
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/reset-password` });
      setBusy(false);
      if (error) setError(error.message);
      else setInfo("If that email belongs to a staff account, a reset link has been sent.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    await fetch("/admin/api/touch-login", { method: "POST" }).catch(() => {});
    const next = sp.get("next");
    startTopLoader();
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <AField label="Email" htmlFor="email"><AInput id="email" name="email" type="email" autoComplete="email" required /></AField>
      {mode === "login" && (
        <AField label="Password" htmlFor="password">
          <div className="relative">
            <AInput id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-11" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </AField>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />} {mode === "login" ? "Sign in" : "Send reset link"}
      </Button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "reset" : "login"); setError(null); setInfo(null); }} className="block w-full text-center text-sm font-semibold text-brand-700 hover:underline">
        {mode === "login" ? "Forgot your password?" : "Back to sign in"}
      </button>
    </form>
  );
}
