"use client";

import * as React from "react";
import { useActionState } from "react";
import { Star } from "lucide-react";
import { AField, AInput, ATextarea, ASelect, Toggle, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { cn } from "@/lib/utils";
import { saveTestimonial } from "./actions";

export type TestimonialRecord = { id: string; name: string; role: string; company: string; quote: string; photo_url: string | null; video_url: string | null; program_code: string | null; rating: number | null; is_active: boolean; sort_order: number };

export function TestimonialForm({ item, programs }: { item: TestimonialRecord | null; programs: { code: string; name: string }[] }) {
  const [state, action] = useActionState(saveTestimonial, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !item;
  const [name, setName] = React.useState(item?.name || "");
  const [photo, setPhoto] = React.useState(item?.photo_url || "");
  const [rating, setRating] = React.useState<number>(item?.rating ?? 5);
  const [active, setActive] = React.useState(item?.is_active ?? true);
  const err = state?.errors || {};
  return (
    <form action={action} onChange={touch}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="photo_url" value={photo} />
      <input type="hidden" name="rating" value={rating || ""} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <EditorBar backHref="/admin/testimonials" backLabel="Testimonials" title={isNew ? "New testimonial" : name || "Testimonial"} subtitle={item ? [item.role, item.company].filter(Boolean).join(" · ") : undefined} dirty={dirty} state={state} saveLabel={isNew ? "Create testimonial" : "Save changes"} />
      <EditorGrid aside={
        <>
          <Panel title="Photo & video">
            <div className="space-y-4">
              <ImageField label="Photo" value={photo} onChange={(v) => { setPhoto(v); touch(); }} hint="Square portrait preferred." />
              <AField label="Video URL" htmlFor="video_url" error={err.video_url} hint="Optional YouTube link for a video testimonial."><AInput id="video_url" name="video_url" type="url" defaultValue={item?.video_url || ""} placeholder="https://www.youtube.com/watch?v=…" /></AField>
            </div>
          </Panel>
          <Panel title="Display">
            <div className="space-y-4">
              <Toggle checked={active} onChange={(v) => { setActive(v); touch(); }} label="Active" description="Inactive testimonials are hidden from the website." />
              <AField label="Rating" error={err.rating}>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => { setRating(n); touch(); }} className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-brand-600">
                      <Star className={cn("h-6 w-6 transition", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300")} />
                    </button>
                  ))}
                  <button type="button" onClick={() => { setRating(0); touch(); }} className="ml-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Clear</button>
                </div>
              </AField>
              <AField label="Sort order" htmlFor="sort_order" error={err.sort_order}><AInput id="sort_order" name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} /></AField>
            </div>
          </Panel>
        </>
      }>
        <Panel title="Testimonial">
          <FieldGroup>
            <FieldGroup cols={3}>
              <AField label="Name" htmlFor="name" required error={err.name}><AInput id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required /></AField>
              <AField label="Role" htmlFor="role" error={err.role}><AInput id="role" name="role" defaultValue={item?.role || ""} placeholder="Software Engineer" /></AField>
              <AField label="Company" htmlFor="company" error={err.company}><AInput id="company" name="company" defaultValue={item?.company || ""} placeholder="WSO2" /></AField>
            </FieldGroup>
            <AField label="Quote" htmlFor="quote" required error={err.quote}><ATextarea id="quote" name="quote" rows={6} defaultValue={item?.quote || ""} required placeholder="“iCET gave me the practical skills…”" /></AField>
            <AField label="Programme" htmlFor="program_code" error={err.program_code} hint="Lets programme pages show their own testimonials.">
              <ASelect id="program_code" name="program_code" defaultValue={item?.program_code || ""}>
                <option value="">— Not programme specific —</option>
                {programs.map((p) => <option key={p.code} value={p.code}>{p.code} – {p.name}</option>)}
              </ASelect>
            </AField>
          </FieldGroup>
        </Panel>
      </EditorGrid>
    </form>
  );
}
