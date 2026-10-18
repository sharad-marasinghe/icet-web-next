"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/admin/ui";
import type { ProgramContent } from "@/lib/data/content";
import { cleanBlocks } from "@/components/admin/block-editor/validate";
import { cleanSeo, parseJson, parseStringArray, str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const schema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(1, "Code is required").max(20).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphen or underscore only"),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  name: z.string().trim().min(1, "Name is required").max(200),
  qualification: z.string().trim().max(200),
  tagline: z.string().trim().max(300),
  summary: z.string().trim().max(2000),
  level_label: z.string().trim().max(200),
  duration: z.string().trim().max(100),
  training: z.string().trim().max(200),
  mode: z.string().trim().max(100),
  logo_url: z.string().trim().max(1000),
  hero_image: z.string().trim().max(1000),
  brochure_url: z.string().trim().max(1000),
  fee_from: z.number().nonnegative("Fee must be positive").nullable(),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #046BD2"),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

const textItem = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 500) : "");
function cleanList<T extends Record<string, string>>(raw: unknown, keys: (keyof T)[]): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((item) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const out = {} as T;
    for (const k of keys) { const v = textItem(o[k as string]); if (v) (out as Record<string, string>)[k as string] = v; }
    return out;
  }).filter((o) => Object.keys(o).length > 0);
}

function buildContent(fd: FormData): ProgramContent | null {
  const blocks = cleanBlocks(parseJson<unknown>(str(fd, "blocks", 5_000_000), []));
  if (!blocks) return null;
  const compareRaw = parseJson<Record<string, unknown>>(str(fd, "compare"), {});
  const compare: Record<string, string> = {};
  for (const k of ["entry", "ideal_for", "technologies", "fee"]) { const v = textItem(compareRaw[k]); if (v) compare[k] = v; }
  const content: ProgramContent = {
    blocks,
    intake: textItem(fd.get("intake")) || undefined,
    brochure_label: textItem(fd.get("brochure_label")) || undefined,
    entry_requirements: parseStringArray(str(fd, "entry_requirements")),
    highlights: cleanList<{ label: string; value: string; icon?: string }>(parseJson(str(fd, "highlights"), []), ["icon", "label", "value"]).filter((h) => h.label || h.value),
    audiences: cleanList<{ title: string; description: string; icon?: string }>(parseJson(str(fd, "audiences"), []), ["icon", "title", "description"]).filter((a) => a.title),
    compare: Object.keys(compare).length ? compare : undefined,
    faq_group_slug: textItem(fd.get("faq_group_slug")) || undefined,
  };
  for (const k of Object.keys(content) as (keyof ProgramContent)[]) if (content[k] === undefined) delete content[k];
  return content;
}

export async function saveProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, code: str(fd, "code"), slug: slugify(str(fd, "slug")) || slugify(str(fd, "name")), name: str(fd, "name"),
    qualification: str(fd, "qualification"), tagline: str(fd, "tagline"), summary: str(fd, "summary"), level_label: str(fd, "level_label"), duration: str(fd, "duration"),
    training: str(fd, "training"), mode: str(fd, "mode"), logo_url: str(fd, "logo_url"), hero_image: str(fd, "hero_image"), brochure_url: str(fd, "brochure_url"),
    fee_from: num(fd, "fee_from"), accent: (str(fd, "accent") || "#046BD2").toUpperCase(), sort_order: num(fd, "sort_order") ?? 0, is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const content = buildContent(fd);
  if (!content) return { ok: false, message: "The content blocks could not be read. Please reload and try again." };
  const seo = cleanSeo(parseJson<unknown>(str(fd, "seo"), {}));

  const dupe = d.id
    ? await sql<{ code: string; slug: string }[]>`select code, slug from public.programs where (code = ${d.code} or slug = ${d.slug}) and id <> ${d.id}`
    : await sql<{ code: string; slug: string }[]>`select code, slug from public.programs where code = ${d.code} or slug = ${d.slug}`;
  const pageClash = await sql`select 1 from public.pages where slug = ${d.slug} limit 1`;
  const errors: Record<string, string> = {};
  if (dupe.some((r) => r.code === d.code)) errors.code = "Another programme already uses this code.";
  if (dupe.some((r) => r.slug === d.slug) || pageClash.length) errors.slug = "Another programme or page already uses this slug.";
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors };

  const values = {
    code: d.code, slug: d.slug, name: d.name, qualification: d.qualification, tagline: d.tagline, summary: d.summary, level_label: d.level_label, duration: d.duration,
    training: d.training, mode: d.mode, logo_url: optional(d.logo_url), hero_image: optional(d.hero_image), brochure_url: optional(d.brochure_url), fee_from: d.fee_from,
    accent: d.accent, sort_order: d.sort_order, is_active: d.is_active, content: sql.json(content as never), seo: sql.json(seo as never),
  };
  if (d.id) {
    const [prev] = await sql<{ slug: string; name: string }[]>`select slug, name from public.programs where id = ${d.id}`;
    if (!prev) return { ok: false, message: "Programme not found." };
    await sql`update public.programs set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "program", d.id, { code: d.code });
    bust(TAGS.programs, TAGS.page(d.slug));
    if (prev.slug !== d.slug || prev.name !== d.name) bust(TAGS.nav, TAGS.page(prev.slug));
    return { ok: true, message: "Programme saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.programs ${sql(values)} returning id`;
  await audit(user, "create", "program", row.id, { code: d.code });
  bust(TAGS.programs, TAGS.nav);
  redirect(`/admin/programs/${row.id}`);
}

export async function deleteProgram(id: string): Promise<ActionState> {
  const user = await assertRole("admin");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ code: string; slug: string }[]>`delete from public.programs where id = ${id} returning code, slug`;
  if (!row) return { ok: false, message: "Programme not found." };
  await audit(user, "delete", "program", id, { code: row.code });
  bust(TAGS.programs, TAGS.nav, TAGS.page(row.slug));
  return { ok: true, message: "Programme deleted." };
}

export async function duplicateProgram(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [src] = await sql<{ code: string; slug: string; name: string }[]>`select code, slug, name from public.programs where id = ${id}`;
  if (!src) return { ok: false, message: "Programme not found." };
  let n = 2; let code = `${src.code}-2`; let slug = `${src.slug}-copy`;
  while ((await sql`select 1 from public.programs where code = ${code} or slug = ${slug} limit 1`).length) { n++; code = `${src.code}-${n}`; slug = `${src.slug}-copy-${n}`; }
  const [row] = await sql<{ id: string }[]>`insert into public.programs (code, slug, name, qualification, tagline, summary, level_label, duration, training, mode, logo_url, hero_image, brochure_url, fee_from, accent, content, seo, sort_order, is_active)
    select ${code}, ${slug}, ${src.name + " (copy)"}, qualification, tagline, summary, level_label, duration, training, mode, logo_url, hero_image, brochure_url, fee_from, accent, content, seo, sort_order + 1, false from public.programs where id = ${id} returning id`;
  await audit(user, "create", "program", row.id, { duplicated_from: id });
  bust(TAGS.programs);
  return { ok: true, message: "Programme duplicated (inactive).", id: row.id };
}
