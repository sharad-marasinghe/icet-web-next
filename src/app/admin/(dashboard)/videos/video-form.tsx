"use client";

import * as React from "react";
import { useActionState } from "react";
import Image from "next/image";
import { PlayCircle, ExternalLink } from "lucide-react";
import { AField, AInput, Toggle, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { youtubeId } from "@/lib/utils";
import { saveVideo } from "./actions";

export type VideoRecord = { id: string; title: string; youtube_id: string; thumbnail_url: string | null; collection: string; sort_order: number; is_active: boolean };
const DEFAULT_COLLECTIONS = ["student_life", "alumni_podcast", "testimonials", "testimonials_icd", "testimonials_icp", "testimonials_icm"];

export function VideoForm({ item, collections }: { item: VideoRecord | null; collections: string[] }) {
  const [state, action] = useActionState(saveVideo, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !item;
  const [title, setTitle] = React.useState(item?.title || "");
  const [yt, setYt] = React.useState(item ? `https://www.youtube.com/watch?v=${item.youtube_id}` : "");
  const [thumb, setThumb] = React.useState(item?.thumbnail_url || "");
  const [active, setActive] = React.useState(item?.is_active ?? true);
  const yid = youtubeId(yt.trim());
  const preview = thumb || (yid ? `https://i.ytimg.com/vi/${yid}/hqdefault.jpg` : "");
  const suggestions = Array.from(new Set([...DEFAULT_COLLECTIONS, ...collections]));
  const err = state?.errors || {};
  return (
    <form action={action} onChange={touch}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="thumbnail_url" value={thumb} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />
      <EditorBar backHref="/admin/videos" backLabel="Videos" title={isNew ? "New video" : title || "Video"} subtitle={yid ? <span className="font-mono">{yid}</span> : undefined} dirty={dirty} state={state} viewHref={yid ? `https://www.youtube.com/watch?v=${yid}` : null} saveLabel={isNew ? "Add video" : "Save changes"} />
      <EditorGrid aside={
        <>
          <Panel title="Preview">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
              {preview ? <Image src={preview} alt="" fill sizes="340px" className="object-cover" unoptimized /> : <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white/40" />}
              {yid && <a href={`https://www.youtube.com/watch?v=${yid}`} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center bg-black/20 text-white opacity-90 hover:opacity-100" aria-label="Open on YouTube"><PlayCircle className="h-12 w-12 drop-shadow" /></a>}
            </div>
            {yid ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">Video id <code className="rounded bg-slate-100 px-1 font-mono">{yid}</code> <ExternalLink className="h-3 w-3" /></p> : <p className="mt-2 text-xs text-amber-700">Paste a YouTube link to see the preview.</p>}
          </Panel>
          <Panel title="Display">
            <div className="space-y-4">
              <Toggle checked={active} onChange={(v) => { setActive(v); touch(); }} label="Active" description="Inactive videos are hidden from the website." />
              <AField label="Sort order" htmlFor="sort_order" error={err.sort_order}><AInput id="sort_order" name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} /></AField>
            </div>
          </Panel>
        </>
      }>
        <Panel title="Video">
          <FieldGroup>
            <AField label="Title" htmlFor="title" required error={err.title}><AInput id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="A day at iCET – student life" /></AField>
            <AField label="YouTube URL or video id" htmlFor="youtube" required error={err.youtube} hint="Accepts watch, shorts, embed and youtu.be links."><AInput id="youtube" name="youtube" value={yt} onChange={(e) => setYt(e.target.value)} required placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" className="font-mono text-[13px]" /></AField>
            <AField label="Collection" htmlFor="collection" required error={err.collection} hint="Pick an existing collection or type a new key (snake_case).">
              <AInput id="collection" name="collection" list="video-collections" defaultValue={item?.collection || "student_life"} required className="font-mono text-[13px]" />
              <datalist id="video-collections">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
            </AField>
            <ImageField label="Custom thumbnail (optional)" value={thumb} onChange={(v) => { setThumb(v); touch(); }} hint="Leave empty to use the YouTube thumbnail." />
          </FieldGroup>
        </Panel>
      </EditorGrid>
    </form>
  );
}
