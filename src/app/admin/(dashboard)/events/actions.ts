"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ActionState } from "@/components/admin/ui";
import { cleanSeo, fromLocalInput, parseIntArray, parseJson, str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  excerpt: z.string().trim().max(600),
  content: z.string().max(200000),
  start_at: z.string().min(1, "Start date and time are required"),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  venue: z.string().trim().max(200),
  address: z.string().trim().max(400),
  is_online: z.boolean(),
  image_url: z.string().trim().max(1000),
  cost: z.string().trim().max(100),
  registration_url: z.union([z.literal(""), z.url("Enter a full URL")]),
  workshop_id: z.number().int().positive().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  is_featured: z.boolean(),
});

type Speaker = { name: string; title?: string; photo_url?: string };
function cleanSpeakers(raw: unknown): Speaker[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((s) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const photo = o.photo_url && typeof o.photo_url === "object" ? (o.photo_url as { url?: string }).url : o.photo_url;
    const out: Speaker = { name: typeof o.name === "string" ? o.name.trim().slice(0, 160) : "" };
    if (typeof o.title === "string" && o.title.trim()) out.title = o.title.trim().slice(0, 200);
    if (typeof photo === "string" && photo.trim()) out.photo_url = photo.trim().slice(0, 1000);
    return out;
  }).filter((s) => s.name);
}

export async function saveEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const startAt = fromLocalInput(str(fd, "start_at"));
  const endAt = fromLocalInput(str(fd, "end_at"));
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, title: str(fd, "title"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "title")), excerpt: str(fd, "excerpt"), content: str(fd, "content"),
    start_at: startAt || "", end_at: endAt, all_day: bool(fd, "all_day"), venue: str(fd, "venue"), address: str(fd, "address"), is_online: bool(fd, "is_online"), image_url: str(fd, "image_url"),
    cost: str(fd, "cost"), registration_url: str(fd, "registration_url").trim(), workshop_id: num(fd, "workshop_id"), status: str(fd, "status") || "draft", is_featured: bool(fd, "is_featured"),
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (d.end_at && new Date(d.end_at) < new Date(d.start_at)) return { ok: false, message: "End must be after start.", errors: { end_at: "The end time is before the start time." } };
  const dupe = d.id ? await sql`select 1 from public.events where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.events where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "Slug already in use.", errors: { slug: "Another event already uses this slug." } };
  if (d.workshop_id) {
    const w = await sql`select 1 from public.reg_workshops where id = ${d.workshop_id}`;
    if (!w.length) return { ok: false, message: "Workshop not found.", errors: { workshop_id: "That workshop no longer exists." } };
  }
  const categoryIds = parseIntArray(str(fd, "category_ids"));
  const speakers = cleanSpeakers(parseJson(str(fd, "speakers"), []));
  const seo = cleanSeo(parseJson<unknown>(str(fd, "seo"), {}));
  const values = {
    title: d.title, slug: d.slug, excerpt: d.excerpt, content: sanitizeHtml(d.content), start_at: d.start_at, end_at: d.end_at, all_day: d.all_day, timezone: "Asia/Colombo", venue: d.venue, address: d.address,
    is_online: d.is_online, image_url: optional(d.image_url), cost: d.cost, registration_url: optional(d.registration_url), workshop_id: d.workshop_id, category_ids: categoryIds,
    speakers: sql.json(speakers as never), status: d.status, is_featured: d.is_featured, seo: sql.json(seo as never),
  };
  if (d.id) {
    const [prev] = await sql<{ slug: string }[]>`select slug from public.events where id = ${d.id}`;
    if (!prev) return { ok: false, message: "Event not found." };
    await sql`update public.events set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "event", d.id, { slug: d.slug });
    bust(TAGS.events);
    return { ok: true, message: "Event saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.events ${sql(values)} returning id`;
  await audit(user, "create", "event", row.id, { slug: d.slug });
  bust(TAGS.events);
  redirect(`/admin/events/${row.id}`);
}

export async function deleteEvent(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ slug: string }[]>`delete from public.events where id = ${id} returning slug`;
  if (!row) return { ok: false, message: "Event not found." };
  await audit(user, "delete", "event", id, { slug: row.slug });
  bust(TAGS.events);
  return { ok: true, message: "Event deleted." };
}

export async function duplicateEvent(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [src] = await sql<{ slug: string; title: string }[]>`select slug, title from public.events where id = ${id}`;
  if (!src) return { ok: false, message: "Event not found." };
  let slug = `${src.slug}-copy`; let n = 2;
  while ((await sql`select 1 from public.events where slug = ${slug}`).length) slug = `${src.slug}-copy-${n++}`;
  const [row] = await sql<{ id: string }[]>`insert into public.events (slug, title, excerpt, content, start_at, end_at, all_day, timezone, venue, address, is_online, image_url, cost, registration_url, workshop_id, category_ids, speakers, status, is_featured, seo)
    select ${slug}, ${src.title + " (copy)"}, excerpt, content, start_at, end_at, all_day, timezone, venue, address, is_online, image_url, cost, registration_url, null, category_ids, speakers, 'draft', false, seo from public.events where id = ${id} returning id`;
  await audit(user, "create", "event", row.id, { duplicated_from: id });
  bust(TAGS.events);
  return { ok: true, message: "Event duplicated as a draft.", id: row.id };
}

/* ───────── Categories ───────── */
const catSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour"),
});

export async function saveEventCategory(fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = catSchema.safeParse({ id: num(fd, "id") ?? undefined, name: str(fd, "name"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "name")), color: (str(fd, "color") || "#046BD2").toUpperCase() });
  if (!parsed.success) return { ok: false, message: Object.values(zodErrors(parsed.error))[0] || "Invalid category.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.event_categories where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.event_categories where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "A category with that slug already exists." };
  if (d.id) {
    await sql`update public.event_categories set name = ${d.name}, slug = ${d.slug}, color = ${d.color} where id = ${d.id}`;
    await audit(user, "update", "event_category", d.id, { slug: d.slug });
    bust(TAGS.events);
    return { ok: true, message: "Category saved.", id: d.id };
  }
  const [row] = await sql<{ id: number }[]>`insert into public.event_categories (name, slug, color) values (${d.name}, ${d.slug}, ${d.color}) returning id`;
  await audit(user, "create", "event_category", row.id, { slug: d.slug });
  bust(TAGS.events);
  return { ok: true, message: "Category added.", id: row.id };
}

export async function deleteEventCategory(id: number): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Invalid id." };
  await sql.begin(async (tx) => {
    await tx`update public.events set category_ids = array_remove(category_ids, ${id}::int) where ${id}::int = any(category_ids)`;
    await tx`delete from public.event_categories where id = ${id}`;
  });
  await audit(user, "delete", "event_category", id);
  bust(TAGS.events);
  return { ok: true, message: "Category deleted." };
}
