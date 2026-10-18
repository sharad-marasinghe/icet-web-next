"use client";

import * as React from "react";
import { useActionState } from "react";
import { CalendarDays, Search as SearchIcon, Ticket } from "lucide-react";
import type { EventRecord } from "@/lib/data/content";
import type { PageSeo } from "@/lib/blocks/types";
import { AField, AInput, ATextarea, ASelect, Toggle, Tabs, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { ListField } from "@/components/admin/block-editor/list-field";
import { SeoFields, type RefOption } from "@/components/admin/content/seo-fields";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { CategoryChecklist, type Category } from "@/components/admin/content/category-manager";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { toLocalInput } from "@/components/admin/content/form-utils";
import { deleteEventCategory, saveEvent, saveEventCategory } from "./actions";

export type EventFull = EventRecord & { status: "draft" | "published" | "archived" };
export type WorkshopOption = { id: number; slug: string; title: string; status: string };
type Item = Record<string, unknown>;

export function EventForm({ event, categories, workshops, faqGroups }: { event: EventFull | null; categories: Category[]; workshops: WorkshopOption[]; faqGroups: RefOption[] }) {
  const [state, action] = useActionState(saveEvent, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !event;
  const s = useSlugSync(event?.title || "", event?.slug || "", isNew);
  const [tab, setTab] = React.useState<"event" | "seo">("event");
  const [content, setContent] = React.useState(event?.content || "");
  const [image, setImage] = React.useState(event?.image_url || "");
  const [allDay, setAllDay] = React.useState(event?.all_day ?? false);
  const [online, setOnline] = React.useState(event?.is_online ?? false);
  const [featured, setFeatured] = React.useState(event?.is_featured ?? false);
  const [status, setStatus] = React.useState<EventFull["status"]>(event?.status || "draft");
  const [workshopId, setWorkshopId] = React.useState<string>(event?.workshop_id ? String(event.workshop_id) : "");
  const [catIds, setCatIds] = React.useState<number[]>(event?.category_ids || []);
  const [speakers, setSpeakers] = React.useState<Item[]>(((event?.speakers || []) as Item[]).map((sp) => ({ ...sp, photo_url: sp.photo_url ? { url: sp.photo_url } : undefined })));
  const [seo, setSeo] = React.useState<PageSeo>(event?.seo || {});
  const workshop = workshops.find((w) => String(w.id) === workshopId);
  const err = state?.errors || {};

  return (
    <form action={action} onChange={touch}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="image_url" value={image} />
      <input type="hidden" name="all_day" value={allDay ? "true" : "false"} />
      <input type="hidden" name="is_online" value={online ? "true" : "false"} />
      <input type="hidden" name="is_featured" value={featured ? "true" : "false"} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="workshop_id" value={workshopId} />
      <input type="hidden" name="speakers" value={JSON.stringify(speakers)} />
      <EditorBar backHref="/admin/events" backLabel="Events" title={isNew ? "New event" : s.title || "Event"} subtitle={event ? <span className="font-mono">/events/{s.slug}</span> : undefined} dirty={dirty} state={state} viewHref={event?.status === "published" ? `/events/${event.slug}` : null} saveLabel={isNew ? "Create event" : "Save changes"}>
        <ASelect value={status} onChange={(e) => { setStatus(e.target.value as EventFull["status"]); touch(); }} className="h-9 w-32 text-xs font-semibold" aria-label="Status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </ASelect>
      </EditorBar>

      <Tabs tabs={[{ id: "event", label: <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Event</span> }, { id: "seo", label: <span className="inline-flex items-center gap-1.5"><SearchIcon className="h-4 w-4" /> SEO</span> }]} active={tab} onChange={(id) => setTab(id as "event" | "seo")} />
      <div className="pt-5">
        <div className={tab === "event" ? "" : "hidden"}>
          <EditorGrid aside={
            <>
              <Panel title="Schedule">
                <FieldGroup>
                  <AField label="Starts" htmlFor="start_at" required error={err.start_at} hint="Sri Lanka time (Asia/Colombo)."><AInput id="start_at" name="start_at" type="datetime-local" defaultValue={toLocalInput(event?.start_at)} required /></AField>
                  <AField label="Ends" htmlFor="end_at" error={err.end_at}><AInput id="end_at" name="end_at" type="datetime-local" defaultValue={toLocalInput(event?.end_at)} /></AField>
                  <Toggle checked={allDay} onChange={(v) => { setAllDay(v); touch(); }} label="All-day event" description="Hides the time and shows dates only." />
                </FieldGroup>
              </Panel>
              <Panel title="Location">
                <FieldGroup>
                  <Toggle checked={online} onChange={(v) => { setOnline(v); touch(); }} label="Online event" />
                  <AField label="Venue" htmlFor="venue" error={err.venue}><AInput id="venue" name="venue" defaultValue={event?.venue || ""} placeholder={online ? "Zoom / Google Meet" : "iCET Campus, Colombo 05"} /></AField>
                  <AField label="Address" htmlFor="address" error={err.address}><ATextarea id="address" name="address" rows={2} defaultValue={event?.address || ""} /></AField>
                </FieldGroup>
              </Panel>
              <Panel title="Registration">
                <FieldGroup>
                  <AField label="Cost" htmlFor="cost" error={err.cost}><AInput id="cost" name="cost" defaultValue={event?.cost || ""} placeholder="Free · LKR 2,500" /></AField>
                  <AField label="Linked workshop" htmlFor="workshop_id" error={err.workshop_id} hint="Registrations go through the registry workshop form.">
                    <ASelect id="workshop_id" value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); touch(); }}>
                      <option value="">— No workshop link —</option>
                      {workshops.map((w) => <option key={w.id} value={w.id}>{w.title} ({w.status})</option>)}
                    </ASelect>
                  </AField>
                  {workshop && <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800"><Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>Registration page: <code className="font-mono font-semibold">/register/{workshop.slug}</code>. The event&apos;s “Register” button points there unless you set an external URL below.</span></p>}
                  <AField label="External registration URL" htmlFor="registration_url" error={err.registration_url}><AInput id="registration_url" name="registration_url" type="url" defaultValue={event?.registration_url || ""} placeholder="https://forms.gle/…" /></AField>
                </FieldGroup>
              </Panel>
              <Panel title="Categories & display">
                <FieldGroup>
                  <CategoryChecklist categories={categories} value={catIds} onChange={(ids) => { setCatIds(ids); touch(); }} withColor onSave={saveEventCategory} onDelete={deleteEventCategory} />
                  <Toggle checked={featured} onChange={(v) => { setFeatured(v); touch(); }} label="Featured" description="Highlighted in featured event layouts." />
                </FieldGroup>
              </Panel>
            </>
          }>
            <Panel title="Details">
              <FieldGroup>
                <AField label="Title" htmlFor="title" required error={err.title}><AInput id="title" name="title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} required placeholder="DevOps Workshop 2026" className="font-semibold" /></AField>
                <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} prefix="/events/" />
                <AField label="Excerpt" htmlFor="excerpt" error={err.excerpt} hint="Short summary for cards and listings."><ATextarea id="excerpt" name="excerpt" rows={3} defaultValue={event?.excerpt || ""} /></AField>
                <ImageField label="Cover image" value={image} onChange={(v) => { setImage(v); touch(); }} hint="16:9 recommended, at least 1200px wide." />
              </FieldGroup>
            </Panel>
            <Panel title="Description">
              <RichText value={content} onChange={(html) => { setContent(html); touch(); }} name="content" minHeight={280} placeholder="Agenda, speakers, what to bring…" />
            </Panel>
            <Panel title="Speakers">
              <ListField spec={{ key: "speakers", label: "Speakers", type: "list", itemLabel: "Speaker", max: 30, fields: [{ key: "name", label: "Name", type: "text", width: "half", required: true }, { key: "title", label: "Title / organisation", type: "text", width: "half" }, { key: "photo_url", label: "Photo", type: "image" }] }} value={speakers} onChange={(v) => { setSpeakers(v || []); touch(); }} />
            </Panel>
          </EditorGrid>
        </div>
        <div className={tab === "seo" ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : "hidden"}>
          <SeoFields value={seo} onChange={(v) => { setSeo(v); touch(); }} faqGroups={faqGroups} defaultTitle={s.title} defaultDescription={event?.excerpt} />
        </div>
      </div>
    </form>
  );
}
