"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Settings2, ListChecks, MessageSquareText, Copy, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, useToast } from "@/components/admin/ui";
import { deleteFeedbackForm, duplicateFeedbackForm, makeDefaultFeedbackForm } from "@/app/admin/(dashboard)/feedback/actions";

export function FeedbackRowActions({ id, name, isDefault, isAdmin }: { id: number; name: string; isDefault: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; message?: string } | null>) => {
    setBusy(true);
    try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); router.refresh(); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button href={`/admin/feedback/${id}?tab=settings`} variant="outline" size="sm" className="h-8 px-2.5 text-xs"><Settings2 className="h-3.5 w-3.5" /> Settings</Button>
      <Button href={`/admin/feedback/${id}?tab=questions`} variant="ghost" size="sm" className="h-8 px-2.5 text-xs"><ListChecks className="h-3.5 w-3.5" /> Questions</Button>
      <Button href={`/admin/feedback/${id}?tab=responses`} variant="ghost" size="sm" className="h-8 px-2.5 text-xs"><MessageSquareText className="h-3.5 w-3.5" /> Responses</Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => run(() => duplicateFeedbackForm(id))}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
      {!isDefault && <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => run(() => makeDefaultFeedbackForm(id))}><Star className="h-3.5 w-3.5" /> Make default</Button>}
      {isAdmin && <ConfirmButton variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50" message={`Delete "${name}"? Its questions and all responses are permanently removed.`} onConfirm={() => run(() => deleteFeedbackForm(id))}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>}
    </div>
  );
}
