"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { FieldSpec } from "@/lib/blocks/registry";
import { SortableList } from "@/components/admin/content/sortable-list";
import { cn } from "@/lib/utils";
import { FieldsForm, type Data } from "./fields";

type ListSpec = Extract<FieldSpec, { type: "list" }>;

function itemTitle(spec: ListSpec, item: Data, index: number) {
  for (const f of spec.fields) {
    if ((f.type === "text" || f.type === "textarea") && typeof item[f.key] === "string" && (item[f.key] as string).trim()) return (item[f.key] as string).slice(0, 60);
  }
  return `${spec.itemLabel || "Item"} ${index + 1}`;
}

/** Repeatable, collapsible, sortable list of nested FieldSpec forms. */
export function ListField({ spec, value, onChange }: { spec: ListSpec; value: Data[]; onChange: (v: Data[] | undefined) => void }) {
  const [keys, setKeys] = React.useState<string[]>(() => value.map((_, i) => `i${i}`));
  const [open, setOpen] = React.useState<string[]>([]);
  const counter = React.useRef(value.length);
  const ks = keys.length === value.length ? keys : value.map((_, i) => keys[i] ?? `f${i}`);
  const nextKey = () => `k${++counter.current}`;
  const atMax = !!spec.max && value.length >= spec.max;

  const commit = (items: Data[], newKeys: string[]) => { setKeys(newKeys); onChange(items.length ? items : undefined); };
  const add = () => {
    if (atMax) return;
    const k = nextKey();
    commit([...value, {}], [...ks, k]);
    setOpen((o) => [...o, k]);
  };
  const remove = (i: number) => commit(value.filter((_, j) => j !== i), ks.filter((_, j) => j !== i));
  const duplicate = (i: number) => {
    if (atMax) return;
    const k = nextKey();
    const items = [...value]; items.splice(i + 1, 0, structuredClone(value[i]));
    const nk = [...ks]; nk.splice(i + 1, 0, k);
    commit(items, nk);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const items = [...value]; const nk = [...ks];
    [items[i], items[j]] = [items[j], items[i]];
    [nk[i], nk[j]] = [nk[j], nk[i]];
    commit(items, nk);
  };
  const update = (i: number, data: Data) => onChange(value.map((it, j) => (j === i ? data : it)));
  const rows = value.map((item, i) => ({ key: ks[i], item }));

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{spec.label} <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-600">{value.length}{spec.max ? `/${spec.max}` : ""}</span></p>
        <button type="button" onClick={add} disabled={atMax} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Add {spec.itemLabel?.toLowerCase() || "item"}</button>
      </div>
      {spec.help && <p className="mb-2 text-xs text-slate-500">{spec.help}</p>}
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">No {spec.itemLabel?.toLowerCase() || "item"}s yet.</p>
      ) : (
        <SortableList
          items={rows}
          getId={(r) => r.key}
          onReorder={(items) => commit(items.map((r) => r.item), items.map((r) => r.key))}
          renderItem={(r, { handle, index }) => {
            const isOpen = open.includes(r.key);
            const toggle = () => setOpen((o) => (isOpen ? o.filter((k) => k !== r.key) : [...o, r.key]));
            return (
              <div className={cn("mb-2 rounded-lg border bg-white", isOpen ? "border-brand-200 shadow-sm" : "border-slate-200")}>
                <div className="flex items-center gap-1 px-1.5 py-1">
                  {handle}
                  <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-slate-50">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">{index + 1}</span>
                    <span className="truncate font-medium text-slate-800">{itemTitle(spec, r.item, index)}</span>
                    {isOpen ? <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />}
                  </button>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Move down" onClick={() => move(index, 1)} disabled={index === rows.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Duplicate" onClick={() => duplicate(index)} disabled={atMax}><Copy className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Remove" onClick={() => remove(index)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 p-3">
                    <FieldsForm fields={spec.fields} data={r.item} onChange={(d) => update(index, d)} nested />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cn("grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent", danger && "hover:bg-rose-50 hover:text-rose-600")}>
      {children}
    </button>
  );
}
