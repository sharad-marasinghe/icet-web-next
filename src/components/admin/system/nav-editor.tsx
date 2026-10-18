"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { GripVertical, ChevronDown, ChevronRight, Trash2, Plus, Save, RotateCcw, ExternalLink, CornerDownRight } from "lucide-react";
import type { NavItem } from "@/lib/data/settings";
import { cn } from "@/lib/utils";
import { Tabs, Panel, SubmitButton, ActionToast, initialActionState, Toggle, ConfirmButton, useToast, FieldError } from "@/components/admin/ui";
import { MENU_SLUGS, MENU_TITLES, type MenuSlug } from "./nav-types";
import { inputCompact } from "./helpers";
import { saveMenu, resetMenu } from "@/app/admin/(dashboard)/navigation/actions";

export type SlugOption = { label: string; href: string; group: string };

const newId = () => Math.random().toString(36).slice(2, 8);
const toKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();
const iconSet = new Set<string>(iconNames);

function IconPreview({ name }: { name?: string }) {
  const kebab = name ? toKebab(name) : "";
  if (!kebab || !iconSet.has(kebab)) return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">icon</span>;
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600"><DynamicIcon name={kebab as IconName} className="h-4 w-4" /></span>;
}

function HrefField({ value, onChange, options, error }: { value: string; onChange: (v: string) => void; options: SlugOption[]; error?: string }) {
  const groups = Array.from(new Set(options.map((o) => o.group)));
  const matched = options.some((o) => o.href === value);
  return (
    <div>
      <div className="flex gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/path or https://" className={cn(inputCompact, "min-w-0 flex-1 font-mono text-xs", error && "border-rose-400")} />
        <select value={matched ? value : ""} onChange={(e) => e.target.value && onChange(e.target.value)} className={cn(inputCompact, "w-[130px] shrink-0 text-xs")} aria-label="Pick a page">
          <option value="">Pick a page…</option>
          {groups.map((g) => <optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.href} value={o.href}>{o.label}</option>)}</optgroup>)}
        </select>
      </div>
      <FieldError error={error} />
    </div>
  );
}

type RowProps = { item: NavItem; onChange: (n: NavItem) => void; onRemove: () => void; options: SlugOption[]; allowChildren: boolean; errors: Record<string, string>; path: string; depth?: number };

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-80")}>
      <ItemRow {...props} handle={<button type="button" className="grid h-9 w-7 cursor-grab place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>} />
    </div>
  );
}

function ItemRow({ item, onChange, onRemove, options, allowChildren, errors, path, depth = 0, handle }: RowProps & { handle: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const err = (k: string) => errors[`${path}.${k}`];
  const hasErr = Object.keys(errors).some((k) => k.startsWith(path + "."));
  const children = item.children || [];
  const set = (p: Partial<NavItem>) => onChange({ ...item, ...p });
  const setChildren = (c: NavItem[]) => onChange({ ...item, children: c.length ? c : undefined });
  return (
    <div className={cn("rounded-xl border bg-white", hasErr ? "border-rose-300" : "border-slate-200", depth > 0 && "bg-slate-50/60")}>
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-start">
        <div className="flex items-start gap-1">
          {handle}
          <IconPreview name={item.icon} />
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <div>
            <input value={item.label} onChange={(e) => set({ label: e.target.value })} placeholder="Label" className={cn(inputCompact, "w-full font-semibold", err("label") && "border-rose-400")} />
            <FieldError error={err("label")} />
          </div>
          <HrefField value={item.href} onChange={(v) => set({ href: v })} options={options} error={err("href")} />
        </div>
        <div className="flex items-center gap-1 self-end sm:self-start">
          {item.external && <span title="Opens in a new tab"><ExternalLink className="h-3.5 w-3.5 text-slate-400" /></span>}
          {item.highlight && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">CTA</span>}
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" aria-expanded={open}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} {children.length ? `${children.length} sub-item${children.length > 1 ? "s" : ""}` : "Options"}
          </button>
          <button type="button" onClick={onRemove} className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">Description <span className="font-normal text-slate-400">(dropdowns)</span>
              <input value={item.description || ""} onChange={(e) => set({ description: e.target.value })} className={cn(inputCompact, "mt-1 w-full font-normal")} placeholder="Short one-liner shown under the label" />
              <FieldError error={err("description")} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Icon <span className="font-normal text-slate-400">(lucide name, e.g. GraduationCap)</span>
              <input value={item.icon || ""} onChange={(e) => set({ icon: e.target.value.replace(/[^A-Za-z0-9]/g, "") })} className={cn(inputCompact, "mt-1 w-full font-normal")} placeholder="GraduationCap" list="lucide-icon-names" />
              <FieldError error={err("icon")} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Badge <span className="font-normal text-slate-400">(optional, e.g. New)</span>
              <input value={item.badge || ""} onChange={(e) => set({ badge: e.target.value })} className={cn(inputCompact, "mt-1 w-full font-normal")} />
            </label>
            {depth === 0 && allowChildren && (
              <label className="block text-xs font-semibold text-slate-600">Mega menu
                <select value={item.mega || ""} onChange={(e) => set({ mega: e.target.value === "programs" ? "programs" : null })} className={cn(inputCompact, "mt-1 w-full font-normal")}>
                  <option value="">None (simple dropdown)</option>
                  <option value="programs">Programmes mega menu</option>
                </select>
              </label>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            <Toggle checked={!!item.external} onChange={(v) => set({ external: v })} label="Open in new tab" />
            {depth === 0 && <Toggle checked={!!item.highlight} onChange={(v) => set({ highlight: v })} label="Highlight as button" />}
          </div>
          {allowChildren && depth === 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500"><CornerDownRight className="h-3.5 w-3.5" /> Sub-items</p>
              <SortableList items={children} onChange={setChildren} options={options} allowChildren={false} errors={errors} path={`${path}.children`} depth={1} />
              <button type="button" onClick={() => setChildren([...children, { id: newId(), label: "", href: "/" }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="h-4 w-4" /> Add sub-item</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortableList({ items, onChange, options, allowChildren, errors, path, depth = 0 }: { items: NavItem[]; onChange: (items: NavItem[]) => void; options: SlugOption[]; allowChildren: boolean; errors: Record<string, string>; path: string; depth?: number }) {
  const dndId = React.useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  }
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">No items yet.</p>;
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <SortableRow key={it.id} item={it} options={options} allowChildren={allowChildren} errors={errors} path={`${path}.${idx}`} depth={depth}
              onChange={(n) => onChange(items.map((x) => (x.id === it.id ? n : x)))}
              onRemove={() => onChange(items.filter((x) => x.id !== it.id))} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function MenuPanel({ slug, items, setItems, defaults, updated, options }: { slug: MenuSlug; items: NavItem[]; setItems: (i: NavItem[]) => void; defaults: NavItem[]; updated: string | null; options: SlugOption[] }) {
  const [state, action] = useActionState(saveMenu, initialActionState);
  const toast = useToast();
  const router = useRouter();
  const [dirty, setDirty] = React.useState(false);
  const [seen, setSeen] = React.useState(state);
  if (state !== seen) { setSeen(state); if (state?.ok) setDirty(false); }
  const errors = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(state?.errors || {})) out[`items.${k}`] = v;
    return out;
  }, [state]);
  const change = (i: NavItem[]) => { setItems(i); setDirty(true); };
  const isHeader = slug === "header";
  return (
    <form action={action}>
      <ActionToast state={state} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <Panel title={MENU_TITLES[slug]} description={isHeader ? "Top-level links can have one level of sub-items shown as a dropdown or the programmes mega menu." : "Flat list of links shown in the footer column."}
        actions={<div className="flex items-center gap-2">
          <ConfirmButton variant="outline" message="Replace this menu with the built-in default items? Unsaved edits will be lost." onConfirm={async () => { const r = await resetMenu(slug); toast({ tone: r?.ok ? "success" : "error", message: r?.message || "" }); if (r?.ok) { setItems(defaults); setDirty(false); router.refresh(); } }}><RotateCcw className="h-4 w-4" /> Reset to defaults</ConfirmButton>
          <SubmitButton size="sm"><Save className="h-4 w-4" /> Save menu</SubmitButton>
        </div>}>
        <SortableList items={items} onChange={change} options={options} allowChildren={isHeader} errors={errors} path="items" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => change([...items, { id: newId(), label: "", href: "/" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="h-4 w-4" /> Add item</button>
          <p className="text-xs text-slate-500">{dirty ? "Unsaved changes" : updated ? `Saved ${new Date(updated).toLocaleString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}` : "Using built-in defaults (not yet saved)"}</p>
        </div>
      </Panel>
    </form>
  );
}

export function NavEditor({ initial, defaults, updated, options }: { initial: Record<string, NavItem[]>; defaults: Record<string, NavItem[]>; updated: Record<string, string | null>; options: SlugOption[] }) {
  const [tab, setTab] = React.useState<MenuSlug>("header");
  const [menus, setMenus] = React.useState(initial);
  return (
    <div className="space-y-4">
      <datalist id="lucide-icon-names">{iconNames.slice(0, 1500).map((n) => <option key={n} value={n.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")} />)}</datalist>
      <Tabs tabs={MENU_SLUGS.map((s) => ({ id: s, label: MENU_TITLES[s].replace("Footer · ", "Footer: "), count: menus[s]?.length }))} active={tab} onChange={(id) => setTab(id as MenuSlug)} />
      {MENU_SLUGS.map((slug) => slug === tab && (
        <MenuPanel key={slug} slug={slug} items={menus[slug] || []} setItems={(i) => setMenus((m) => ({ ...m, [slug]: i }))} defaults={defaults[slug] || []} updated={updated[slug]} options={options} />
      ))}
    </div>
  );
}
