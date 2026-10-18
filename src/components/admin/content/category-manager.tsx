"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Settings2, Loader2 } from "lucide-react";
import type { ActionState } from "@/components/admin/ui";
import { Modal, useToast, AInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { slugify, cn } from "@/lib/utils";

export type Category = { id: number; slug: string; name: string; color?: string };

/**
 * Multi-checkbox category selector + "Manage categories" modal (add / rename /
 * recolour / delete). The modal calls the server actions passed as props and
 * refreshes the router so the parent server component re-renders with fresh
 * categories.
 */
export function CategoryChecklist({ categories, value, onChange, name = "category_ids", withColor, onSave, onDelete, label = "Categories" }: { categories: Category[]; value: number[]; onChange: (ids: number[]) => void; name?: string; withColor?: boolean; onSave: (fd: FormData) => Promise<ActionState>; onDelete: (id: number) => Promise<ActionState>; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const toggle = (id: number, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Settings2 className="h-3.5 w-3.5" /> Manage</button>
      </div>
      {categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">No categories yet. Use “Manage” to add one.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {categories.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                {withColor && <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: c.color || "#046bd2" }} />}
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-400">{c.slug}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <CategoryManagerModal open={open} onClose={() => setOpen(false)} categories={categories} withColor={withColor} onSave={onSave} onDelete={onDelete} />
    </div>
  );
}

function Row({ c, onChange, onCommit, onCancel, isNew, withColor, busy }: { c: Category; onChange: (c: Category) => void; onCommit: () => void; onCancel?: () => void; isNew?: boolean; withColor?: boolean; busy: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-2">
      {withColor && <input type="color" value={c.color || "#046bd2"} onChange={(e) => onChange({ ...c, color: e.target.value })} className="h-9 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5" aria-label="Colour" />}
      <AInput value={c.name} onChange={(e) => onChange({ ...c, name: e.target.value })} placeholder="Name" className="h-9 min-w-[140px] flex-1" autoFocus={!isNew} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommit(); } }} />
      <AInput value={c.slug} onChange={(e) => onChange({ ...c, slug: e.target.value })} onBlur={(e) => onChange({ ...c, slug: slugify(e.target.value) })} placeholder={slugify(c.name) || "slug"} className="h-9 w-40 font-mono text-xs" />
      <Button type="button" size="sm" onClick={onCommit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {isNew ? "Add" : "Save"}</Button>
      {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /></Button>}
    </div>
  );
}

export function CategoryManagerModal({ open, onClose, categories, withColor, onSave, onDelete }: { open: boolean; onClose: () => void; categories: Category[]; withColor?: boolean; onSave: (fd: FormData) => Promise<ActionState>; onDelete: (id: number) => Promise<ActionState>; }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [draft, setDraft] = React.useState<Category>({ id: 0, slug: "", name: "", color: "#046bd2" });
  const [busy, setBusy] = React.useState(false);

  const submit = async (c: Category) => {
    if (!c.name.trim()) return toast({ tone: "error", message: "Name is required." });
    const fd = new FormData();
    if (c.id) fd.set("id", String(c.id));
    fd.set("name", c.name.trim());
    fd.set("slug", c.slug.trim() || slugify(c.name));
    if (withColor) fd.set("color", c.color || "#046bd2");
    setBusy(true);
    try {
      const res = await onSave(fd);
      toast({ tone: res?.ok ? "success" : "error", message: res?.message || (res?.ok ? "Saved" : "Could not save") });
      if (res?.ok) { setEditing(null); setDraft({ id: 0, slug: "", name: "", color: "#046bd2" }); router.refresh(); }
    } finally { setBusy(false); }
  };
  const remove = async (c: Category) => {
    if (!confirm(`Delete category “${c.name}”? It will be removed from all items.`)) return;
    setBusy(true);
    try {
      const res = await onDelete(c.id);
      toast({ tone: res?.ok ? "success" : "error", message: res?.message || (res?.ok ? "Deleted" : "Could not delete") });
      if (res?.ok) router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage categories" footer={<Button type="button" variant="outline" size="sm" onClick={onClose}>Done</Button>}>
      <div className="space-y-3">
        <Row c={draft} onChange={setDraft} onCommit={() => submit(draft)} isNew withColor={withColor} busy={busy} />
        {categories.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No categories yet.</p>}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {categories.map((c) => (
            <li key={c.id} className={cn("p-2", editing?.id === c.id && "bg-brand-50/30")}>
              {editing?.id === c.id ? (
                <Row c={editing} onChange={setEditing} onCommit={() => submit(editing)} onCancel={() => setEditing(null)} withColor={withColor} busy={busy} />
              ) : (
                <div className="flex items-center gap-3 px-1">
                  {withColor && <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c.color || "#046bd2" }} />}
                  <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                  <span className="font-mono text-xs text-slate-400">{c.slug}</span>
                  <span className="ml-auto flex gap-0.5">
                    <button type="button" onClick={() => setEditing(c)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label={`Rename ${c.name}`}><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => remove(c)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500"><Plus className="inline h-3 w-3" /> Add with the row above; press Enter to save.</p>
      </div>
    </Modal>
  );
}
