"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { AField, AInput, Toggle, useToast } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/admin/rich-text";
import { SortableList } from "@/components/admin/content/sortable-list";
import { cn, stripHtml } from "@/lib/utils";
import { deleteFaq, reorderFaqs, saveFaq, toggleFaq } from "../actions";

export type FaqRow = { id: string; question: string; answer: string; is_active: boolean; sort_order: number };
type Draft = { id?: string; question: string; answer: string; is_active: boolean };

export function QuestionsManager({ groupId, faqs }: { groupId: string; faqs: FaqRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = React.useState(faqs);
  const [prev, setPrev] = React.useState(faqs);
  if (faqs !== prev) { setPrev(faqs); setItems(faqs); }
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await saveFaq({ ...editing, group_id: groupId });
      if (res?.ok) { toast({ tone: "success", message: res.message || "Saved" }); setEditing(null); setErrors({}); router.refresh(); }
      else { setErrors(res?.errors || {}); toast({ tone: "error", message: res?.message || "Could not save" }); }
    } finally { setBusy(false); }
  };
  const remove = async (f: FaqRow) => {
    if (!confirm(`Delete “${f.question}”?`)) return;
    setItems((xs) => xs.filter((x) => x.id !== f.id));
    const res = await deleteFaq(f.id);
    toast({ tone: res?.ok ? "success" : "error", message: res?.message || "" });
    router.refresh();
  };
  const toggle = async (f: FaqRow, v: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === f.id ? { ...x, is_active: v } : x)));
    const res = await toggleFaq(f.id, v);
    if (!res?.ok) toast({ tone: "error", message: res?.message || "Could not update" });
    router.refresh();
  };
  const reorder = async (next: FaqRow[]) => {
    setItems(next);
    const res = await reorderFaqs(groupId, next.map((f) => f.id));
    if (!res?.ok) toast({ tone: "error", message: res?.message || "Could not save order" });
    router.refresh();
  };

  const editor = editing && (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4">
      <div className="space-y-4">
        <AField label="Question" htmlFor="faq_question" required error={errors.question}>
          <AInput id="faq_question" value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} placeholder="How long does the programme take?" autoFocus />
        </AField>
        <AField label="Answer" error={errors.answer}>
          <RichText value={editing.answer} onChange={(html) => setEditing({ ...editing, answer: html })} compact minHeight={120} placeholder="Write the answer…" />
        </AField>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Toggle checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} label="Visible on the website" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(null); setErrors({}); }}>Cancel</Button>
            <Button type="button" size="sm" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing.id ? "Save question" : "Add question"}</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {editing && !editing.id && editor}
      {items.length === 0 && !editing && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">No questions in this group yet.</div>
      )}
      <SortableList
        items={items}
        getId={(f) => f.id}
        onReorder={(next) => void reorder(next)}
        className="space-y-2"
        renderItem={(f, { handle, index }) => {
          const isEditing = editing?.id === f.id;
          const open = expanded === f.id;
          return (
            <div className={cn("rounded-xl border bg-white", isEditing ? "border-brand-300" : "border-slate-200", !f.is_active && "opacity-70")}>
              {isEditing ? (
                <div className="p-1">{editor}</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-2 py-2">
                    {handle}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">{index + 1}</span>
                    <button type="button" onClick={() => setExpanded(open ? null : f.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="truncate text-sm font-semibold text-slate-900">{f.question}</span>
                      {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
                    </button>
                    <Toggle checked={f.is_active} onChange={(v) => toggle(f, v)} />
                    <button type="button" onClick={() => { setEditing({ id: f.id, question: f.question, answer: f.answer, is_active: f.is_active }); setErrors({}); }} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Edit question"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => remove(f)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete question"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {open ? (
                    <div className="prose-icet border-t border-slate-100 px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: f.answer }} />
                  ) : (
                    <p className="truncate px-11 pb-2 text-xs text-slate-500">{stripHtml(f.answer) || <span className="italic">No answer yet</span>}</p>
                  )}
                </>
              )}
            </div>
          );
        }}
      />
      {!editing && (
        <Button type="button" variant="outline" size="sm" onClick={() => { setEditing({ question: "", answer: "", is_active: true }); setErrors({}); }}><Plus className="h-4 w-4" /> Add question</Button>
      )}
    </div>
  );
}
