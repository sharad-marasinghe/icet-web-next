"use client";

import * as React from "react";
import { useActionState } from "react";
import { AField, AInput, ATextarea, Toggle, ActionToast, SubmitButton, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { FieldGroup } from "@/components/admin/content/form-bits";
import { saveAlbum } from "./actions";

export type AlbumRecord = { id: string; slug: string; title: string; description: string; cover_url: string | null; event_date: string | null; is_active: boolean; sort_order: number };

export function AlbumForm({ album }: { album: AlbumRecord | null }) {
  const [state, action] = useActionState(saveAlbum, initialActionState);
  const s = useSlugSync(album?.title || "", album?.slug || "", !album);
  const [cover, setCover] = React.useState(album?.cover_url || "");
  const [active, setActive] = React.useState(album?.is_active ?? true);
  const [prevCover, setPrevCover] = React.useState(album?.cover_url || "");
  // Keep in sync when the image manager changes the cover (server re-render → new prop).
  if ((album?.cover_url || "") !== prevCover) { setPrevCover(album?.cover_url || ""); setCover(album?.cover_url || ""); }
  const err = state?.errors || {};
  return (
    <form action={action} className="space-y-4">
      <ActionToast state={state} />
      {album && <input type="hidden" name="id" value={album.id} />}
      <input type="hidden" name="cover_url" value={cover} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <AField label="Title" htmlFor="title" required error={err.title}><AInput id="title" name="title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} required placeholder="Graduation Ceremony 2025" /></AField>
      <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} prefix="/student-life/gallery/" />
      <AField label="Description" htmlFor="description" error={err.description}><ATextarea id="description" name="description" rows={3} defaultValue={album?.description || ""} /></AField>
      <FieldGroup cols={2}>
        <AField label="Event date" htmlFor="event_date" error={err.event_date}><AInput id="event_date" name="event_date" type="date" defaultValue={album?.event_date?.slice(0, 10) || ""} /></AField>
        <AField label="Sort order" htmlFor="sort_order" error={err.sort_order}><AInput id="sort_order" name="sort_order" type="number" defaultValue={album?.sort_order ?? 0} /></AField>
      </FieldGroup>
      <ImageField label="Cover image" value={cover} onChange={setCover} hint={album ? "Or use “Set as cover” on any image below." : "You can also pick a cover from the uploaded images later."} />
      <Toggle checked={active} onChange={setActive} label="Active" description="Inactive albums are hidden from the website." />
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {!album && <Button href="/admin/gallery" variant="ghost" size="sm">Cancel</Button>}
        <SubmitButton size="sm">{album ? "Save album" : "Create album"}</SubmitButton>
      </div>
    </form>
  );
}
