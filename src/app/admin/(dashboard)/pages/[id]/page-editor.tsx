"use client";

import * as React from "react";
import { useActionState } from "react";
import { Blocks, Search as SearchIcon } from "lucide-react";
import type { Block, PageRecord, PageSeo } from "@/lib/blocks/types";
import { AInput, ASelect, Toggle, Tabs, FieldError, initialActionState } from "@/components/admin/ui";
import { BlockEditor } from "@/components/admin/block-editor/block-editor";
import { SeoFields, type RefOption } from "@/components/admin/content/seo-fields";
import { SlugField } from "@/components/admin/content/slug-input";
import { EditorBar, useDirty } from "@/components/admin/content/form-bits";
import { slugify } from "@/lib/utils";
import { updatePage } from "../actions";

export function PageEditor({ page, faqGroups }: { page: PageRecord; faqGroups: RefOption[] }) {
  const [state, action] = useActionState(updatePage, initialActionState);
  const { dirty, touch } = useDirty(state);
  const [title, setTitle] = React.useState(page.title);
  const [slug, setSlug] = React.useState(page.slug);
  const [status, setStatus] = React.useState<PageRecord["status"]>(page.status);
  const [showInSearch, setShowInSearch] = React.useState(page.show_in_search);
  const [blocks, setBlocks] = React.useState<Block[]>(page.blocks);
  const [seo, setSeo] = React.useState<PageSeo>(page.seo);
  const [tab, setTab] = React.useState<"content" | "seo">("content");
  const livePath = page.slug === "home" ? "/" : `/${page.slug}`;

  return (
    <form action={action} onChange={touch}>
      <input type="hidden" name="id" value={page.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="show_in_search" value={showInSearch ? "true" : "false"} />
      <EditorBar backHref="/admin/pages" backLabel="Pages" title={title || "Untitled page"} subtitle={<span className="font-mono">{slug === "home" ? "/" : `/${slug}`}</span>} dirty={dirty} state={state} viewHref={page.status === "published" ? livePath : null}>
        <ASelect value={status} onChange={(e) => { setStatus(e.target.value as PageRecord["status"]); touch(); }} className="h-9 w-32 text-xs font-semibold" aria-label="Status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </ASelect>
      </EditorBar>

      <div className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-sm font-semibold text-slate-700">Title<span className="ml-0.5 text-rose-600">*</span></label>
          <AInput id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="font-semibold" />
          <FieldError error={state?.errors?.title} />
        </div>
        <SlugField value={slug} onChange={(v) => { setSlug(v); touch(); }} locked onToggleLock={() => { setSlug(slugify(title)); touch(); }} error={state?.errors?.slug} hint="Changing the slug changes the public URL." />
        <div className="flex items-end pb-1">
          <Toggle checked={showInSearch} onChange={(v) => { setShowInSearch(v); touch(); }} label="Show in search" description="Sitemap & site search" />
        </div>
      </div>

      <Tabs tabs={[{ id: "content", label: <span className="inline-flex items-center gap-1.5"><Blocks className="h-4 w-4" /> Content</span>, count: blocks.length }, { id: "seo", label: <span className="inline-flex items-center gap-1.5"><SearchIcon className="h-4 w-4" /> SEO</span> }]} active={tab} onChange={(id) => setTab(id as "content" | "seo")} />
      <div className="pt-5">
        <div className={tab === "content" ? "" : "hidden"}>
          <BlockEditor value={blocks} onChange={(b) => { setBlocks(b); touch(); }} name="blocks" />
        </div>
        <div className={tab === "seo" ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : "hidden"}>
          <SeoFields value={seo} onChange={(s) => { setSeo(s); touch(); }} faqGroups={faqGroups} defaultTitle={title} />
        </div>
      </div>
    </form>
  );
}
