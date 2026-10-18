"use client";

import * as React from "react";
import { X, Plus, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AInput } from "@/components/admin/ui";

/** Comma/Enter separated tag list (keywords, email lists). */
export function TagInput({ value, onChange, placeholder, validate, className }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; validate?: (s: string) => boolean; className?: string }) {
  const [draft, setDraft] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);
  function commit() {
    const parts = draft.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    if (validate && parts.some((p) => !validate(p))) { setInvalid(true); return; }
    setInvalid(false);
    onChange(Array.from(new Set([...value, ...parts])));
    setDraft("");
  }
  return (
    <div className={cn("rounded-lg border bg-white px-2 py-1.5 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100", invalid ? "border-rose-400" : "border-slate-300", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }}
          onBlur={commit}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {invalid && <p className="mt-1 px-1 text-xs font-medium text-rose-600">One or more entries are not valid.</p>}
    </div>
  );
}

/** Small key/value definition list used on detail screens. */
export function KeyValueList({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string }) {
  const rows = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing recorded.</p>;
  return (
    <dl className={cn("divide-y divide-slate-100 text-sm", className)}>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-1 py-2 sm:grid-cols-[160px_1fr] sm:gap-4">
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 sm:pt-0.5">{r.label}</dt>
          <dd className="min-w-0 break-words text-slate-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700", className)} aria-label="Copy" title="Copy">
      {done ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Generates a readable temporary password (letters, digits, one symbol). */
export function generatePassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const symbols = "!@#$%&*?";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length - 1; i++) out += alphabet[arr[i] % alphabet.length];
  const pos = arr[length - 1] % (length - 1);
  const sym = symbols[arr[0] % symbols.length];
  return out.slice(0, pos) + sym + out.slice(pos);
}

/** Simple list editor for short string lines (e.g. opening hours lines). */
export function AddRowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="h-4 w-4" /> {children}</button>;
}

export const inputCompact = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export { AInput };
