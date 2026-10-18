"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, Search, Check, Loader2, FileText, X, ImageIcon, Trash2, FolderOpen } from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "./ui";

export type MediaItem = { id: string; url: string; path: string; folder: string; filename: string; title: string; alt: string; mime_type: string; size_bytes: number; width: number | null; height: number | null; created_at: string };

async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Upload a file to the `media` bucket from the browser (RLS: staff) and register it. */
export async function uploadMedia(file: File, folder = "uploads", onProgress?: (p: number) => void): Promise<MediaItem> {
  const supabase = createClient();
  const now = new Date();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "file";
  const path = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${base}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  onProgress?.(10);
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  onProgress?.(70);
  const dims = await readDimensions(file);
  const res = await fetch("/admin/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, filename: file.name, mime_type: file.type, size_bytes: file.size, width: dims?.width ?? null, height: dims?.height ?? null, folder, title: file.name.replace(/\.[^.]+$/, "") }) });
  if (!res.ok) throw new Error("Could not register the upload.");
  onProgress?.(100);
  const data = await res.json();
  return data.item as MediaItem;
}

export function MediaLibrary({ onSelect, selectable = true, accept = "image", folder: initialFolder }: { onSelect?: (item: MediaItem) => void; selectable?: boolean; accept?: "image" | "all"; folder?: string }) {
  const toast = useToast();
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [folders, setFolders] = React.useState<{ folder: string; n: number }[]>([]);
  const [q, setQ] = React.useState("");
  const [folder, setFolder] = React.useState(initialFolder || "");
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [editing, setEditing] = React.useState<MediaItem | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/media?q=${encodeURIComponent(q)}&folder=${encodeURIComponent(folder)}&page=${page}&type=${accept === "image" ? "image" : ""}`, { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
      setPages(data.pages || 1);
      setFolders(data.folders || []);
    } finally {
      setLoading(false);
    }
  }, [q, folder, page, accept]);
  React.useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(0);
    try {
      let first: MediaItem | null = null;
      for (let i = 0; i < files.length; i++) {
        const item = await uploadMedia(files[i], folder || "uploads", (p) => setUploading(Math.round(((i + p / 100) / files.length) * 100)));
        if (!first) first = item;
      }
      toast({ tone: "success", message: `${files.length} file${files.length > 1 ? "s" : ""} uploaded.` });
      setPage(1);
      await load();
      if (first) setSelected(first);
    } catch (e) {
      toast({ tone: "error", message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveMeta() {
    if (!editing) return;
    await fetch("/admin/api/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, title: editing.title, alt: editing.alt, folder: editing.folder }) });
    toast({ tone: "success", message: "Saved" });
    setEditing(null);
    load();
  }
  async function remove(item: MediaItem) {
    if (!confirm(`Delete ${item.filename}? Pages still referencing it will show a broken image.`)) return;
    await fetch("/admin/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    toast({ tone: "success", message: "Deleted" });
    if (selected?.id === item.id) setSelected(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search files…" className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100" />
          </div>
          <select value={folder} onChange={(e) => { setFolder(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">All folders</option>
            {folders.map((f) => <option key={f.folder} value={f.folder}>{f.folder || "(root)"} ({f.n})</option>)}
          </select>
          <input ref={inputRef} type="file" multiple accept={accept === "image" ? "image/*" : undefined} className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" size="md" onClick={() => inputRef.current?.click()} disabled={uploading !== null}>
            {uploading !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> {uploading}%</> : <><Upload className="h-4 w-4" /> Upload</>}
          </Button>
        </div>
        <div
          className="mt-4 min-h-[320px] rounded-xl border-2 border-dashed border-slate-200 p-3"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-brand-500", "bg-brand-50"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("border-brand-500", "bg-brand-50")}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-brand-500", "bg-brand-50"); onFiles(e.dataTransfer.files); }}
        >
          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}</div>
          ) : items.length === 0 ? (
            <div className="grid h-full min-h-[280px] place-items-center text-center text-sm text-slate-500"><div><ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />No files yet. Drag & drop or use Upload.</div></div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((it) => {
                const isImg = it.mime_type.startsWith("image/");
                const active = selected?.id === it.id;
                return (
                  <button key={it.id} type="button" onClick={() => setSelected(it)} onDoubleClick={() => onSelect?.(it)} className={cn("group relative aspect-square overflow-hidden rounded-lg border bg-slate-50 text-left", active ? "border-brand-600 ring-2 ring-brand-200" : "border-slate-200 hover:border-brand-300")} title={it.filename}>
                    {isImg ? <Image src={it.url} alt={it.alt || it.filename} fill sizes="160px" className="object-cover" unoptimized={it.mime_type === "image/svg+xml"} /> : <div className="grid h-full place-items-center p-2 text-center text-[10px] text-slate-500"><FileText className="mb-1 h-7 w-7 text-slate-400" />{it.filename}</div>}
                    {active && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white"><Check className="h-3.5 w-3.5" /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} / {pages}</span>
            <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
          </div>
        )}
      </div>
      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:w-72">
        {selected ? (
          <>
            {selected.mime_type.startsWith("image/") && <div className="relative aspect-video overflow-hidden rounded-lg bg-white"><Image src={selected.url} alt={selected.alt} fill sizes="300px" className="object-contain" /></div>}
            <p className="mt-3 break-all text-xs font-semibold text-slate-800">{selected.filename}</p>
            <p className="text-xs text-slate-500">{selected.width && selected.height ? `${selected.width}×${selected.height} · ` : ""}{(selected.size_bytes / 1024).toFixed(0)} KB</p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Title<input value={(editing?.id === selected.id ? editing.title : selected.title) || ""} onChange={(e) => setEditing({ ...(editing?.id === selected.id ? editing : selected), title: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            <label className="mt-2 block text-xs font-semibold text-slate-600">Alt text<input value={(editing?.id === selected.id ? editing.alt : selected.alt) || ""} onChange={(e) => setEditing({ ...(editing?.id === selected.id ? editing : selected), alt: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" placeholder="Describe the image for SEO & accessibility" /></label>
            <label className="mt-2 block text-xs font-semibold text-slate-600">Folder<input value={(editing?.id === selected.id ? editing.folder : selected.folder) || ""} onChange={(e) => setEditing({ ...(editing?.id === selected.id ? editing : selected), folder: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            <input readOnly value={selected.url} onClick={(e) => (e.target as HTMLInputElement).select()} className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-500" aria-label="File URL" />
            <div className="mt-3 flex flex-wrap gap-2">
              {editing?.id === selected.id && <Button type="button" size="sm" variant="outline" onClick={saveMeta}>Save details</Button>}
              {selectable && onSelect && <Button type="button" size="sm" onClick={() => onSelect(editing?.id === selected.id ? editing : selected)}><Check className="h-4 w-4" /> Use this file</Button>}
              <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(selected)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </>
        ) : (
          <div className="grid h-full min-h-[200px] place-items-center text-center text-sm text-slate-500"><div><FolderOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />Select a file to see details.</div></div>
        )}
      </aside>
    </div>
  );
}

export function MediaPickerButton({ onSelect, children, className, title = "Choose from media library", accept = "image" }: { onSelect: (url: string, alt?: string, item?: MediaItem) => void; children: React.ReactNode; className?: string; title?: string; accept?: "image" | "all" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title}>{children}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Media library" wide>
        <MediaLibrary accept={accept} onSelect={(item) => { onSelect(item.url, item.alt, item); setOpen(false); }} />
      </Modal>
    </>
  );
}

/** Form field: image URL with preview, library picker, direct upload and alt text. */
export function ImageField({ value, onChange, label = "Image", alt, onAltChange, hint, name, altName }: { value?: string; onChange: (url: string) => void; label?: React.ReactNode; alt?: string; onAltChange?: (alt: string) => void; hint?: string; name?: string; altName?: string }) {
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700">{label}</p>
      {name && <input type="hidden" name={name} value={value || ""} />}
      {altName && <input type="hidden" name={altName} value={alt || ""} />}
      <div className="flex gap-3">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value ? <Image src={value} alt={alt || ""} fill sizes="128px" className="object-cover" unoptimized={value.endsWith(".svg")} /> : <div className="grid h-full place-items-center text-slate-300"><ImageIcon className="h-7 w-7" /></div>}
          {value && <button type="button" onClick={() => onChange("")} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-slate-600 shadow hover:text-rose-600" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://… or pick from library" className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs" />
          <div className="flex flex-wrap gap-2">
            <MediaPickerButton onSelect={(url, a) => { onChange(url); if (a && onAltChange && !alt) onAltChange(a); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-brand-400"><FolderOpen className="h-3.5 w-3.5" /> Library</MediaPickerButton>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { const it = await uploadMedia(f, "uploads"); onChange(it.url); } catch (err) { toast({ tone: "error", message: err instanceof Error ? err.message : "Upload failed" }); } finally { setBusy(false); e.target.value = ""; } }} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-brand-400 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload</button>
          </div>
          {onAltChange && <input value={alt || ""} onChange={(e) => onAltChange(e.target.value)} placeholder="Alt text (describe the image)" className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs" />}
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
