"use client";

import * as React from "react";
import { useActionState } from "react";
import { FileText, FolderOpen, Blocks, Search as SearchIcon, Info, ListChecks } from "lucide-react";
import type { Program, ProgramContent } from "@/lib/data/content";
import type { Block, PageSeo } from "@/lib/blocks/types";
import { AField, AInput, ATextarea, Toggle, Tabs, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField, MediaPickerButton } from "@/components/admin/media-picker";
import { BlockEditor } from "@/components/admin/block-editor/block-editor";
import { ListField } from "@/components/admin/block-editor/list-field";
import { ColorInput, RefSelect } from "@/components/admin/block-editor/fields";
import { SeoFields, type RefOption } from "@/components/admin/content/seo-fields";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { TagsInput } from "@/components/admin/content/tags-input";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { saveProgram } from "./actions";

type Tab = "details" | "content" | "blocks" | "seo";
type Item = Record<string, unknown>;

export function ProgramForm({ program, faqGroups }: { program: Program | null; faqGroups: RefOption[] }) {
  const [state, action] = useActionState(saveProgram, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !program;
  const c: ProgramContent = program?.content || {};
  const s = useSlugSync(program?.name || "", program?.slug || "", isNew);
  const [tab, setTab] = React.useState<Tab>("details");
  const [logo, setLogo] = React.useState(program?.logo_url || "");
  const [hero, setHero] = React.useState(program?.hero_image || "");
  const [brochure, setBrochure] = React.useState(program?.brochure_url || "");
  const [accent, setAccent] = React.useState(program?.accent || "#046BD2");
  const [active, setActive] = React.useState(program?.is_active ?? true);
  const [blocks, setBlocks] = React.useState<Block[]>(Array.isArray(c.blocks) ? c.blocks : []);
  const [seo, setSeo] = React.useState<PageSeo>(program?.seo || {});
  const [entry, setEntry] = React.useState<string[]>(c.entry_requirements || []);
  const [highlights, setHighlights] = React.useState<Item[]>((c.highlights as Item[]) || []);
  const [audiences, setAudiences] = React.useState<Item[]>((c.audiences as Item[]) || []);
  const [compare, setCompare] = React.useState<Record<string, string>>(c.compare || {});
  const [faqSlug, setFaqSlug] = React.useState<string>(c.faq_group_slug || "");
  const err = state?.errors || {};
  const t = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); touch(); };

  const tabs = [
    { id: "details", label: <span className="inline-flex items-center gap-1.5"><Info className="h-4 w-4" /> Details</span> },
    { id: "content", label: <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Programme content</span> },
    { id: "blocks", label: <span className="inline-flex items-center gap-1.5"><Blocks className="h-4 w-4" /> Page blocks</span>, count: blocks.length },
    { id: "seo", label: <span className="inline-flex items-center gap-1.5"><SearchIcon className="h-4 w-4" /> SEO</span> },
  ];

  return (
    <form action={action} onChange={touch}>
      {program && <input type="hidden" name="id" value={program.id} />}
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <input type="hidden" name="logo_url" value={logo} />
      <input type="hidden" name="hero_image" value={hero} />
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="entry_requirements" value={JSON.stringify(entry)} />
      <input type="hidden" name="highlights" value={JSON.stringify(highlights)} />
      <input type="hidden" name="audiences" value={JSON.stringify(audiences)} />
      <input type="hidden" name="compare" value={JSON.stringify(compare)} />
      <input type="hidden" name="faq_group_slug" value={faqSlug} />
      <EditorBar backHref="/admin/programs" backLabel="Programmes" title={isNew ? "New programme" : s.title || "Programme"} subtitle={program ? <span className="font-mono">{program.code} · /{s.slug}</span> : "Fill in the details, then add page blocks."} dirty={dirty} state={state} viewHref={program?.is_active ? `/${program.slug}` : null} saveLabel={isNew ? "Create programme" : "Save changes"}>
        <Toggle checked={active} onChange={t(setActive)} label="Active" />
      </EditorBar>

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
      <div className="pt-5">
        {/* Details */}
        <div className={tab === "details" ? "" : "hidden"}>
          <EditorGrid aside={
            <>
              <Panel title="Branding">
                <div className="space-y-4">
                  <ImageField label="Logo" value={logo} onChange={t(setLogo)} hint="Square or wide, transparent PNG/SVG." />
                  <ImageField label="Hero image" value={hero} onChange={t(setHero)} hint="Used on cards and as the social share image." />
                  <AField label="Accent colour" htmlFor="accent" error={err.accent}><ColorInput id="accent" value={accent} onChange={(v) => { setAccent(v || "#046BD2"); touch(); }} /></AField>
                </div>
              </Panel>
              <Panel title="Brochure">
                <div className="space-y-3">
                  <AField label="Brochure file URL" htmlFor="brochure_url" hint="PDF from the media library or an external link.">
                    <div className="flex gap-2">
                      <AInput id="brochure_url" name="brochure_url" value={brochure} onChange={(e) => setBrochure(e.target.value)} placeholder="https://…/brochure.pdf" className="text-xs" />
                      <MediaPickerButton accept="all" onSelect={(url) => { setBrochure(url); touch(); }} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-brand-400"><FolderOpen className="h-4 w-4" /> Library</MediaPickerButton>
                    </div>
                  </AField>
                  <AField label="Brochure button label" htmlFor="brochure_label"><AInput id="brochure_label" name="brochure_label" defaultValue={c.brochure_label || ""} placeholder="Download brochure" /></AField>
                  {brochure && <a href={brochure} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"><FileText className="h-3.5 w-3.5" /> Open current brochure</a>}
                </div>
              </Panel>
              <Panel title="Ordering">
                <FieldGroup cols={2}>
                  <AField label="Sort order" htmlFor="sort_order" error={err.sort_order}><AInput id="sort_order" name="sort_order" type="number" defaultValue={program?.sort_order ?? 0} /></AField>
                  <AField label="Fee from (LKR)" htmlFor="fee_from" error={err.fee_from}><AInput id="fee_from" name="fee_from" type="number" min={0} step="0.01" defaultValue={program?.fee_from ?? ""} placeholder="e.g. 185000" /></AField>
                </FieldGroup>
              </Panel>
            </>
          }>
            <Panel title="Identity">
              <FieldGroup>
                <FieldGroup cols={3}>
                  <AField label="Code" htmlFor="code" required error={err.code} hint="Short unique code, e.g. iCD."><AInput id="code" name="code" defaultValue={program?.code || ""} placeholder="iCD" required className="font-mono" /></AField>
                  <div className="sm:col-span-2"><AField label="Name" htmlFor="name" required error={err.name}><AInput id="name" name="name" value={s.title} onChange={(e) => s.setTitle(e.target.value)} placeholder="iCET Certified Developer" required /></AField></div>
                </FieldGroup>
                <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} hint="Public URL: icet.lk/<slug>" />
                <FieldGroup cols={2}>
                  <AField label="Qualification" htmlFor="qualification" error={err.qualification}><AInput id="qualification" name="qualification" defaultValue={program?.qualification || ""} placeholder="Diploma in Software Engineering" /></AField>
                  <AField label="Level label" htmlFor="level_label" hint="Small caps line above the title."><AInput id="level_label" name="level_label" defaultValue={program?.level_label || ""} placeholder="PROFESSIONAL DIPLOMA · TVEC-ALIGNED · AFTER A/L" /></AField>
                </FieldGroup>
                <AField label="Tagline" htmlFor="tagline"><AInput id="tagline" name="tagline" defaultValue={program?.tagline || ""} placeholder="Become an industry-ready software engineer in 18 months" /></AField>
                <AField label="Summary" htmlFor="summary" hint="Shown on programme cards and used as the default meta description."><ATextarea id="summary" name="summary" defaultValue={program?.summary || ""} rows={4} /></AField>
              </FieldGroup>
            </Panel>
            <Panel title="Delivery">
              <FieldGroup cols={3}>
                <AField label="Duration" htmlFor="duration"><AInput id="duration" name="duration" defaultValue={program?.duration || ""} placeholder="18 months" /></AField>
                <AField label="Industrial training" htmlFor="training"><AInput id="training" name="training" defaultValue={program?.training || ""} placeholder="6-month industrial training" /></AField>
                <AField label="Mode" htmlFor="mode"><AInput id="mode" name="mode" defaultValue={program?.mode || "Online / Physical / Hybrid"} /></AField>
              </FieldGroup>
            </Panel>
          </EditorGrid>
        </div>

        {/* Programme content */}
        <div className={tab === "content" ? "" : "hidden"}>
          <EditorGrid aside={
            <>
              <Panel title="Comparison table" description="Values for the programme comparison block.">
                <FieldGroup>
                  {([["entry", "Entry requirement"], ["ideal_for", "Ideal for"], ["technologies", "Technologies"], ["fee", "Fee"]] as const).map(([k, label]) => (
                    <AField key={k} label={label} htmlFor={`compare_${k}`}><AInput id={`compare_${k}`} value={compare[k] || ""} onChange={(e) => { setCompare({ ...compare, [k]: e.target.value }); }} /></AField>
                  ))}
                </FieldGroup>
              </Panel>
              <Panel title="FAQ group">
                <AField label="FAQ group" htmlFor="faq_group" hint="Shown on the programme page and emitted as FAQ schema.">
                  <RefSelect id="faq_group" entity="faq_group" value={faqSlug} onChange={(v) => { setFaqSlug(typeof v === "string" ? v : ""); touch(); }} placeholder="— None —" />
                </AField>
              </Panel>
            </>
          }>
            <Panel title="Key facts">
              <FieldGroup>
                <AField label="Next intake" htmlFor="intake"><AInput id="intake" name="intake" defaultValue={c.intake || ""} placeholder="January 2026" /></AField>
                <AField label="Entry requirements" hint="One per chip – press Enter after each.">
                  <TagsInput value={entry} onChange={t(setEntry)} placeholder="e.g. Passed G.C.E. A/L (any stream)" />
                </AField>
              </FieldGroup>
            </Panel>
            <Panel title="Highlights & audiences">
              <div className="space-y-4">
                <ListField spec={{ key: "highlights", label: "Highlights", type: "list", itemLabel: "Highlight", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "label", label: "Label", type: "text", width: "half" }, { key: "value", label: "Value", type: "text" }] }} value={highlights} onChange={(v) => { setHighlights(v || []); touch(); }} />
                <ListField spec={{ key: "audiences", label: "Who is it for?", type: "list", itemLabel: "Audience", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "description", label: "Description", type: "textarea" }] }} value={audiences} onChange={(v) => { setAudiences(v || []); touch(); }} />
              </div>
            </Panel>
          </EditorGrid>
        </div>

        {/* Blocks */}
        <div className={tab === "blocks" ? "" : "hidden"}>
          <BlockEditor value={blocks} onChange={t(setBlocks)} name="blocks" />
        </div>

        {/* SEO */}
        <div className={tab === "seo" ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : "hidden"}>
          <SeoFields value={seo} onChange={t(setSeo)} faqGroups={faqGroups} defaultTitle={s.title ? `${s.title}${program?.qualification ? ` – ${program.qualification}` : ""}` : undefined} defaultDescription={program?.summary} />
        </div>
      </div>
    </form>
  );
}
