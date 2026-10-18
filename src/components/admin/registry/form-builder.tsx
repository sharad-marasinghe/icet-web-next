"use client";

import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Type, Minus, Copy, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, X, Lock, Eye, ListChecks } from "lucide-react";
import { cn, fieldKeyFromLabel } from "@/lib/utils";
import { AInput, ASelect, AField, Toggle, Tabs } from "@/components/admin/ui";
import { RichText } from "@/components/admin/rich-text";
import { RegistrationForm } from "@/components/forms/registration-form";
import {
  QUESTION_TYPES, STANDARD_FIELDS, IDENTITY_FIELDS, canFilter, isChoice, isLayout, sanitizeConfig, type FieldConfig, type FieldType, type FormFields,
} from "@/lib/registry/fields";

export type FormBuilderProps = {
  /** Hidden input name that receives the serialised JSON definition. */
  name: string;
  /** Existing definition (keys are seeded as frozen). */
  initial: FormFields;
  /** Allow the "File upload" question type (academic batches only). */
  allowFiles?: boolean;
  /** Preview tab context. */
  preview: { mode: "workshop" | "batch"; title: string; description?: string };
  onChange?: (fields: FormFields) => void;
};

type Item = { uid: string; key: string; frozen: boolean; conf: FieldConfig };

const uid = () => Math.random().toString(36).slice(2, 10);
const TEXTUAL = ["text", "tel", "email", "textarea"];
const BOUNDED = ["number", "date"];

function blank(type: FieldType, label = ""): FieldConfig {
  // sanitizeConfig falls back to a label derived from the key; new questions must start empty.
  return { ...sanitizeConfig("x", { enabled: true, required: false, type, label, width: "full", selection_mode: "single", options: [] }), label };
}

function toItems(form: FormFields): { items: Item[]; disabledIdentity: string[] } {
  const items: Item[] = [];
  const disabledIdentity: string[] = [];
  for (const [key, conf] of Object.entries(form || {})) {
    if (!conf) continue;
    if (!conf.enabled) {
      if (key in IDENTITY_FIELDS) disabledIdentity.push(key);
      continue;
    }
    items.push({ uid: uid(), key, frozen: true, conf: { ...conf, options: [...(conf.options || [])] } });
  }
  return { items, disabledIdentity };
}

function uniqueKey(base: string, taken: Set<string>) {
  const k = /^\d+$/.test(base) ? `f_${base}` : base;
  if (!taken.has(k)) return k;
  for (let i = 2; i < 1000; i++) {
    if (!taken.has(`${k}_${i}`)) return `${k}_${i}`;
  }
  return `${k}_${uid()}`;
}

function serialise(items: Item[], disabledIdentity: string[]): FormFields {
  const out: FormFields = {};
  for (const it of items) out[it.key] = { ...it.conf, enabled: true, label: it.conf.label || STANDARD_FIELDS[it.key] || it.key };
  for (const k of disabledIdentity) {
    if (!(k in out)) out[k] = sanitizeConfig(k, { enabled: false, required: false, type: IDENTITY_FIELDS[k], label: STANDARD_FIELDS[k] });
  }
  return out;
}

export function FormBuilder({ name, initial, allowFiles, preview, onChange }: FormBuilderProps) {
  const dndId = React.useId();
  const seeded = React.useMemo(() => toItems(initial), [initial]);
  const [items, setItems] = React.useState<Item[]>(seeded.items);
  const [disabledIdentity, setDisabledIdentity] = React.useState<string[]>(seeded.disabledIdentity);
  const [open, setOpen] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"questions" | "preview">("questions");
  const [menu, setMenu] = React.useState(false);
  const serialised = React.useMemo(() => serialise(items, disabledIdentity), [items, disabledIdentity]);
  const json = React.useMemo(() => JSON.stringify(serialised), [serialised]);
  React.useEffect(() => { onChange?.(serialised); }, [serialised, onChange]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const takenKeys = React.useMemo(() => new Set(items.map((i) => i.key)), [items]);

  const update = (id: string, patch: Partial<Item> | ((it: Item) => Item)) =>
    setItems((list) => list.map((it) => (it.uid === id ? (typeof patch === "function" ? patch(it) : { ...it, ...patch }) : it)));

  const addItem = (item: Item, afterUid?: string | null) => {
    setItems((list) => {
      const idx = afterUid ? list.findIndex((i) => i.uid === afterUid) : -1;
      const copy = [...list];
      copy.splice(idx >= 0 ? idx + 1 : copy.length, 0, item);
      return copy;
    });
    setOpen(item.uid);
    setMenu(false);
  };

  const addStandard = (key: string) => {
    const type: FieldType = key in IDENTITY_FIELDS ? IDENTITY_FIELDS[key] : key === "student_phone" ? "tel" : "text";
    const conf = blank(type, STANDARD_FIELDS[key]);
    conf.required = key in IDENTITY_FIELDS;
    setDisabledIdentity((d) => d.filter((k) => k !== key));
    addItem({ uid: uid(), key, frozen: true, conf }, open);
  };
  const addCustom = () => addItem({ uid: uid(), key: uniqueKey("question", takenKeys), frozen: false, conf: blank("text", "") }, open);
  const addHeading = () => addItem({ uid: uid(), key: uniqueKey(`heading_${uid().slice(0, 4)}`, takenKeys), frozen: true, conf: blank("heading", "Section title") }, open);
  const addSection = () => addItem({ uid: uid(), key: uniqueKey(`page_${uid().slice(0, 4)}`, takenKeys), frozen: true, conf: blank("section", "Next page") }, open);

  const duplicate = (it: Item) => {
    // Copies are always custom questions: a fresh, unfrozen key derived from the label.
    const base = isLayout(it.conf.type) ? `${it.conf.type}_${uid().slice(0, 4)}` : fieldKeyFromLabel(it.conf.label || "question");
    const copy: Item = { uid: uid(), key: uniqueKey(base, takenKeys), frozen: isLayout(it.conf.type), conf: { ...it.conf, options: [...it.conf.options] } };
    addItem(copy, it.uid);
  };
  const remove = (it: Item) => {
    if (it.key in IDENTITY_FIELDS) {
      const msg = it.key === "student_email"
        ? "Remove the email field?\n\nRegistrants will not receive a confirmation or certificate email, duplicate registrations cannot be detected, and the Resend/Issue certificate email actions will be unavailable for these students."
        : "Remove the name field?\n\nRegistrants will be recorded as \"Applicant\" and certificates cannot show a name.";
      if (!confirm(msg)) return;
      setDisabledIdentity((d) => (d.includes(it.key) ? d : [...d, it.key]));
    } else if (!confirm(`Delete "${it.conf.label || it.key}"?`)) return;
    setItems((list) => list.filter((x) => x.uid !== it.uid));
    if (open === it.uid) setOpen(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((list) => arrayMove(list, list.findIndex((i) => i.uid === active.id), list.findIndex((i) => i.uid === over.id)));
  };

  const unusedStandard = Object.keys(STANDARD_FIELDS).filter((k) => !takenKeys.has(k));

  return (
    <div>
      <input type="hidden" name={name} value={json} />
      <Tabs tabs={[{ id: "questions", label: "Questions", count: items.filter((i) => !isLayout(i.conf.type)).length }, { id: "preview", label: <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> Preview</span> }]} active={tab} onChange={(id) => setTab(id as "questions" | "preview")} />
      {tab === "questions" ? (
        <div className="mt-4 flex gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            {items.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No questions yet. Use the toolbar to add standard fields, a custom question, a heading or a page break.</div>}
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
                {items.map((it, idx) => (
                  <QuestionCard
                    key={it.uid} item={it} index={idx} allowFiles={!!allowFiles} expanded={open === it.uid}
                    onToggle={() => setOpen(open === it.uid ? null : it.uid)}
                    onChange={(patch) => update(it.uid, patch)}
                    onDuplicate={() => duplicate(it)} onRemove={() => remove(it)}
                    takenKeys={takenKeys}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {disabledIdentity.length > 0 && (
              <p className="text-xs text-slate-500">Disabled identity fields: {disabledIdentity.map((k) => STANDARD_FIELDS[k]).join(", ")}. Add them back from the <strong>+</strong> menu.</p>
            )}
          </div>
          <div className="sticky top-24 flex h-fit flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} title="Add question" className="grid h-10 w-10 place-items-center rounded-lg text-brand-700 hover:bg-brand-50"><Plus className="h-5 w-5" /></button>
              {menu && (
                <div className="absolute right-12 top-0 z-20 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elev" onMouseLeave={() => setMenu(false)}>
                  <button type="button" onClick={addCustom} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-brand-50">
                    <ListChecks className="h-4 w-4 text-brand-600" /> Custom question
                  </button>
                  {unusedStandard.length > 0 && <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Standard fields</p>}
                  {unusedStandard.map((k) => (
                    <button key={k} type="button" onClick={() => addStandard(k)} className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                      <span>{STANDARD_FIELDS[k]}</span><code className="text-[11px] text-slate-400">{k}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={addHeading} title="Add title & description" className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Type className="h-5 w-5" /></button>
            <button type="button" onClick={addSection} title="Add page break" className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Minus className="h-5 w-5" /></button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-xs text-slate-500">This is how the form will look to the public. Submissions are disabled in the preview.</p>
          <div className="rounded-2xl bg-surface p-4 sm:p-6" onSubmitCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <RegistrationForm key={json} mode={preview.mode} targetId={0} title={preview.title || "Untitled"} description={preview.description} fields={serialised} showHeader />
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ item, index, expanded, allowFiles, onToggle, onChange, onDuplicate, onRemove, takenKeys }: {
  item: Item; index: number; expanded: boolean; allowFiles: boolean; onToggle: () => void;
  onChange: (patch: Partial<Item> | ((it: Item) => Item)) => void; onDuplicate: () => void; onRemove: () => void; takenKeys: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const c = item.conf;
  const layout = isLayout(c.type);
  const identity = item.key in IDENTITY_FIELDS;
  const setConf = (patch: Partial<FieldConfig>) => onChange((it) => ({ ...it, conf: { ...it.conf, ...patch } }));

  const onLabel = (label: string) => {
    onChange((it) => {
      const next: Item = { ...it, conf: { ...it.conf, label } };
      if (!it.frozen && !layout) {
        const others = new Set(takenKeys); others.delete(it.key);
        next.key = uniqueKey(fieldKeyFromLabel(label) || "question", others);
      }
      return next;
    });
  };
  const setType = (type: FieldType) => {
    const patch: Partial<FieldConfig> = { type };
    if (!isChoice(type)) { patch.options = []; patch.selection_mode = "single"; }
    if (!canFilter(type)) patch.filterable = false;
    if (!TEXTUAL.includes(type)) { patch.pattern = ""; patch.maxlength = 0; }
    if (!BOUNDED.includes(type)) { patch.min = ""; patch.max = ""; }
    setConf(patch);
  };
  const setOption = (i: number, v: string) => setConf({ options: c.options.map((o, j) => (j === i ? v : o)) });
  const moveOption = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= c.options.length) return; setConf({ options: arrayMove(c.options, i, j) }); };

  const typeLabel = c.type === "section" ? "Page break" : c.type === "heading" ? "Title & description" : QUESTION_TYPES[c.type as keyof typeof QUESTION_TYPES];

  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-xl border bg-white shadow-sm", isDragging && "opacity-70 shadow-elev", expanded ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200", c.type === "section" && "border-dashed bg-slate-50")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" className="cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="text-[11px] font-bold text-slate-400">{index + 1}</span>
          <span className={cn("truncate text-sm font-semibold", c.type === "section" ? "text-slate-600" : "text-slate-900")}>
            {c.type === "section" && "— "}{c.label || <span className="italic text-slate-400">Untitled {typeLabel.toLowerCase()}</span>}{c.required && <span className="ml-1 text-rose-600">*</span>}
          </span>
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 sm:inline">{typeLabel}</span>
          {isChoice(c.type) && !expanded && <span className="hidden shrink-0 text-[11px] text-slate-400 md:inline">{c.options.length} option{c.options.length === 1 ? "" : "s"}</span>}
          {c.filterable && !expanded && <span className="hidden shrink-0 text-[11px] text-brand-600 md:inline">filterable</span>}
        </button>
        <code className="hidden shrink-0 items-center gap-1 text-[11px] text-slate-400 lg:inline-flex" title={item.frozen ? "Key is frozen (saved)" : "Key is generated from the label until saved"}>{item.frozen && <Lock className="h-3 w-3" />}{item.key}</code>
        <button type="button" onClick={onDuplicate} title="Duplicate" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Copy className="h-4 w-4" /></button>
        <button type="button" onClick={onRemove} title={identity ? "Remove identity field" : "Delete"} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label={expanded ? "Collapse" : "Expand"}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      </div>
      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <AField label={c.type === "section" ? "Page title" : c.type === "heading" ? "Title" : "Question"} required={!layout}>
              <AInput value={c.label} onChange={(e) => onLabel(e.target.value)} placeholder={layout ? "Optional" : "e.g. University / Company"} maxLength={200} />
            </AField>
            {!layout ? (
              <AField label="Type">
                <ASelect value={c.type} onChange={(e) => setType(e.target.value as FieldType)} disabled={identity}>
                  {Object.entries(QUESTION_TYPES).filter(([t]) => t !== "file" || allowFiles || c.type === "file").map(([t, l]) => <option key={t} value={t}>{l}</option>)}
                </ASelect>
              </AField>
            ) : (
              <AField label="Block"><AInput value={typeLabel} readOnly disabled /></AField>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">{layout ? "Description" : "Help text"} <span className="font-normal text-slate-400">(optional)</span></p>
            <RichText value={c.help} onChange={(h) => setConf({ help: h })} compact minHeight={60} placeholder="Shown under the label" />
          </div>
          {isChoice(c.type) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">Options</p>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Selection
                  <ASelect className="h-8 w-auto text-xs" value={c.selection_mode} onChange={(e) => setConf({ selection_mode: e.target.value as "single" | "multiple" })}>
                    <option value="single">Single</option><option value="multiple">Multiple</option>
                  </ASelect>
                </label>
              </div>
              <div className="space-y-1.5">
                {c.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
                    <AInput value={o} onChange={(e) => setOption(i, e.target.value)} className="h-9" placeholder={`Option ${i + 1}`} maxLength={200} />
                    <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => moveOption(i, 1)} disabled={i === c.options.length - 1} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setConf({ options: c.options.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setConf({ options: [...c.options, ""] })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Plus className="h-3.5 w-3.5" /> Add option</button>
            </div>
          )}
          {!layout && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-3">
              <Toggle checked={c.required} onChange={(v) => setConf({ required: v })} label="Required" />
              {canFilter(c.type) && <Toggle checked={c.filterable} onChange={(v) => setConf({ filterable: v })} label="Filterable" description="Index answers so applications can be filtered by this field" />}
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                Width
                <ASelect className="h-8 w-auto text-xs" value={c.width} onChange={(e) => setConf({ width: e.target.value as "full" | "half" })}>
                  <option value="full">Full</option><option value="half">Half</option>
                </ASelect>
              </label>
              <details className="w-full">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">Advanced</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {c.type !== "file" && <AField label="Placeholder"><AInput value={c.placeholder || ""} onChange={(e) => setConf({ placeholder: e.target.value })} maxLength={120} /></AField>}
                  {TEXTUAL.includes(c.type) && <AField label="Pattern (regex)" hint="Validated as ^(?:pattern)$"><AInput value={c.pattern} onChange={(e) => setConf({ pattern: e.target.value })} placeholder="e.g. 0[0-9]{9}" /></AField>}
                  {TEXTUAL.includes(c.type) && <AField label="Max length"><AInput type="number" min={0} max={5000} value={c.maxlength || ""} onChange={(e) => setConf({ maxlength: parseInt(e.target.value, 10) || 0 })} /></AField>}
                  {BOUNDED.includes(c.type) && <AField label="Minimum"><AInput type={c.type === "date" ? "date" : "number"} value={c.min} onChange={(e) => setConf({ min: e.target.value })} /></AField>}
                  {BOUNDED.includes(c.type) && <AField label="Maximum"><AInput type={c.type === "date" ? "date" : "number"} value={c.max} onChange={(e) => setConf({ max: e.target.value })} /></AField>}
                  <AField label="Field key" hint={item.frozen ? "Frozen: renaming the question keeps stored answers and CSV columns intact." : "Generated from the question; it is frozen once saved."}>
                    <AInput value={item.key} readOnly disabled className="font-mono text-xs" />
                  </AField>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
