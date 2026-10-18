"use client";

import * as React from "react";
import type { PageSeo } from "@/lib/blocks/types";
import { AField, AInput, ATextarea, ASelect, Toggle } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { TagsInput } from "./tags-input";
import { cn } from "@/lib/utils";

export type RefOption = { value: string; label: string };

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("ml-auto text-xs font-medium tabular-nums", n > max ? "text-rose-600" : n > max * 0.9 ? "text-amber-600" : "text-slate-400")}>{n}/{max}</span>;
}

/** SEO tab fields. Serialises to a hidden `seo` JSON input. */
export function SeoFields({ value, onChange, faqGroups = [], name = "seo", defaultTitle, defaultDescription, showFaq = true }: { value: PageSeo; onChange: (seo: PageSeo) => void; faqGroups?: RefOption[]; name?: string; defaultTitle?: string; defaultDescription?: string; showFaq?: boolean }) {
  const set = <K extends keyof PageSeo>(k: K, v: PageSeo[K]) => onChange({ ...value, [k]: v });
  const title = value.title ?? "";
  const desc = value.description ?? "";
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <div className="space-y-5">
        <AField label={<span className="flex items-center">Meta title <Counter n={title.length} max={60} /></span>} htmlFor="seo_title" hint="Shown in search results and browser tabs. Leave blank to use the page title.">
          <AInput id="seo_title" value={title} onChange={(e) => set("title", e.target.value)} placeholder={defaultTitle} maxLength={160} />
        </AField>
        <AField label={<span className="flex items-center">Meta description <Counter n={desc.length} max={160} /></span>} htmlFor="seo_description" hint="One or two sentences; aim for under 160 characters.">
          <ATextarea id="seo_description" value={desc} onChange={(e) => set("description", e.target.value)} placeholder={defaultDescription} maxLength={320} />
        </AField>
        <AField label="Keywords" hint="Press Enter or comma after each keyword.">
          <TagsInput value={value.keywords ?? []} onChange={(v) => set("keywords", v)} placeholder="software engineering course, …" />
        </AField>
        <div className="grid gap-5 sm:grid-cols-2">
          <AField label="Canonical URL" htmlFor="seo_canonical" hint="Only when this content is a copy of another URL.">
            <AInput id="seo_canonical" type="url" value={value.canonical ?? ""} onChange={(e) => set("canonical", e.target.value)} placeholder="https://icet.lk/…" />
          </AField>
          {showFaq && (
            <AField label="FAQ schema group" htmlFor="seo_faq" hint="Emits FAQPage structured data from this group.">
              <ASelect id="seo_faq" value={value.faq_group_slug ?? ""} onChange={(e) => set("faq_group_slug", e.target.value || undefined)}>
                <option value="">— None —</option>
                {faqGroups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </ASelect>
            </AField>
          )}
        </div>
        <Toggle checked={!!value.noindex} onChange={(v) => set("noindex", v || undefined)} label="Hide from search engines (noindex)" description="Keeps the page live but asks Google not to list it." />
      </div>
      <div className="space-y-5">
        <ImageField label="Social share image" value={value.og_image ?? ""} onChange={(url) => set("og_image", url || undefined)} hint="1200×630 recommended. Falls back to the site default." />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Search preview</p>
          <p className="truncate text-[17px] font-medium text-[#1a0dab]">{title || defaultTitle || "Page title"} – iCET</p>
          <p className="text-xs text-[#006621]">icet.lk › {value.canonical ? value.canonical.replace(/^https?:\/\/[^/]+\//, "") : "…"}</p>
          <p className="mt-1 line-clamp-3 text-[13px] text-slate-600">{desc || defaultDescription || "The meta description will appear here."}</p>
        </div>
      </div>
    </div>
  );
}
