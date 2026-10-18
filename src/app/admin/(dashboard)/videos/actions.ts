"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { youtubeId } from "@/lib/utils";
import type { ActionState } from "@/components/admin/ui";
import { str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  youtube: z.string().trim().min(1, "A YouTube URL or video id is required").max(300),
  thumbnail_url: z.string().trim().max(1000),
  collection: z.string().trim().min(1, "Collection is required").max(60).regex(/^[a-z0-9_-]+$/, "Lower-case letters, numbers, hyphen or underscore"),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

export async function saveVideo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, title: str(fd, "title"), youtube: str(fd, "youtube"), thumbnail_url: str(fd, "thumbnail_url"),
    collection: str(fd, "collection").trim().toLowerCase().replace(/\s+/g, "_") || "student_life", sort_order: num(fd, "sort_order") ?? 0, is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const yid = youtubeId(d.youtube);
  if (!yid) return { ok: false, message: "Could not read a YouTube video id.", errors: { youtube: "Paste a full YouTube link (watch, shorts or youtu.be) or the 11-character id." } };
  const values = { title: d.title, youtube_id: yid, thumbnail_url: optional(d.thumbnail_url), collection: d.collection, sort_order: d.sort_order, is_active: d.is_active };
  if (d.id) {
    await sql`update public.videos set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "video", d.id, { title: d.title });
    bust(TAGS.videos);
    return { ok: true, message: "Video saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.videos ${sql(values)} returning id`;
  await audit(user, "create", "video", row.id, { title: d.title });
  bust(TAGS.videos);
  redirect(`/admin/videos/${row.id}`);
}

export async function deleteVideo(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ title: string }[]>`delete from public.videos where id = ${id} returning title`;
  if (!row) return { ok: false, message: "Video not found." };
  await audit(user, "delete", "video", id, { title: row.title });
  bust(TAGS.videos);
  return { ok: true, message: "Video deleted." };
}
