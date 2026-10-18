"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Eye, Copy, Trash2, Loader2 } from "lucide-react";
import type { ActionState } from "@/components/admin/ui";
import { useToast } from "@/components/admin/ui";
import { startTopLoader } from "@/components/ui/top-loader";

type Action = (id: string) => Promise<ActionState>;

/** Icon row actions for list tables: edit / view live / duplicate / delete (confirm). */
export function RowActions({ id, editHref, viewHref, onDuplicate, onDelete, deleteMessage = "Delete this item? This cannot be undone.", editBase }: { id: string; editHref: string; viewHref?: string; onDuplicate?: Action; onDelete?: Action; deleteMessage?: string; editBase?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<"dup" | "del" | null>(null);
  const run = async (kind: "dup" | "del", fn: Action) => {
    setBusy(kind);
    try {
      const res = await fn(id);
      if (res?.message) toast({ tone: res.ok ? "success" : "error", message: res.message });
      if (res?.ok) {
        if (kind === "dup" && res.id && editBase) {
          startTopLoader();
          router.push(`${editBase}/${res.id}`);
        }
        else router.refresh();
      }
    } catch (e) {
      toast({ tone: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };
  const cls = "grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40";
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Link href={editHref} className={cls} title="Edit" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
      {viewHref && <a href={viewHref} target="_blank" rel="noopener noreferrer" className={cls} title="View live" aria-label="View live"><Eye className="h-4 w-4" /></a>}
      {onDuplicate && <button type="button" onClick={() => run("dup", onDuplicate)} disabled={busy !== null} className={cls} title="Duplicate" aria-label="Duplicate">{busy === "dup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}</button>}
      {onDelete && <button type="button" onClick={() => { if (confirm(deleteMessage)) run("del", onDelete); }} disabled={busy !== null} className={cls + " hover:text-rose-600"} title="Delete" aria-label="Delete">{busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
    </div>
  );
}
