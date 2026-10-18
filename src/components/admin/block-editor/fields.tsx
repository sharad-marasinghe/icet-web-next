"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { FieldSpec } from "@/lib/blocks/registry";
import { ICON_NAMES } from "@/lib/blocks/registry";
import type { ImageRef, Link as LinkValue } from "@/lib/blocks/types";
import { AField, AInput, ATextarea, ASelect, Toggle } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { TagsInput } from "@/components/admin/content/tags-input";
import { cn } from "@/lib/utils";
import { BlockIcon } from "./block-icon";
import { ListField } from "./list-field";

export type Data = Record<string, unknown>;

/** Renders a set of FieldSpecs as a two-column form bound to `data`. */
export function FieldsForm({ fields, data, onChange, nested }: { fields: FieldSpec[]; data: Data; onChange: (data: Data) => void; nested?: boolean }) {
  const set = (key: string, value: unknown) => {
    const next = { ...data };
    if (value === undefined || value === "" || value === null) delete next[key];
    else next[key] = value;
    onChange(next);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={cn(("width" in f && f.width === "half") ? "" : "sm:col-span-2")}>
          <FieldRenderer spec={f} value={data[f.key]} onChange={(v) => set(f.key, v)} nested={nested} />
        </div>
      ))}
    </div>
  );
}

export function FieldRenderer({ spec, value, onChange, nested }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void; nested?: boolean }) {
  const id = React.useId();
  const help = "help" in spec ? spec.help : undefined;
  const required = "required" in spec ? spec.required : false;
  const placeholder = "placeholder" in spec ? spec.placeholder : undefined;
  switch (spec.type) {
    case "text":
    case "url":
      return (
        <AField label={spec.label} htmlFor={id} hint={help} required={required}>
          <AInput id={id} type={spec.type === "url" ? "text" : "text"} inputMode={spec.type === "url" ? "url" : undefined} value={typeof value === "string" ? value : value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? (spec.type === "url" ? "/page or https://…" : undefined)} />
        </AField>
      );
    case "textarea":
      return (
        <AField label={spec.label} htmlFor={id} hint={help} required={required}>
          <ATextarea id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
        </AField>
      );
    case "richtext":
      return (
        <AField label={spec.label} hint={help} required={required}>
          <RichText value={typeof value === "string" ? value : ""} onChange={onChange} compact={!!nested} minHeight={nested ? 120 : 200} placeholder={placeholder} />
        </AField>
      );
    case "number":
      return (
        <AField label={spec.label} htmlFor={id} hint={help} required={required}>
          <AInput id={id} type="number" value={typeof value === "number" ? value : typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} placeholder={placeholder} />
        </AField>
      );
    case "color":
      return (
        <AField label={spec.label} htmlFor={id} hint={help} required={required}>
          <ColorInput id={id} value={typeof value === "string" ? value : ""} onChange={onChange} />
        </AField>
      );
    case "icon":
      return (
        <AField label={spec.label} htmlFor={id} hint={help} required={required}>
          <IconPicker id={id} value={typeof value === "string" ? value : ""} onChange={onChange} />
        </AField>
      );
    case "boolean":
      return (
        <div className="flex h-full items-end pb-1">
          <Toggle checked={!!value} onChange={(v) => onChange(v)} label={spec.label} description={help} />
        </div>
      );
    case "tags":
      return (
        <AField label={spec.label} htmlFor={id} hint={help ?? "Press Enter or comma after each entry."} required={required}>
          <TagsInput id={id} value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} placeholder={placeholder} />
        </AField>
      );
    case "image": {
      const img = (value && typeof value === "object" ? value : {}) as ImageRef;
      return <ImageField label={spec.label} value={img.url || ""} alt={img.alt || ""} onChange={(url) => onChange(url ? { ...img, url } : undefined)} onAltChange={(alt) => onChange({ ...img, url: img.url || "", alt })} hint={help} />;
    }
    case "link": {
      const link = (value && typeof value === "object" ? value : {}) as LinkValue;
      const set = (patch: Partial<LinkValue>) => {
        const next = { ...link, ...patch };
        onChange(!next.label && !next.href ? undefined : next);
      };
      return (
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{spec.label}</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_130px]">
            <AInput aria-label={`${spec.label} label`} value={link.label || ""} onChange={(e) => set({ label: e.target.value })} placeholder="Button label" />
            <AInput aria-label={`${spec.label} link`} value={link.href || ""} onChange={(e) => set({ href: e.target.value })} placeholder="/apply or https://…" />
            <ASelect aria-label={`${spec.label} style`} value={link.variant || ""} onChange={(e) => set({ variant: (e.target.value || undefined) as LinkValue["variant"] })}>
              <option value="">Default style</option>
              {["primary", "secondary", "outline", "white", "ghost", "accent"].map((v) => <option key={v} value={v}>{v}</option>)}
            </ASelect>
          </div>
          {help && <p className="mt-1.5 text-xs text-slate-500">{help}</p>}
        </fieldset>
      );
    }
    case "select":
      return (
        <AField label={spec.label} htmlFor={id} hint={help}>
          <ASelect id={id} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">— Select —</option>
            {spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </ASelect>
        </AField>
      );
    case "ref":
      return (
        <AField label={spec.label} htmlFor={id} hint={help}>
          <RefSelect id={id} entity={spec.entity} multiple={spec.multiple} value={value} onChange={onChange} />
        </AField>
      );
    case "list":
      return <ListField spec={spec} value={Array.isArray(value) ? (value as Data[]) : []} onChange={onChange} />;
    default:
      return null;
  }
}

/* ───────── Colour ───────── */
export function ColorInput({ id, value, onChange }: { id?: string; value: string; onChange: (v: string | undefined) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#046bd2";
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" aria-label="Pick colour" />
      <AInput id={id} value={value} onChange={(e) => onChange(e.target.value || undefined)} placeholder="#046BD2" className="font-mono uppercase" maxLength={9} />
    </div>
  );
}

/* ───────── Icon picker ───────── */
export function IconPicker({ id, value, onChange }: { id?: string; value: string; onChange: (v: string | undefined) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const list = q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : ICON_NAMES;
  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button id={id} type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} className="flex h-10 flex-1 items-center gap-2 rounded-l-lg border border-slate-300 bg-white px-3 text-left text-sm shadow-sm hover:border-brand-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100">
          {value ? <><BlockIcon name={value} className="h-4 w-4 text-brand-600" /><span className="flex-1 truncate">{value}</span></> : <span className="flex-1 text-slate-400">Choose an icon…</span>}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        <button type="button" onClick={() => onChange(undefined)} disabled={!value} className="grid h-10 w-9 place-items-center rounded-r-lg border border-l-0 border-slate-300 bg-white text-slate-400 hover:text-rose-600 disabled:opacity-40" aria-label="Clear icon"><X className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-elev">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons…" className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-2 text-sm outline-none focus:border-brand-600" onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { onChange(list[0]); setOpen(false); } }} />
          </div>
          <div role="listbox" className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {list.map((n) => (
              <button key={n} type="button" role="option" aria-selected={n === value} title={n} onClick={() => { onChange(n); setOpen(false); }} className={cn("grid aspect-square place-items-center rounded-md text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600", n === value && "bg-brand-600 text-white hover:bg-brand-700 hover:text-white")}>
                <BlockIcon name={n} className="h-4.5 w-4.5" />
              </button>
            ))}
            {list.length === 0 && <p className="col-span-full py-4 text-center text-xs text-slate-500">No icons match “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Ref select (options from /admin/api/content/refs) ───────── */
type Opt = { value: string; label: string };
const refCache = new Map<string, Promise<Opt[]>>();
export function loadRefOptions(entity: string): Promise<Opt[]> {
  let p = refCache.get(entity);
  if (!p) {
    p = fetch(`/admin/api/content/refs?entity=${encodeURIComponent(entity)}`, { cache: "no-store" }).then(async (r) => (r.ok ? ((await r.json()) as Opt[]) : [])).catch(() => []);
    refCache.set(entity, p);
    // let the next mount refetch fresh data after a short while
    setTimeout(() => refCache.delete(entity), 30_000);
  }
  return p;
}

export function RefSelect({ id, entity, multiple, value, onChange, placeholder = "— Any / none —" }: { id?: string; entity: string; multiple?: boolean; value: unknown; onChange: (v: unknown) => void; placeholder?: string }) {
  const [options, setOptions] = React.useState<Opt[] | null>(null);
  React.useEffect(() => {
    let alive = true;
    loadRefOptions(entity).then((o) => { if (alive) setOptions(o); });
    return () => { alive = false; };
  }, [entity]);
  if (multiple) {
    const arr = Array.isArray(value) ? value.map(String) : [];
    const opts = options ?? [];
    const unknown = arr.filter((v) => !opts.some((o) => o.value === v));
    return (
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 text-sm shadow-sm">
        {options === null && <p className="px-1 py-1 text-xs text-slate-400">Loading…</p>}
        {options && opts.length === 0 && unknown.length === 0 && <p className="px-1 py-1 text-xs text-slate-500">Nothing available yet.</p>}
        {[...opts, ...unknown.map((v) => ({ value: v, label: `${v} (missing)` }))].map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
            <input type="checkbox" checked={arr.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }
  const current = value == null ? "" : String(value);
  const opts = options ?? [];
  const missing = current && !opts.some((o) => o.value === current);
  return (
    <ASelect id={id} value={current} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{options === null ? "Loading…" : placeholder}</option>
      {missing && <option value={current}>{current} (not found)</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </ASelect>
  );
}
