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
import { cleanSeo, fromLocalInput, parseIntArray, parseJson, parseStringArray, readingMinutes, str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  excerpt: z.string().trim().max(600),
  content: z.string().max(500000),
  cover_image: z.string().trim().max(1000),
  author_name: z.string().trim().max(160),
  author_title: z.string().trim().max(200),
  author_photo: z.string().trim().max(1000),
  reading_minutes: z.number().int().min(1, "At least 1 minute").max(600).nullable(),
  status: z.enum(["draft", "published", "archived"]),
  published_at: z.string().nullable(),
  is_featured: z.boolean(),
});

export async function savePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, title: str(fd, "title"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "title")), excerpt: str(fd, "excerpt"), content: str(fd, "content", 500000),
    cover_image: str(fd, "cover_image"), author_name: str(fd, "author_name"), author_title: str(fd, "author_title"), author_photo: str(fd, "author_photo"),
    reading_minutes: num(fd, "reading_minutes"), status: str(fd, "status") || "draft", published_at: fromLocalInput(str(fd, "published_at")), is_featured: bool(fd, "is_featured"),
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.posts where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.posts where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "Slug already in use.", errors: { slug: "Another post already uses this slug." } };
  const content = sanitizeHtml(d.content);
  const tags = parseStringArray(str(fd, "tags")).map((t) => t.toLowerCase().slice(0, 40)).slice(0, 20);
  const categoryIds = parseIntArray(str(fd, "category_ids"));
  const seo = cleanSeo(parseJson<unknown>(str(fd, "seo"), {}));
  const publishedAt = d.status === "published" ? d.published_at || new Date().toISOString() : d.published_at;
  const values = {
    title: d.title, slug: d.slug, excerpt: d.excerpt, content, cover_image: optional(d.cover_image), author_name: d.author_name || user.full_name || "", author_title: d.author_title,
    author_photo: optional(d.author_photo), category_ids: categoryIds, tags, reading_minutes: d.reading_minutes ?? readingMinutes(content), status: d.status, is_featured: d.is_featured,
    published_at: publishedAt, seo: sql.json(seo as never),
  };
  if (d.id) {
    const [prev] = await sql<{ id: string }[]>`select id from public.posts where id = ${d.id}`;
    if (!prev) return { ok: false, message: "Post not found." };
    await sql`update public.posts set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "post", d.id, { slug: d.slug, status: d.status });
    bust(TAGS.posts);
    return { ok: true, message: "Post saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.posts ${sql({ ...values, author_id: user.id })} returning id`;
  await audit(user, "create", "post", row.id, { slug: d.slug });
  bust(TAGS.posts);
  redirect(`/admin/posts/${row.id}`);
}

export async function deletePost(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ slug: string }[]>`delete from public.posts where id = ${id} returning slug`;
  if (!row) return { ok: false, message: "Post not found." };
  await audit(user, "delete", "post", id, { slug: row.slug });
  bust(TAGS.posts);
  return { ok: true, message: "Post deleted." };
}

export async function duplicatePost(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [src] = await sql<{ slug: string; title: string }[]>`select slug, title from public.posts where id = ${id}`;
  if (!src) return { ok: false, message: "Post not found." };
  let slug = `${src.slug}-copy`; let n = 2;
  while ((await sql`select 1 from public.posts where slug = ${slug}`).length) slug = `${src.slug}-copy-${n++}`;
  const [row] = await sql<{ id: string }[]>`insert into public.posts (slug, title, excerpt, content, cover_image, author_id, author_name, author_title, author_photo, category_ids, tags, reading_minutes, status, is_featured, published_at, seo)
    select ${slug}, ${src.title + " (copy)"}, excerpt, content, cover_image, ${user.id}, author_name, author_title, author_photo, category_ids, tags, reading_minutes, 'draft', false, null, seo from public.posts where id = ${id} returning id`;
  await audit(user, "create", "post", row.id, { duplicated_from: id });
  bust(TAGS.posts);
  return { ok: true, message: "Post duplicated as a draft.", id: row.id };
}

/* ───────── Categories ───────── */
const catSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
});

export async function savePostCategory(fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = catSchema.safeParse({ id: num(fd, "id") ?? undefined, name: str(fd, "name"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "name")) });
  if (!parsed.success) return { ok: false, message: Object.values(zodErrors(parsed.error))[0] || "Invalid category.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.post_categories where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.post_categories where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "A category with that slug already exists." };
  if (d.id) {
    await sql`update public.post_categories set name = ${d.name}, slug = ${d.slug} where id = ${d.id}`;
    await audit(user, "update", "post_category", d.id, { slug: d.slug });
    bust(TAGS.posts);
    return { ok: true, message: "Category saved.", id: d.id };
  }
  const [row] = await sql<{ id: number }[]>`insert into public.post_categories (name, slug) values (${d.name}, ${d.slug}) returning id`;
  await audit(user, "create", "post_category", row.id, { slug: d.slug });
  bust(TAGS.posts);
  return { ok: true, message: "Category added.", id: row.id };
}

export async function deletePostCategory(id: number): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Invalid id." };
  await sql.begin(async (tx) => {
    await tx`update public.posts set category_ids = array_remove(category_ids, ${id}::int) where ${id}::int = any(category_ids)`;
    await tx`delete from public.post_categories where id = ${id}`;
  });
  await audit(user, "delete", "post_category", id);
  bust(TAGS.posts);
  return { ok: true, message: "Category deleted." };
}
