"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Star, UserRound } from "lucide-react";
import { StatusBadge, useToast } from "@/components/admin/ui";
import { SortableList } from "@/components/admin/content/sortable-list";
import { RowActions } from "@/components/admin/content/row-actions";
import { cn } from "@/lib/utils";
import { deleteTrainer, reorderTrainers, toggleTrainer } from "./actions";

export type TrainerRow = { id: string; slug: string; name: string; title: string; photo_url: string | null; is_featured: boolean; is_active: boolean; sort_order: number };

export function TrainerList({ rows, offset, canReorder }: { rows: TrainerRow[]; offset: number; canReorder: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = React.useState(rows);
  const [saving, setSaving] = React.useState(false);
  // Keep local order in sync when the server re-renders with new rows (after search / refresh).
  const [prevRows, setPrevRows] = React.useState(rows);
  if (rows !== prevRows) { setPrevRows(rows); setItems(rows); }

  const persist = async (next: TrainerRow[]) => {
    setItems(next);
    setSaving(true);
    try {
      const res = await reorderTrainers(next.map((t) => t.id), offset);
      if (!res?.ok) toast({ tone: "error", message: res?.message || "Could not save order" });
      else router.refresh();
    } finally { setSaving(false); }
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  };
  const toggle = async (t: TrainerRow, field: "is_active" | "is_featured") => {
    const value = !t[field];
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, [field]: value } : x)));
    const res = await toggleTrainer(t.id, field, value);
    if (!res?.ok) toast({ tone: "error", message: res?.message || "Could not update" });
    router.refresh();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 bg-slate-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[28px_minmax(0,1fr)_120px_110px_150px]">
        <span /><span>Trainer</span><span className="hidden sm:block">Featured</span><span className="hidden sm:block">Status</span><span className="text-right">{saving ? <span className="normal-case text-brand-600">Saving…</span> : canReorder ? "Order" : ""}</span>
      </div>
      <SortableList
        items={items}
        getId={(t) => t.id}
        onReorder={(next) => void persist(next)}
        disabled={!canReorder}
        className="divide-y divide-slate-100 bg-white"
        renderItem={(t, { handle, index }) => (
          <div className={cn("grid grid-cols-[28px_1fr_auto] items-center gap-3 px-3 py-2 hover:bg-brand-50/40 sm:grid-cols-[28px_minmax(0,1fr)_120px_110px_150px]", !t.is_active && "opacity-70")}>
            <div>{handle}</div>
            <Link href={`/admin/trainers/${t.id}`} className="flex min-w-0 items-center gap-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">{t.photo_url ? <Image src={t.photo_url} alt="" fill sizes="40px" className="object-cover" /> : <UserRound className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{t.name}</span><span className="block truncate text-xs text-slate-500">{t.title || <span className="italic text-slate-400">No designation</span>}</span></span>
            </Link>
            <div className="hidden sm:block">
              <button type="button" onClick={() => toggle(t, "is_featured")} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", t.is_featured ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-500 ring-slate-200 hover:text-slate-800")} aria-pressed={t.is_featured}><Star className={cn("h-3 w-3", t.is_featured && "fill-current")} /> {t.is_featured ? "Featured" : "Standard"}</button>
            </div>
            <div className="hidden sm:block"><button type="button" onClick={() => toggle(t, "is_active")} aria-pressed={t.is_active} title="Toggle active"><StatusBadge value={t.is_active ? "active" : "inactive"} /></button></div>
            <div className="flex items-center justify-end gap-0.5">
              {canReorder && (
                <>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                </>
              )}
              <RowActions id={t.id} editHref={`/admin/trainers/${t.id}`} onDelete={deleteTrainer} deleteMessage={`Delete trainer “${t.name}”?`} />
            </div>
          </div>
        )}
      />
    </div>
  );
}
