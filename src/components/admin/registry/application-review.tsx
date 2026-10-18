"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { ASelect, ATextarea, AField, SubmitButton, ActionToast, initialActionState, ConfirmButton, useToast } from "@/components/admin/ui";
import { setApplicationStatus, deleteApplicationAction } from "@/app/admin/(dashboard)/registry/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "./shared";

export function ApplicationReviewForm({ id, status, notes, isAdmin, batchId }: { id: number; status: string; notes: string; isAdmin: boolean; batchId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(setApplicationStatus, initialActionState);
  React.useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      <ActionToast state={state} />
      <input type="hidden" name="id" value={id} />
      <AField label="Status">
        <ASelect name="status" defaultValue={status}>{APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}</ASelect>
      </AField>
      <AField label="Review notes" hint="Internal only; never shown to the applicant.">
        <ATextarea name="review_notes" defaultValue={notes} rows={5} placeholder="Interview outcome, missing documents, follow-ups…" />
      </AField>
      <div className="flex items-center justify-between gap-2">
        {isAdmin ? (
          <ConfirmButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" message="Delete this application and its uploaded documents? This cannot be undone." onConfirm={async () => { const r = await deleteApplicationAction(id); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); if (r?.ok) router.push(`/admin/registry/applications?batch_id=${batchId}`); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </ConfirmButton>
        ) : <span />}
        <SubmitButton size="sm"><Save className="h-4 w-4" /> Save review</SubmitButton>
      </div>
    </form>
  );
}
