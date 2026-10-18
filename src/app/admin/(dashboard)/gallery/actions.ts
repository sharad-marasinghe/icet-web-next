"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/admin/ui";
import { str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const albumSchema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000),
  event_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")]),
  cover_url: z.string().trim().max(1000),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export async function saveAlbum(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = albumSchema.safeParse({
    id: str(fd, "id") || undefined, slug: slugify(str(fd, "slug")) || slugify(str(fd, "title")), title: str(fd, "title"), description: str(fd, "description"),
    event_date: str(fd, "event_date").trim(), cover_url: str(fd, "cover_url"), is_active: bool(fd, "is_active"), sort_order: num(fd, "sort_order") ?? 0,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.gallery_albums where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.gallery_albums where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "Slug already in use.", errors: { slug: "Another album already uses this slug." } };
  const values = { slug: d.slug, title: d.title, description: d.description, event_date: d.event_date || null, cover_url: optional(d.cover_url), is_active: d.is_active, sort_order: d.sort_order };
  if (d.id) {
    await sql`update public.gallery_albums set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "gallery_album", d.id, { slug: d.slug });
    bust(TAGS.gallery);
    return { ok: true, message: "Album saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.gallery_albums ${sql(values)} returning id`;
  await audit(user, "create", "gallery_album", row.id, { slug: d.slug });
  bust(TAGS.gallery);
  redirect(`/admin/gallery/${row.id}`);
}

export async function deleteAlbum(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ slug: string }[]>`delete from public.gallery_albums where id = ${id} returning slug`;
  if (!row) return { ok: false, message: "Album not found." };
  await audit(user, "delete", "gallery_album", id, { slug: row.slug });
  bust(TAGS.gallery);
  return { ok: true, message: "Album and its images deleted." };
}

/* ───────── Images ───────── */
const imageInput = z.object({ url: z.url().max(1000), width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional(), alt: z.string().max(500).optional() });

export async function addGalleryImages(albumId: string, items: { url: string; width?: number | null; height?: number | null; alt?: string }[]): Promise<{ ok: boolean; message?: string; images?: GalleryImageRow[] }> {
  const user = await assertRole("editor");
  const parsed = z.object({ albumId: z.uuid(), items: z.array(imageInput).min(1).max(100) }).safeParse({ albumId, items });
  if (!parsed.success) return { ok: false, message: "Invalid upload payload." };
  const [album] = await sql<{ title: string }[]>`select title from public.gallery_albums where id = ${albumId}`;
  if (!album) return { ok: false, message: "Album not found." };
  const inserted = await sql.begin(async (tx) => {
    const [{ next }] = await tx<{ next: number }[]>`select coalesce(max(sort_order), -1) + 1 as next from public.gallery_images where album_id = ${albumId}`;
    const out: GalleryImageRow[] = [];
    for (let i = 0; i < parsed.data.items.length; i++) {
      const it = parsed.data.items[i];
      const [row] = await tx<GalleryImageRow[]>`insert into public.gallery_images (album_id, url, alt, caption, width, height, sort_order)
        values (${albumId}, ${it.url}, ${it.alt?.trim() || album.title}, '', ${it.width ?? null}, ${it.height ?? null}, ${next + i})
        returning id, album_id, url, alt, caption, width, height, sort_order`;
      out.push({ ...row });
    }
    return out;
  });
  await sql`update public.gallery_albums set cover_url = coalesce(cover_url, ${inserted[0].url}) where id = ${albumId}`;
  await audit(user, "create", "gallery_image", albumId, { count: inserted.length });
  bust(TAGS.gallery);
  return { ok: true, message: `${inserted.length} image${inserted.length === 1 ? "" : "s"} added.`, images: inserted };
}

export type GalleryImageRow = { id: string; album_id: string; url: string; alt: string; caption: string; width: number | null; height: number | null; sort_order: number };

export async function updateGalleryImage(id: string, patch: { alt: string; caption: string }): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = z.object({ id: z.uuid(), alt: z.string().trim().max(500), caption: z.string().trim().max(1000) }).safeParse({ id, ...patch });
  if (!parsed.success) return { ok: false, message: "Invalid image details." };
  await sql`update public.gallery_images set alt = ${parsed.data.alt}, caption = ${parsed.data.caption} where id = ${id}`;
  await audit(user, "update", "gallery_image", id);
  bust(TAGS.gallery);
  return { ok: true, message: "Image details saved." };
}

export async function deleteGalleryImage(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ album_id: string; url: string }[]>`delete from public.gallery_images where id = ${id} returning album_id, url`;
  if (!row) return { ok: false, message: "Image not found." };
  // if it was the cover, fall back to the first remaining image
  await sql`update public.gallery_albums a set cover_url = (select url from public.gallery_images i where i.album_id = a.id order by sort_order limit 1) where a.id = ${row.album_id} and a.cover_url = ${row.url}`;
  await audit(user, "delete", "gallery_image", id, { album_id: row.album_id });
  bust(TAGS.gallery);
  return { ok: true, message: "Image removed from album." };
}

export async function reorderGalleryImages(albumId: string, ids: string[]): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = z.object({ albumId: z.uuid(), ids: z.array(z.uuid()).max(1000) }).safeParse({ albumId, ids });
  if (!parsed.success) return { ok: false, message: "Invalid order." };
  await sql.begin(async (tx) => {
    for (let i = 0; i < parsed.data.ids.length; i++) await tx`update public.gallery_images set sort_order = ${i} where id = ${parsed.data.ids[i]} and album_id = ${albumId}`;
  });
  await audit(user, "reorder", "gallery_image", albumId, { count: ids.length });
  bust(TAGS.gallery);
  return { ok: true, message: "Order saved." };
}

export async function setAlbumCover(albumId: string, url: string): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = z.object({ albumId: z.uuid(), url: z.url().max(1000) }).safeParse({ albumId, url });
  if (!parsed.success) return { ok: false, message: "Invalid cover." };
  await sql`update public.gallery_albums set cover_url = ${url} where id = ${albumId}`;
  await audit(user, "update", "gallery_album", albumId, { cover: true });
  bust(TAGS.gallery);
  return { ok: true, message: "Cover updated." };
}
