"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Collapsible pretty-printed JSON for audit meta. */
export function MetaViewer({ value }: { value: unknown }) {
  const [open, setOpen] = React.useState(false);
  const isEmpty = !value || (typeof value === "object" && Object.keys(value as object).length === 0);
  if (isEmpty) return <span className="text-xs text-slate-400">—</span>;
  const entries = typeof value === "object" && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : [];
  const summary = entries.slice(0, 2).map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`).join(" · ");
  return (
    <div className="max-w-md">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex max-w-full items-center gap-1 text-left text-xs font-medium text-slate-600 hover:text-brand-700" aria-expanded={open}>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{open ? "Hide details" : summary || `${entries.length} field${entries.length === 1 ? "" : "s"}`}</span>
      </button>
      {open && <pre className="mt-1.5 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}
