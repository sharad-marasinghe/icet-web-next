"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, useToast } from "@/components/admin/ui";
import { setWorkshopStatus, deleteWorkshop } from "@/app/admin/(dashboard)/registry/workshops/actions";
import { IssueCertificatesButton } from "./issue-certificates";

export function WorkshopRowActions({ id, title, status, isAdmin }: { id: number; title: string; status: string; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; message?: string } | null>) => {
    setBusy(true);
    try {
      const r = await fn();
      toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", message: e instanceof Error ? e.message : "Action failed" });
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button href={`/admin/registry/workshops/${id}`} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      {status === "completed" ? (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setWorkshopStatus(id, "active"))}><RotateCcw className="h-3.5 w-3.5" /> Reactivate</Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setWorkshopStatus(id, "completed"))}><CheckCircle2 className="h-3.5 w-3.5" /> Mark completed</Button>
      )}
      <IssueCertificatesButton workshopId={id} workshopTitle={title} status={status} variant="ghost" size="sm">Issue certificates</IssueCertificatesButton>
      {isAdmin && (
        <ConfirmButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" message={`Delete "${title}"? All enrolments and attendance records for this workshop will be removed. Certificates already issued are kept.`} onConfirm={() => run(() => deleteWorkshop(id))}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ConfirmButton>
      )}
    </div>
  );
}
