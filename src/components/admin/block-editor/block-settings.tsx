"use client";

import type { BlockSettings, Tone } from "@/lib/blocks/types";
import { AField, AInput, ASelect, Toggle } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";

const TONES: { value: Tone; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "bg-white" },
  { value: "light", label: "Light surface", swatch: "bg-[#f0f5fa]" },
  { value: "navy", label: "Navy", swatch: "bg-[#0b1f3a]" },
  { value: "brand", label: "Brand blue", swatch: "bg-[#046bd2]" },
  { value: "gradient", label: "Gradient", swatch: "bg-gradient-to-br from-[#0b1f3a] to-[#046bd2]" },
  { value: "grid", label: "Grid pattern", swatch: "bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:6px_6px]" },
];

/** Shared per-block settings: tone, anchor, size, hidden. */
export function BlockSettingsForm({ value, onChange }: { value: BlockSettings; onChange: (s: BlockSettings) => void }) {
  const set = <K extends keyof BlockSettings>(k: K, v: BlockSettings[K]) => {
    const next = { ...value, [k]: v };
    if (v === undefined || v === "" || v === false) delete next[k];
    onChange(next);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AField label="Background tone" htmlFor="bs_tone" className="sm:col-span-2">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Background tone">
          {TONES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={(value.tone || "white") === t.value} onClick={() => set("tone", t.value)} title={t.label} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${(value.tone || "white") === t.value ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-100" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
              <span className={`h-4 w-4 rounded-full ring-1 ring-inset ring-black/10 ${t.swatch}`} />{t.label}
            </button>
          ))}
        </div>
      </AField>
      <AField label="Anchor id" htmlFor="bs_anchor" hint="Used for in-page navigation links (#anchor).">
        <AInput id="bs_anchor" value={value.anchor || ""} onChange={(e) => set("anchor", e.target.value)} onBlur={(e) => set("anchor", slugify(e.target.value) || undefined)} placeholder="e.g. curriculum" className="font-mono text-[13px]" />
      </AField>
      <AField label="Vertical spacing" htmlFor="bs_size">
        <ASelect id="bs_size" value={value.size || "md"} onChange={(e) => set("size", e.target.value === "sm" ? "sm" : undefined)}>
          <option value="md">Normal</option>
          <option value="sm">Compact</option>
        </ASelect>
      </AField>
      <div className="sm:col-span-2">
        <Toggle checked={!!value.hidden} onChange={(v) => set("hidden", v || undefined)} label="Hide this block on the live site" description="The block stays in the editor but is not rendered publicly." />
      </div>
    </div>
  );
}
