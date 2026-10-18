"use client";

import * as React from "react";
import { useActionState } from "react";
import type { Trainer } from "@/lib/data/content";
import { AField, AInput, ATextarea, Toggle, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { saveTrainer } from "./actions";

type TrainerFull = Trainer & { is_active: boolean };

export function TrainerForm({ trainer }: { trainer: TrainerFull | null }) {
  const [state, action] = useActionState(saveTrainer, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !trainer;
  const s = useSlugSync(trainer?.name || "", trainer?.slug || "", isNew);
  const [photo, setPhoto] = React.useState(trainer?.photo_url || "");
  const [featured, setFeatured] = React.useState(trainer?.is_featured ?? false);
  const [active, setActive] = React.useState(trainer?.is_active ?? true);
  const err = state?.errors || {};
  return (
    <form action={action} onChange={touch}>
      {trainer && <input type="hidden" name="id" value={trainer.id} />}
      <input type="hidden" name="photo_url" value={photo} />
      <input type="hidden" name="is_featured" value={featured ? "true" : "false"} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <EditorBar backHref="/admin/trainers" backLabel="Trainers" title={isNew ? "New trainer" : s.title || "Trainer"} subtitle={trainer?.title} dirty={dirty} state={state} saveLabel={isNew ? "Create trainer" : "Save changes"} />
      <EditorGrid aside={
        <>
          <Panel title="Photo">
            <ImageField label="Portrait" value={photo} onChange={(v) => { setPhoto(v); touch(); }} hint="Square photo, at least 400×400." />
          </Panel>
          <Panel title="Visibility">
            <div className="space-y-4">
              <Toggle checked={active} onChange={(v) => { setActive(v); touch(); }} label="Active" description="Inactive trainers are hidden from the website." />
              <Toggle checked={featured} onChange={(v) => { setFeatured(v); touch(); }} label="Featured" description="Shown in the spotlight / featured-only trainer blocks." />
              <AField label="Sort order" htmlFor="sort_order" error={err.sort_order} hint="Lower numbers appear first."><AInput id="sort_order" name="sort_order" type="number" defaultValue={trainer?.sort_order ?? 0} /></AField>
            </div>
          </Panel>
        </>
      }>
        <Panel title="Profile">
          <FieldGroup>
            <FieldGroup cols={2}>
              <AField label="Full name" htmlFor="name" required error={err.name}><AInput id="name" name="name" value={s.title} onChange={(e) => s.setTitle(e.target.value)} required placeholder="Dr. Niroth Samarawickrama" /></AField>
              <AField label="Designation" htmlFor="title" error={err.title}><AInput id="title" name="title" defaultValue={trainer?.title || ""} placeholder="Founder & Chief Lecturer" /></AField>
            </FieldGroup>
            <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} prefix="trainer/" hint="Used as a stable identifier in links." />
            <AField label="Qualifications" htmlFor="qualifications" error={err.qualifications} hint="e.g. PhD (Computer Science), MSc, BSc (Hons)"><AInput id="qualifications" name="qualifications" defaultValue={trainer?.qualifications || ""} /></AField>
            <AField label="Bio" htmlFor="bio" error={err.bio}><ATextarea id="bio" name="bio" rows={6} defaultValue={trainer?.bio || ""} placeholder="A short professional biography…" /></AField>
          </FieldGroup>
        </Panel>
        <Panel title="Contact">
          <FieldGroup cols={2}>
            <AField label="Email" htmlFor="email" error={err.email} hint="Internal reference only; not shown publicly."><AInput id="email" name="email" type="email" defaultValue={trainer?.email || ""} /></AField>
            <AField label="LinkedIn URL" htmlFor="linkedin_url" error={err.linkedin_url}><AInput id="linkedin_url" name="linkedin_url" type="url" defaultValue={trainer?.linkedin_url || ""} placeholder="https://www.linkedin.com/in/…" /></AField>
          </FieldGroup>
        </Panel>
      </EditorGrid>
    </form>
  );
}
