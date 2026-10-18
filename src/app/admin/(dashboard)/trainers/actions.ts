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

const schema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  name: z.string().trim().min(1, "Name is required").max(160),
  title: z.string().trim().max(200),
  qualifications: z.string().trim().max(500),
  bio: z.string().trim().max(5000),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  photo_url: z.string().trim().max(1000),
  linkedin_url: z.union([z.literal(""), z.url("Enter a full URL starting with https://")]),
  is_featured: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export async function saveTrainer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, slug: slugify(str(fd, "slug")) || slugify(str(fd, "name")), name: str(fd, "name"), title: str(fd, "title"), qualifications: str(fd, "qualifications"),
    bio: str(fd, "bio"), email: str(fd, "email").trim(), photo_url: str(fd, "photo_url"), linkedin_url: str(fd, "linkedin_url").trim(), is_featured: bool(fd, "is_featured"), is_active: bool(fd, "is_active"), sort_order: num(fd, "sort_order") ?? 0,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.trainers where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.trainers where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "Slug already in use.", errors: { slug: "Another trainer already uses this slug." } };
  const values = { slug: d.slug, name: d.name, title: d.title, qualifications: d.qualifications, bio: d.bio, email: optional(d.email), photo_url: optional(d.photo_url), linkedin_url: optional(d.linkedin_url), is_featured: d.is_featured, is_active: d.is_active, sort_order: d.sort_order, updated_at: new Date() };
  if (d.id) {
    await sql`update public.trainers set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "trainer", d.id, { name: d.name });
    bust(TAGS.trainers);
    return { ok: true, message: "Trainer saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.trainers ${sql(values)} returning id`;
  await audit(user, "create", "trainer", row.id, { name: d.name });
  bust(TAGS.trainers);
  redirect(`/admin/trainers/${row.id}`);
}

export async function deleteTrainer(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ name: string }[]>`delete from public.trainers where id = ${id} returning name`;
  if (!row) return { ok: false, message: "Trainer not found." };
  await audit(user, "delete", "trainer", id, { name: row.name });
  bust(TAGS.trainers);
  return { ok: true, message: "Trainer deleted." };
}

/** Persist a new order: ids in display order, `offset` = position of the first id (pagination). */
export async function reorderTrainers(ids: string[], offset = 0): Promise<ActionState> {
  const user = await assertRole("editor");
  const list = z.array(z.uuid()).max(500).safeParse(ids);
  if (!list.success) return { ok: false, message: "Invalid order." };
  await sql.begin(async (tx) => {
    for (let i = 0; i < list.data.length; i++) await tx`update public.trainers set sort_order = ${offset + i} where id = ${list.data[i]}`;
  });
  await audit(user, "reorder", "trainer", null, { count: list.data.length });
  bust(TAGS.trainers);
  return { ok: true, message: "Order saved." };
}

export async function toggleTrainer(id: string, field: "is_active" | "is_featured", value: boolean): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  if (field === "is_active") await sql`update public.trainers set is_active = ${value} where id = ${id}`;
  else await sql`update public.trainers set is_featured = ${value} where id = ${id}`;
  await audit(user, "update", "trainer", id, { [field]: value });
  bust(TAGS.trainers);
  return { ok: true };
}
