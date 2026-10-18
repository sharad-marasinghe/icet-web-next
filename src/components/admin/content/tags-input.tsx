"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip input. Enter, comma or Tab adds a tag; Backspace on an empty input removes the last one. */
export function TagsInput({ value, onChange, name, placeholder = "Type and press Enter…", suggestions = [], id, className, max }: { value: string[]; onChange: (v: string[]) => void; name?: string; placeholder?: string; suggestions?: string[]; id?: string; className?: string; max?: number }) {
  const [draft, setDraft] = React.useState("");
  const listId = React.useId();
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    let next = [...value];
    for (const p of parts) if (!next.includes(p) && (!max || next.length < max)) next = [...next, p];
    onChange(next);
    setDraft("");
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div className={cn("flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100", className)}>
      {name && <input type="hidden" name={name} value={JSON.stringify(value)} />}
      {value.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
          {t}
          <button type="button" onClick={() => remove(i)} className="rounded hover:text-rose-600" aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        id={id}
        list={suggestions.length ? listId : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && draft.trim())) { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && value.length) remove(value.length - 1);
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
      />
      {suggestions.length > 0 && <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}
