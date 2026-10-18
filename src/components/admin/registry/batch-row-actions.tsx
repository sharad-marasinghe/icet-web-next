"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Lock, Unlock, Trash2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, useToast } from "@/components/admin/ui";
import { setBatchOpen, deleteBatch } from "@/app/admin/(dashboard)/registry/batches/actions";

export function BatchRowActions({ id, name, isOpen, isAdmin }: { id: number; name: string; isOpen: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; message?: string } | null>) => {
    setBusy(true);
    try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); router.refresh(); }
    catch (e) { toast({ tone: "error", message: e instanceof Error ? e.message : "Action failed" }); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button href={`/admin/registry/applications?batch_id=${id}`} variant="ghost" size="sm"><ClipboardList className="h-3.5 w-3.5" /> Applications</Button>
      <Button href={`/admin/registry/batches/${id}`} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setBatchOpen(id, !isOpen))}>{isOpen ? <><Lock className="h-3.5 w-3.5" /> Close</> : <><Unlock className="h-3.5 w-3.5" /> Open</>}</Button>
      {isAdmin && <ConfirmButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" message={`Delete "${name}"? All applications and uploaded documents for this batch will be removed.`} onConfirm={() => run(() => deleteBatch(id))}><Trash2 className="h-3.5 w-3.5" /> Delete</ConfirmButton>}
    </div>
  );
}
