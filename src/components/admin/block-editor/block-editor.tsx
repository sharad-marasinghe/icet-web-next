"use client";

import * as React from "react";
import { Plus, ArrowUp, ArrowDown, Copy, Eye, EyeOff, Trash2, Settings2, LayoutTemplate, ChevronDown, ChevronUp } from "lucide-react";
import { BLOCK_REGISTRY, createBlock } from "@/lib/blocks/registry";
import { newBlockId, type Block, type BlockType, type BlockSettings } from "@/lib/blocks/types";
import { SortableList } from "@/components/admin/content/sortable-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlockIcon } from "./block-icon";
import { BlockPicker } from "./block-picker";
import { BlockSettingsForm } from "./block-settings";
import { FieldsForm, type Data } from "./fields";
import { blockSummary } from "./summary";

export type { Block };

/**
 * Controlled page block editor. `value` is the ordered Block[]; every edit calls
 * `onChange`. When `name` is given the whole array is also serialised to a hidden
 * JSON input so the surrounding <form> can submit it to a server action.
 */
export function BlockEditor({ value, onChange, name, className }: { value: Block[]; onChange: (blocks: Block[]) => void; name?: string; className?: string }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(value[0]?.id ?? null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(true);
  const selected = value.find((b) => b.id === selectedId) ?? value[0] ?? null;

  const update = (id: string, patch: Partial<Pick<Block, "data" | "settings">>) => onChange(value.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (id: string, dir: -1 | 1) => {
    const i = value.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const duplicate = (id: string) => {
    const i = value.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...structuredClone(value[i]), id: newBlockId() } as Block;
    const next = [...value];
    next.splice(i + 1, 0, copy);
    onChange(next);
    setSelectedId(copy.id);
  };
  const toggleHidden = (id: string) => {
    const b = value.find((x) => x.id === id);
    if (!b) return;
    const settings: BlockSettings = { ...(b.settings || {}) };
    if (settings.hidden) delete settings.hidden; else settings.hidden = true;
    update(id, { settings });
  };
  const remove = (id: string) => {
    const b = value.find((x) => x.id === id);
    if (!b) return;
    if (!confirm(`Delete the “${BLOCK_REGISTRY[b.type]?.label || b.type}” block? You can still cancel by leaving without saving.`)) return;
    const i = value.findIndex((x) => x.id === id);
    const next = value.filter((x) => x.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null);
  };
  const add = (type: BlockType) => {
    const block = createBlock(type);
    const i = selected ? value.findIndex((b) => b.id === selected.id) : value.length - 1;
    const next = [...value];
    next.splice(i + 1, 0, block);
    onChange(next);
    setSelectedId(block.id);
    setPickerOpen(false);
  };

  const def = selected ? BLOCK_REGISTRY[selected.type] : null;

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]", className)}>
      {name && <input type="hidden" name={name} value={JSON.stringify(value)} />}

      {/* ───── Block list ───── */}
      <aside className="min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Blocks <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{value.length}</span></p>
          <Button type="button" size="sm" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4" /> Add block</Button>
        </div>
        {value.length === 0 ? (
          <button type="button" onClick={() => setPickerOpen(true)} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-brand-400 hover:bg-brand-50/40">
            <LayoutTemplate className="h-8 w-8 text-brand-500" />
            <span className="font-display text-sm font-bold text-slate-900">This page has no blocks yet</span>
            <span className="text-xs text-slate-500">Click to add your first block – a page header or hero is a good start.</span>
          </button>
        ) : (
          <SortableList
            items={value}
            getId={(b) => b.id}
            onReorder={(items) => onChange(items)}
            className="space-y-1.5"
            renderItem={(b, { handle, index }) => {
              const d = BLOCK_REGISTRY[b.type];
              const active = selected?.id === b.id;
              const hidden = !!b.settings?.hidden;
              return (
                <div className={cn("group flex items-stretch gap-1 rounded-xl border bg-white pr-1 transition", active ? "border-brand-500 shadow-[0_0_0_3px_rgb(4,107,210,0.12)]" : "border-slate-200 hover:border-slate-300", hidden && "opacity-60")}>
                  <div className="flex items-center pl-1">{handle}</div>
                  <button type="button" onClick={() => setSelectedId(b.id)} aria-pressed={active} aria-label={`Edit ${d?.label || b.type} block ${index + 1}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 text-left focus-visible:outline-2 focus-visible:outline-brand-600">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600")}><BlockIcon name={d?.icon} className="h-4.5 w-4.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{d?.label || b.type}{hidden && <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-label="Hidden" />}</span>
                      <span className="block truncate text-xs text-slate-500">{blockSummary(b)}</span>
                    </span>
                  </button>
                  <div className="flex flex-col justify-center gap-0 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                    <div className="flex">
                      <CardBtn label="Move up" onClick={() => move(b.id, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></CardBtn>
                      <CardBtn label="Move down" onClick={() => move(b.id, 1)} disabled={index === value.length - 1}><ArrowDown className="h-3.5 w-3.5" /></CardBtn>
                    </div>
                    <div className="flex">
                      <CardBtn label="Duplicate" onClick={() => duplicate(b.id)}><Copy className="h-3.5 w-3.5" /></CardBtn>
                      <CardBtn label={hidden ? "Show block" : "Hide block"} onClick={() => toggleHidden(b.id)}>{hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</CardBtn>
                      <CardBtn label="Delete" onClick={() => remove(b.id)} danger><Trash2 className="h-3.5 w-3.5" /></CardBtn>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Drag the grip (or focus it and use space + arrow keys) to reorder. Hover a block for quick actions.</p>
      </aside>

      {/* ───── Block form ───── */}
      <section className="min-w-0">
        {selected && def ? (
          <div key={selected.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><BlockIcon name={def.icon} className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[15px] font-bold text-slate-900">{def.label}</h3>
                <p className="truncate text-xs text-slate-500">{def.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <CardBtn label={selected.settings?.hidden ? "Show block" : "Hide block"} onClick={() => toggleHidden(selected.id)} size="md">{selected.settings?.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</CardBtn>
                <CardBtn label="Duplicate" onClick={() => duplicate(selected.id)} size="md"><Copy className="h-4 w-4" /></CardBtn>
                <CardBtn label="Delete" onClick={() => remove(selected.id)} danger size="md"><Trash2 className="h-4 w-4" /></CardBtn>
              </div>
            </header>
            <div className="p-5">
              {def.fields.length ? (
                <FieldsForm fields={def.fields} data={(selected.data || {}) as Data} onChange={(data) => update(selected.id, { data: data as Block["data"] })} />
              ) : (
                <p className="text-sm text-slate-500">This block has no editable fields.</p>
              )}
            </div>
            <div className="border-t border-slate-100">
              <button type="button" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Settings2 className="h-4 w-4 text-slate-400" /> Section settings
                <span className="ml-1 text-xs font-normal text-slate-400">tone · anchor · spacing · visibility</span>
                {showSettings ? <ChevronUp className="ml-auto h-4 w-4 text-slate-400" /> : <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />}
              </button>
              {showSettings && (
                <div className="px-5 pb-5">
                  <BlockSettingsForm value={selected.settings || {}} onChange={(settings) => update(selected.id, { settings })} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            <div>
              <LayoutTemplate className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              Select a block on the left to edit it, or add a new one.
            </div>
          </div>
        )}
      </section>

      <BlockPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={add} />
    </div>
  );
}

function CardBtn({ label, onClick, disabled, danger, children, size = "sm" }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode; size?: "sm" | "md" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cn("grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent", size === "sm" ? "h-6 w-6" : "h-9 w-9", danger && "hover:bg-rose-50 hover:text-rose-600")}>
      {children}
    </button>
  );
}
