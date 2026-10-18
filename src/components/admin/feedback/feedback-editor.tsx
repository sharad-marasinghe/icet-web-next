"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Plus, Save, Star, Eye, Download, ExternalLink } from "lucide-react";
import { cn, formatDateTime, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, AInput, ASelect, AField, ATextarea, Toggle, SubmitButton, ActionToast, initialActionState, Modal, useToast, ConfirmButton, Pagination, type ActionState } from "@/components/admin/ui";
import { RichText } from "@/components/admin/rich-text";
import type { FeedbackForm, FeedbackQuestion } from "@/lib/feedback";
import { saveFeedbackForm, saveQuestion, deleteQuestion, reorderQuestions, deleteResponses, deleteAllResponses } from "@/app/admin/(dashboard)/feedback/actions";
import { FEEDBACK_TYPES, qs } from "@/components/admin/registry/shared";
import { CopyButton } from "@/components/admin/registry/copy-button";

/* ───────────── Settings ───────────── */
export function FeedbackSettingsForm({ form, siteUrl }: { form: FeedbackForm | null; siteUrl: string }) {
  const router = useRouter();
  const [state, action] = useActionState(saveFeedbackForm, initialActionState);
  const [name, setName] = React.useState(form?.name || "");
  const [slugInput, setSlugInput] = React.useState(form?.slug || "");
  const [slugTouched, setSlugTouched] = React.useState(!!form);
  const slug = slugTouched ? slugInput : slugify(name);
  const [intro, setIntro] = React.useState(form?.intro_html || "");
  const [active, setActive] = React.useState(form ? form.is_active : true);
  const errors = state?.errors || {};
  React.useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const url = slug ? `${siteUrl}/feedback/${slug}` : "";
  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <ActionToast state={state} />
      {form && <input type="hidden" name="id" value={form.id} />}
      <div className="space-y-6">
        <Panel title="Form">
          <div className="grid gap-4 sm:grid-cols-2">
            <AField label="Form name" required error={errors.name} hint="Only visible to staff."><AInput name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} placeholder="e.g. Workshop feedback" /></AField>
            <AField label="Slug" error={errors.slug} hint={url || "Public URL: /feedback/<slug>"}><AInput name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlugInput(slugify(e.target.value)); }} /></AField>
            <div className="sm:col-span-2"><p className="mb-1.5 text-sm font-semibold text-slate-700">Intro text</p><RichText value={intro} onChange={setIntro} name="intro_html" minHeight={120} placeholder="Shown above the questions" /></div>
            <AField label="Submit button text" error={errors.submit_label}><AInput name="submit_label" defaultValue={form?.submit_label || "Submit Feedback"} maxLength={60} /></AField>
            <div className="sm:col-span-2"><Toggle name="is_active" checked={active} onChange={setActive} label="Form is active" description="Inactive forms show a closed notice and are skipped when embedding the default form." /></div>
          </div>
        </Panel>
        <Panel title="Google review redirect" description="Happy respondents are sent to your Google Business review page; everyone else sees the thank-you message.">
          <div className="grid gap-4 sm:grid-cols-2">
            <AField label="Google review link" error={errors.google_review_url} hint="From Google Business Profile → Ask for reviews. Leave empty to never redirect." className="sm:col-span-2"><AInput name="google_review_url" type="url" defaultValue={form?.google_review_url || ""} placeholder="https://g.page/r/…/review" /></AField>
            <AField label="Only redirect if rating is at least" error={errors.redirect_min_rating} hint="Uses the first star-rating question.">
              <ASelect name="redirect_min_rating" defaultValue={form?.redirect_min_rating ?? 4}>
                <option value={0}>Always redirect</option><option value={2}>2 stars</option><option value={3}>3 stars</option><option value={4}>4 stars</option><option value={5}>5 stars only</option>
              </ASelect>
            </AField>
            <AField label="Thank-you message" error={errors.thankyou_message} hint="Shown to respondents who are not redirected."><ATextarea name="thankyou_message" defaultValue={form?.thankyou_message || "Thank you for your feedback!"} rows={3} maxLength={1000} /></AField>
          </div>
        </Panel>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
        <Panel title={form ? "Form" : "New form"}>
          <div className="space-y-3">
            <SubmitButton className="w-full"><Save className="h-4 w-4" /> {form ? "Save settings" : "Create form"}</SubmitButton>
            {form && url && <div className="flex items-center gap-2"><Button href={url} external variant="ghost" size="sm" className="flex-1"><ExternalLink className="h-4 w-4" /> Open public form</Button><CopyButton value={url} label="Copy" /></div>}
            {form?.is_default && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800"><Star className="mr-1 inline h-3.5 w-3.5" /> This is the default form, used by Form blocks that do not name a slug.</p>}
          </div>
        </Panel>
      </aside>
    </form>
  );
}

/* ───────────── Questions ───────────── */
export function QuestionsManager({ formId, questions }: { formId: number; questions: FeedbackQuestion[] }) {
  const dndId = React.useId();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = React.useState(questions);
  const [prevQuestions, setPrevQuestions] = React.useState(questions);
  const [editing, setEditing] = React.useState<FeedbackQuestion | null | "new">(null);
  if (prevQuestions !== questions) { setPrevQuestions(questions); setItems(questions); }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
    setItems(next);
    const r = await reorderQuestions(formId, next.map((q) => q.id));
    if (!r?.ok) toast({ tone: "error", message: r?.message || "Could not save order" });
    router.refresh();
  };
  return (
    <Panel title="Questions" description="Drag to reorder. Info text blocks display a paragraph without an input and are excluded from responses." actions={<Button type="button" size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add question</Button>}>
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No questions yet. Add a star rating first so the Google redirect rule can work.</p> : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">{items.map((q, i) => <QuestionRow key={q.id} q={q} index={i} onEdit={() => setEditing(q)} onDeleted={() => router.refresh()} />)}</ul>
          </SortableContext>
        </DndContext>
      )}
      {editing && <QuestionModal formId={formId} question={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function QuestionRow({ q, index, onEdit, onDeleted }: { q: FeedbackQuestion; index: number; onEdit: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5", isDragging && "shadow-elev opacity-80")}>
      <button type="button" className="cursor-grab touch-none text-slate-400 hover:text-slate-600" aria-label="Drag to reorder" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      <span className="w-5 text-xs font-bold text-slate-400">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", q.field_type === "info" ? "italic text-slate-600" : "font-semibold text-slate-900")}>{q.question}{q.is_required && <span className="ml-1 text-rose-600">*</span>}</p>
        <p className="text-[11px] text-slate-500">{FEEDBACK_TYPES[q.field_type] || q.field_type}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      <ConfirmButton variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50" message="Delete this question? Existing answers stay stored but will no longer be shown by label." onConfirm={async () => { const r = await deleteQuestion(q.id); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); onDeleted(); }}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>
    </li>
  );
}

function QuestionModal({ formId, question, onClose }: { formId: number; question: FeedbackQuestion | null; onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(saveQuestion, initialActionState);
  const [type, setType] = React.useState(question?.field_type || "rating");
  const [required, setRequired] = React.useState(question?.is_required ?? false);
  React.useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state, router, onClose]);
  return (
    <Modal open onClose={onClose} title={question ? "Edit question" : "Add question"}>
      <form action={action} className="space-y-4">
        <ActionToast state={state} />
        <input type="hidden" name="form_id" value={formId} />
        {question && <input type="hidden" name="id" value={question.id} />}
        <AField label={type === "info" ? "Text to display" : "Question text"} required error={state?.errors?.question}><ATextarea name="question" defaultValue={question?.question || ""} rows={type === "info" ? 4 : 2} required /></AField>
        <AField label="Answer type" error={state?.errors?.field_type}>
          <ASelect name="field_type" value={type} onChange={(e) => setType(e.target.value as FeedbackQuestion["field_type"])}>{Object.entries(FEEDBACK_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</ASelect>
        </AField>
        {type !== "info" && <Toggle name="is_required" checked={required} onChange={setRequired} label="Required" />}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button><SubmitButton size="sm">{question ? "Save question" : "Add question"}</SubmitButton></div>
      </form>
    </Modal>
  );
}

/* ───────────── Responses ───────────── */
export type ResponseRow = { id: number; created_at: string; rating: number | null; redirected: boolean; answers: Record<string, string> };

export function ResponsesTable({ formId, rows, questions, total, avg, counts, rating, page, pages, isAdmin }: { formId: number; rows: ResponseRow[]; questions: FeedbackQuestion[]; total: number; avg: number | null; counts: Record<string, number>; rating: string; page: number; pages: number; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = React.useState<number[]>([]);
  const [view, setView] = React.useState<ResponseRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const qmap = new Map(questions.map((q) => [String(q.id), q]));
  const run = async (fn: () => Promise<ActionState>) => { setBusy(true); try { const r = await fn(); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "Done" }); setSel([]); router.refresh(); } finally { setBusy(false); } };
  const summary = (r: ResponseRow) => Object.entries(r.answers || {}).filter(([k]) => qmap.get(k)?.field_type !== "rating").map(([k, v]) => `${(qmap.get(k)?.question || k).slice(0, 30)}: ${v}`).join(" · ");
  const tabs: [string, string][] = [["", "All"], ["5", "5★"], ["4", "4★"], ["3", "3★"], ["2", "2★"], ["1", "1★"], ["none", "No rating"]];
  return (
    <Panel title="Responses" description={`${total.toLocaleString()} response${total === 1 ? "" : "s"}${avg !== null ? ` · average rating ${avg.toFixed(2)}` : ""}`} padded={false} actions={
      <div className="flex flex-wrap items-center gap-2">
        <Button href={`/admin/api/registry/feedback.csv?form_id=${formId}`} external variant="outline" size="sm"><Download className="h-4 w-4" /> Export CSV</Button>
        {isAdmin && total > 0 && <ConfirmButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" message={`Delete ALL ${total} responses of this form? This cannot be undone.`} onConfirm={() => run(() => deleteAllResponses(formId))}><Trash2 className="h-3.5 w-3.5" /> Delete all</ConfirmButton>}
      </div>
    }>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-2">
        {tabs.map(([v, l]) => <Link key={v} href={`/admin/feedback/${formId}${qs({ tab: "responses", rating: v })}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", rating === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}>{l}{v && counts[v] !== undefined ? <span className="ml-1 opacity-70">({counts[v]})</span> : null}</Link>)}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">{sel.length} selected<Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={!sel.length} loading={busy} onClick={() => { if (confirm(`Delete ${sel.length} selected response(s)?`)) run(() => deleteResponses(sel)); }}><Trash2 className="h-3.5 w-3.5" /> Delete selected</Button></div>
      </div>
      {rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No responses{rating ? " with this rating" : " yet"}.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="w-10 px-4 py-3"><input type="checkbox" checked={sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} className="h-4 w-4 rounded border-slate-300" aria-label="Select all" /></th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Answers</th><th className="px-4 py-3">Redirected</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/30">
                  <td className="px-4 py-2"><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} className="h-4 w-4 rounded border-slate-300" aria-label={`Select response ${r.id}`} /></td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-600">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-2"><Stars n={r.rating} /></td>
                  <td className="max-w-md truncate px-4 py-2 text-xs text-slate-700" title={summary(r)}>{summary(r) || <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2 text-xs">{r.redirected ? <span className="font-semibold text-green-700">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-2"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setView(r)}><Eye className="h-3.5 w-3.5" /> View</Button><ConfirmButton variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50" message="Delete this response?" onConfirm={() => run(() => deleteResponses([r.id]))}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 pb-4"><Pagination page={page} pages={pages} baseHref={`/admin/feedback/${formId}${qs({ tab: "responses", rating, page: "__PAGE__" })}`} /></div>
      {view && (
        <Modal open onClose={() => setView(null)} title={`Response #${view.id}`}>
          <p className="mb-3 text-xs text-slate-500">{formatDateTime(view.created_at)} · {view.redirected ? "Redirected to Google" : "Shown thank-you message"}</p>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {questions.filter((q) => q.field_type !== "info").map((q) => (
              <div key={q.id} className="px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{q.question}</dt><dd className="mt-1 text-sm text-slate-900">{q.field_type === "rating" ? <Stars n={view.answers[String(q.id)] ? Number(view.answers[String(q.id)]) : null} /> : view.answers[String(q.id)] || <span className="text-slate-400">—</span>}</dd></div>
            ))}
            {Object.entries(view.answers).filter(([k]) => !qmap.has(k)).map(([k, v]) => <div key={k} className="px-4 py-3"><dt className="text-xs font-semibold text-slate-400">Deleted question #{k}</dt><dd className="text-sm text-slate-900">{v}</dd></div>)}
          </dl>
        </Modal>
      )}
    </Panel>
  );
}

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-xs text-slate-400">—</span>;
  return <span className="inline-flex items-center gap-0.5" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("h-3.5 w-3.5", i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />)}</span>;
}
