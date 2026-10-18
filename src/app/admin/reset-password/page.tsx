"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AField, AInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { startTopLoader } from "@/components/ui/top-loader";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("p1")), p2 = String(fd.get("p2"));
    if (p1.length < 10) return setError("Use at least 10 characters.");
    if (p1 !== p2) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setError(error.message);
    startTopLoader();
    router.replace("/admin");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <AField label="New password" htmlFor="p1"><AInput id="p1" name="p1" type="password" autoComplete="new-password" required /></AField>
        <AField label="Confirm password" htmlFor="p2"><AInput id="p2" name="p2" type="password" autoComplete="new-password" required /></AField>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" className="w-full" loading={busy}>Update password</Button>
      </form>
    </div>
  );
}
