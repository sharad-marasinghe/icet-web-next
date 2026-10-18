"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { BLOCK_GROUPS, BLOCK_REGISTRY, type BlockDef } from "@/lib/blocks/registry";
import type { BlockType } from "@/lib/blocks/types";
import { Modal } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { BlockIcon } from "./block-icon";

/** Grouped "Add block" picker. */
export function BlockPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: BlockType) => void }) {
  const [q, setQ] = React.useState("");
  const defs = Object.values(BLOCK_REGISTRY) as BlockDef[];
  const match = (d: BlockDef) => !q || `${d.label} ${d.description} ${d.type}`.toLowerCase().includes(q.toLowerCase());
  return (
    <Modal open={open} onClose={onClose} title="Add a block" wide>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blocks…" className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100" />
      </div>
      <div className="space-y-6">
        {BLOCK_GROUPS.map((g) => {
          const items = defs.filter((d) => d.group === g && match(d));
          if (!items.length) return null;
          return (
            <section key={g}>
              <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{g}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <button key={d.type} type="button" onClick={() => { onPick(d.type); setQ(""); }} className={cn("group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-brand-600")}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white"><BlockIcon name={d.icon} className="h-4.5 w-4.5" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{d.label}</span>
                      <span className="block text-xs leading-snug text-slate-500">{d.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {defs.filter(match).length === 0 && <p className="py-8 text-center text-sm text-slate-500">No blocks match “{q}”.</p>}
      </div>
    </Modal>
  );
}
