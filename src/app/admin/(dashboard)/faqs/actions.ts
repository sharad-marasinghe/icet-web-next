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
import { str, zodErrors } from "@/components/admin/content/form-utils";

const groupSchema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().min(1, "Slug is required").max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000),
});

export async function saveFaqGroup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = groupSchema.safeParse({ id: str(fd, "id") || undefined, slug: slugify(str(fd, "slug")) || slugify(str(fd, "title")), title: str(fd, "title"), description: str(fd, "description") });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const dupe = d.id ? await sql`select 1 from public.faq_groups where slug = ${d.slug} and id <> ${d.id}` : await sql`select 1 from public.faq_groups where slug = ${d.slug}`;
  if (dupe.length) return { ok: false, message: "Slug already in use.", errors: { slug: "Another FAQ group already uses this slug." } };
  if (d.id) {
    await sql`update public.faq_groups set slug = ${d.slug}, title = ${d.title}, description = ${d.description} where id = ${d.id}`;
    await audit(user, "update", "faq_group", d.id, { slug: d.slug });
    bust(TAGS.faqs, TAGS.pages);
    return { ok: true, message: "FAQ group saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.faq_groups (slug, title, description) values (${d.slug}, ${d.title}, ${d.description}) returning id`;
  await audit(user, "create", "faq_group", row.id, { slug: d.slug });
  bust(TAGS.faqs);
  redirect(`/admin/faqs/${row.id}`);
}

export async function deleteFaqGroup(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ slug: string }[]>`delete from public.faq_groups where id = ${id} returning slug`;
  if (!row) return { ok: false, message: "FAQ group not found." };
  await audit(user, "delete", "faq_group", id, { slug: row.slug });
  bust(TAGS.faqs, TAGS.pages);
  return { ok: true, message: "FAQ group and its questions deleted." };
}

const faqSchema = z.object({
  id: z.uuid().optional(),
  group_id: z.uuid(),
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(20000),
  is_active: z.boolean(),
});

export async function saveFaq(input: { id?: string; group_id: string; question: string; answer: string; is_active: boolean }): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = faqSchema.safeParse({ ...input, id: input.id || undefined });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const answer = sanitizeHtml(d.answer);
  if (d.id) {
    await sql`update public.faqs set question = ${d.question}, answer = ${answer}, is_active = ${d.is_active} where id = ${d.id} and group_id = ${d.group_id}`;
    await audit(user, "update", "faq", d.id);
    bust(TAGS.faqs, TAGS.pages);
    return { ok: true, message: "Question saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.faqs (group_id, question, answer, is_active, sort_order)
    values (${d.group_id}, ${d.question}, ${answer}, ${d.is_active}, (select coalesce(max(sort_order), -1) + 1 from public.faqs where group_id = ${d.group_id})) returning id`;
  await audit(user, "create", "faq", row.id, { group_id: d.group_id });
  bust(TAGS.faqs, TAGS.pages);
  return { ok: true, message: "Question added.", id: row.id };
}

export async function deleteFaq(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  await sql`delete from public.faqs where id = ${id}`;
  await audit(user, "delete", "faq", id);
  bust(TAGS.faqs, TAGS.pages);
  return { ok: true, message: "Question deleted." };
}

export async function toggleFaq(id: string, active: boolean): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  await sql`update public.faqs set is_active = ${active} where id = ${id}`;
  await audit(user, "update", "faq", id, { is_active: active });
  bust(TAGS.faqs, TAGS.pages);
  return { ok: true };
}

export async function reorderFaqs(groupId: string, ids: string[]): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = z.object({ groupId: z.uuid(), ids: z.array(z.uuid()).max(500) }).safeParse({ groupId, ids });
  if (!parsed.success) return { ok: false, message: "Invalid order." };
  await sql.begin(async (tx) => {
    for (let i = 0; i < parsed.data.ids.length; i++) await tx`update public.faqs set sort_order = ${i} where id = ${parsed.data.ids[i]} and group_id = ${parsed.data.groupId}`;
  });
  await audit(user, "reorder", "faq", groupId, { count: ids.length });
  bust(TAGS.faqs, TAGS.pages);
  return { ok: true, message: "Order saved." };
}
