"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/admin/ui";
import { cleanBlocks } from "@/components/admin/block-editor/validate";
import { cleanSeo, parseJson, str, bool, zodErrors } from "@/components/admin/content/form-utils";

const RESERVED = new Set(["admin", "api", "events", "blogs", "search", "verify-certificate", "register", "_next", "student-life"]);
const slugSchema = z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens");

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: slugSchema,
  template: z.enum(["blocks", "program", "custom"]).default("blocks"),
});

async function slugTaken(slug: string, excludeId?: string) {
  const rows = excludeId
    ? await sql`select 1 from public.pages where slug = ${slug} and id <> ${excludeId} limit 1`
    : await sql`select 1 from public.pages where slug = ${slug} limit 1`;
  if (rows.length) return true;
  // programme slugs share the same public namespace
  const p = await sql`select 1 from public.programs where slug = ${slug} limit 1`;
  return p.length > 0;
}

export async function createPage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = createSchema.safeParse({ title: str(fd, "title"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "title")), template: str(fd, "template") || "blocks" });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (RESERVED.has(d.slug)) return { ok: false, message: "That slug is reserved.", errors: { slug: "This slug is reserved by the site." } };
  if (await slugTaken(d.slug)) return { ok: false, message: "Slug already in use.", errors: { slug: "Another page or programme already uses this slug." } };
  const [row] = await sql<{ id: string }[]>`
    insert into public.pages (slug, title, template, blocks, seo, status, show_in_search, published_at, updated_by)
    values (${d.slug}, ${d.title}, ${d.template}, '[]'::jsonb, '{}'::jsonb, 'draft', true, null, ${user.id}) returning id`;
  await audit(user, "create", "page", row.id, { slug: d.slug });
  bust(TAGS.pages);
  redirect(`/admin/pages/${row.id}`);
}

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: slugSchema,
  status: z.enum(["draft", "published", "archived"]),
  show_in_search: z.boolean(),
});

export async function updatePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = updateSchema.safeParse({ id: str(fd, "id"), title: str(fd, "title"), slug: slugify(str(fd, "slug")), status: str(fd, "status"), show_in_search: bool(fd, "show_in_search") });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (RESERVED.has(d.slug)) return { ok: false, message: "That slug is reserved.", errors: { slug: "This slug is reserved by the site." } };
  if (await slugTaken(d.slug, d.id)) return { ok: false, message: "Slug already in use.", errors: { slug: "Another page or programme already uses this slug." } };
  const blocks = cleanBlocks(parseJson<unknown>(str(fd, "blocks", 5_000_000), null));
  if (!blocks) return { ok: false, message: "The page content could not be read. Please reload and try again." };
  const seo = cleanSeo(parseJson<unknown>(str(fd, "seo"), {}));
  const [prev] = await sql<{ slug: string; status: string; published_at: string | null }[]>`select slug, status, published_at::text from public.pages where id = ${d.id}`;
  if (!prev) return { ok: false, message: "Page not found." };
  await sql`update public.pages set title = ${d.title}, slug = ${d.slug}, status = ${d.status}::public.publish_status, show_in_search = ${d.show_in_search},
      blocks = ${sql.json(blocks as never)}, seo = ${sql.json(seo as never)}, updated_by = ${user.id},
      published_at = case when ${d.status} = 'published' then coalesce(published_at, now()) else published_at end
    where id = ${d.id}`;
  await audit(user, "update", "page", d.id, { slug: d.slug, status: d.status });
  bust(TAGS.pages, TAGS.page(d.slug));
  if (prev.slug !== d.slug) bust(TAGS.page(prev.slug), TAGS.nav);
  return { ok: true, message: "Page saved.", id: d.id };
}

export async function deletePage(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ slug: string }[]>`delete from public.pages where id = ${id} returning slug`;
  if (!row) return { ok: false, message: "Page not found." };
  await audit(user, "delete", "page", id, { slug: row.slug });
  bust(TAGS.pages, TAGS.page(row.slug), TAGS.nav);
  return { ok: true, message: "Page deleted." };
}

export async function duplicatePage(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [src] = await sql<{ slug: string; title: string }[]>`select slug, title from public.pages where id = ${id}`;
  if (!src) return { ok: false, message: "Page not found." };
  let slug = `${src.slug}-copy`.slice(0, 90);
  for (let n = 2; await slugTaken(slug); n++) slug = `${src.slug}-copy-${n}`.slice(0, 96);
  const [row] = await sql<{ id: string }[]>`
    insert into public.pages (slug, title, template, blocks, seo, status, show_in_search, published_at, updated_by)
    select ${slug}, ${src.title + " (copy)"}, template, blocks, seo, 'draft', show_in_search, null, ${user.id} from public.pages where id = ${id} returning id`;
  await audit(user, "create", "page", row.id, { duplicated_from: id });
  bust(TAGS.pages);
  return { ok: true, message: "Page duplicated as a draft.", id: row.id };
}
