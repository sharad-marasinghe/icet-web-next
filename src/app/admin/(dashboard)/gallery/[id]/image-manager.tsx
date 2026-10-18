"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Star, Pencil, Trash2, ImagePlus, FolderOpen } from "lucide-react";
import { AField, AInput, ATextarea, Modal, useToast } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { MediaPickerButton, uploadMedia } from "@/components/admin/media-picker";
import { SortableList } from "@/components/admin/content/sortable-list";
import { cn } from "@/lib/utils";
import { addGalleryImages, deleteGalleryImage, reorderGalleryImages, setAlbumCover, updateGalleryImage, type GalleryImageRow } from "../actions";

export function ImageManager({ album, images }: { album: { id: string; slug: string; title: string; cover_url: string | null }; images: GalleryImageRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = React.useState(images);
  const [prev, setPrev] = React.useState(images);
  if (images !== prev) { setPrev(images); setItems(images); }
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [editing, setEditing] = React.useState<GalleryImageRow | null>(null);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFromItems = async (list: { url: string; width?: number | null; height?: number | null; alt?: string }[]) => {
    const res = await addGalleryImages(album.id, list);
    if (res.ok && res.images) { const added = res.images; setItems((xs) => [...xs, ...added]); toast({ tone: "success", message: res.message || "Added" }); router.refresh(); }
    else toast({ tone: "error", message: res.message || "Could not add images" });
  };

  const onFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast({ tone: "error", message: "Only image files can be added to an album." });
    setProgress({ done: 0, total: list.length });
    const uploaded: { url: string; width?: number | null; height?: number | null; alt?: string }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        try {
          const it = await uploadMedia(list[i], `gallery/${album.slug}`);
          uploaded.push({ url: it.url, width: it.width, height: it.height, alt: album.title });
        } catch (e) {
          toast({ tone: "error", message: `${list[i].name}: ${e instanceof Error ? e.message : "upload failed"}` });
        }
        setProgress({ done: i + 1, total: list.length });
      }
      if (uploaded.length) await addFromItems(uploaded);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reorder = async (next: GalleryImageRow[]) => {
    setItems(next);
    const res = await reorderGalleryImages(album.id, next.map((i) => i.id));
    if (!res?.ok) toast({ tone: "error", message: res?.message || "Could not save order" });
    router.refresh();
  };
  const remove = async (img: GalleryImageRow) => {
    if (!confirm("Remove this image from the album? The file stays in the media library.")) return;
    setItems((xs) => xs.filter((x) => x.id !== img.id));
    const res = await deleteGalleryImage(img.id);
    toast({ tone: res?.ok ? "success" : "error", message: res?.message || "" });
    router.refresh();
  };
  const cover = async (img: GalleryImageRow) => {
    const res = await setAlbumCover(album.id, img.url);
    toast({ tone: res?.ok ? "success" : "error", message: res?.message || "" });
    router.refresh();
  };
  const saveMeta = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await updateGalleryImage(editing.id, { alt: editing.alt, caption: editing.caption });
      toast({ tone: res?.ok ? "success" : "error", message: res?.message || "" });
      if (res?.ok) { setItems((xs) => xs.map((x) => (x.id === editing.id ? editing : x))); setEditing(null); router.refresh(); }
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div
        className={cn("relative mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition", dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void onFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
        {progress ? (
          <><Loader2 className="h-7 w-7 animate-spin text-brand-600" /><p className="text-sm font-semibold text-slate-800">Uploading {progress.done} of {progress.total}…</p><div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div></>
        ) : (
          <>
            <ImagePlus className="h-7 w-7 text-brand-500" />
            <p className="text-sm font-semibold text-slate-800">Drag & drop photos here</p>
            <p className="text-xs text-slate-500">JPEG, PNG or WebP. Files are stored under <code className="font-mono">gallery/{album.slug}</code>.</p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Choose files</Button>
              <MediaPickerButton onSelect={(url, alt, item) => void addFromItems([{ url, width: item?.width ?? null, height: item?.height ?? null, alt: alt || album.title }])} className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:border-brand-600 hover:text-brand-700"><FolderOpen className="h-4 w-4" /> From library</MediaPickerButton>
            </div>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No images yet – upload some above.</p>
      ) : (
        <SortableList
          items={items}
          getId={(i) => i.id}
          onReorder={(next) => void reorder(next)}
          layout="grid"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
          renderItem={(img, { handle, index }) => {
            const isCover = album.cover_url === img.url;
            return (
              <figure className={cn("group relative overflow-hidden rounded-xl border bg-white", isCover ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200")}>
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Image src={img.url} alt={img.alt} fill sizes="240px" className="object-cover" />
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-white/90 p-0.5 shadow-sm">{handle}<span className="pr-1.5 text-[11px] font-bold text-slate-600">{index + 1}</span></div>
                  {isCover && <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950"><Star className="h-3 w-3 fill-current" /> Cover</span>}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-0.5 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                    {!isCover && <button type="button" onClick={() => cover(img)} className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-700 hover:text-amber-600" title="Set as cover" aria-label="Set as cover"><Star className="h-3.5 w-3.5" /></button>}
                    <button type="button" onClick={() => setEditing(img)} className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-700 hover:text-brand-700" title="Edit alt text & caption" aria-label="Edit alt text and caption"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => remove(img)} className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-700 hover:text-rose-600" title="Remove" aria-label="Remove image"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <figcaption className="truncate px-2 py-1.5 text-[11px] text-slate-500" title={img.caption || img.alt}>{img.caption || img.alt || <span className="italic">No caption</span>}{img.width && img.height ? <span className="float-right text-slate-400">{img.width}×{img.height}</span> : null}</figcaption>
              </figure>
            );
          }}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Image details" footer={<><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button type="button" size="sm" onClick={saveMeta} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button></>}>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100"><Image src={editing.url} alt={editing.alt} fill sizes="200px" className="object-cover" /></div>
            <div className="space-y-3">
              <AField label="Alt text" htmlFor="img_alt" hint="Describe the photo for accessibility and SEO."><AInput id="img_alt" value={editing.alt} onChange={(e) => setEditing({ ...editing, alt: e.target.value })} /></AField>
              <AField label="Caption" htmlFor="img_caption" hint="Optional; shown in the lightbox."><ATextarea id="img_caption" rows={3} value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} /></AField>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
