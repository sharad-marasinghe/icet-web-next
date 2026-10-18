"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ActionState } from "@/components/admin/ui";
import { fail, ok, str, uniqueSlug, zodErrors, intOrNull } from "../registry/_shared";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  slug: z.string().trim().max(120),
  intro_html: z.string().max(20000),
  google_review_url: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), "Must be an absolute http(s) URL"),
  redirect_min_rating: z.coerce.number().int().refine((n) => [0, 2, 3, 4, 5].includes(n), "Invalid rating threshold"),
  thankyou_message: z.string().trim().max(1000),
  submit_label: z.string().trim().max(60),
  is_active: z.boolean(),
});

export async function saveFeedbackForm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const id = intOrNull(str(fd, "id"));
  const parsed = formSchema.safeParse({
    name: str(fd, "name"), slug: str(fd, "slug"), intro_html: String(fd.get("intro_html") ?? ""), google_review_url: str(fd, "google_review_url"),
    redirect_min_rating: str(fd, "redirect_min_rating") || 0, thankyou_message: str(fd, "thankyou_message"), submit_label: str(fd, "submit_label"),
    is_active: fd.get("is_active") === "on" || fd.get("is_active") === "true",
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  const slug = await uniqueSlug("feedback_forms", d.slug || d.name, id);
  const intro = sanitizeHtml(d.intro_html);
  const thanks = d.thankyou_message || "Thank you for your feedback!";
  const label = d.submit_label || "Submit Feedback";
  if (id) {
    const rows = await sql`update public.feedback_forms set name = ${d.name}, slug = ${slug}, intro_html = ${intro}, google_review_url = ${d.google_review_url}, redirect_min_rating = ${d.redirect_min_rating}, thankyou_message = ${thanks}, submit_label = ${label}, is_active = ${d.is_active} where id = ${id} returning id`;
    if (!rows.length) return fail("Form not found.");
    await audit(user, "update", "feedback_form", id, { name: d.name });
    bust(TAGS.feedback);
    return ok("Form settings saved.", id);
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.feedback_forms`;
  const ins = await sql<{ id: number }[]>`insert into public.feedback_forms (name, slug, intro_html, google_review_url, redirect_min_rating, thankyou_message, submit_label, is_active, is_default)
    values (${d.name}, ${slug}, ${intro}, ${d.google_review_url}, ${d.redirect_min_rating}, ${thanks}, ${label}, ${d.is_active}, ${n === 0}) returning id`;
  await audit(user, "create", "feedback_form", ins[0].id, { name: d.name });
  bust(TAGS.feedback);
  redirect(`/admin/feedback/${ins[0].id}?tab=questions&created=1`);
}

export async function deleteFeedbackForm(id: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql<{ name: string; is_default: boolean }[]>`delete from public.feedback_forms where id = ${id} returning name, is_default`;
  if (!rows.length) return fail("Form not found.");
  if (rows[0].is_default) await sql`update public.feedback_forms set is_default = true where id = (select id from public.feedback_forms order by id limit 1)`;
  await audit(user, "delete", "feedback_form", id, { name: rows[0].name });
  bust(TAGS.feedback);
  return ok("Form deleted along with its questions and responses.");
}

export async function duplicateFeedbackForm(id: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const src = (await sql<{ name: string; slug: string }[]>`select name, slug from public.feedback_forms where id = ${id}`)[0];
  if (!src) return fail("Form not found.");
  const slug = await uniqueSlug("feedback_forms", `${src.slug}-copy`);
  const ins = await sql<{ id: number }[]>`insert into public.feedback_forms (name, slug, intro_html, google_review_url, redirect_min_rating, thankyou_message, submit_label, is_active, is_default)
    select ${src.name + " (copy)"}, ${slug}, intro_html, google_review_url, redirect_min_rating, thankyou_message, submit_label, is_active, false from public.feedback_forms where id = ${id} returning id`;
  await sql`insert into public.feedback_questions (form_id, question, field_type, is_required, sort_order) select ${ins[0].id}, question, field_type, is_required, sort_order from public.feedback_questions where form_id = ${id}`;
  await audit(user, "duplicate", "feedback_form", ins[0].id, { from: id });
  bust(TAGS.feedback);
  return ok(`Form duplicated as "${src.name} (copy)".`, ins[0].id);
}

export async function makeDefaultFeedbackForm(id: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const rows = await sql`select id from public.feedback_forms where id = ${id}`;
  if (!rows.length) return fail("Form not found.");
  await sql`update public.feedback_forms set is_default = (id = ${id})`;
  await audit(user, "make_default", "feedback_form", id);
  bust(TAGS.feedback);
  return ok("Default form updated.");
}

const questionSchema = z.object({
  form_id: z.number().int().positive(),
  question: z.string().trim().min(1, "Question text is required").max(2000),
  field_type: z.enum(["text", "textarea", "rating", "yes_no", "info"]),
  is_required: z.boolean(),
});

export async function saveQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const id = intOrNull(str(fd, "id"));
  const parsed = questionSchema.safeParse({ form_id: intOrNull(str(fd, "form_id")), question: String(fd.get("question") ?? "").replace(/<[^>]*>/g, "").trim(), field_type: str(fd, "field_type") || "text", is_required: fd.get("is_required") === "on" || fd.get("is_required") === "true" });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  const required = d.field_type === "info" ? false : d.is_required;
  if (id) {
    const rows = await sql`update public.feedback_questions set question = ${d.question}, field_type = ${d.field_type}, is_required = ${required} where id = ${id} and form_id = ${d.form_id} returning id`;
    if (!rows.length) return fail("Question not found.");
    await audit(user, "update", "feedback_question", id);
  } else {
    const [{ next }] = await sql<{ next: number }[]>`select coalesce(max(sort_order), 0) + 1 as next from public.feedback_questions where form_id = ${d.form_id}`;
    const ins = await sql<{ id: number }[]>`insert into public.feedback_questions (form_id, question, field_type, is_required, sort_order) values (${d.form_id}, ${d.question}, ${d.field_type}, ${required}, ${next}) returning id`;
    await audit(user, "create", "feedback_question", ins[0].id, { form_id: d.form_id });
  }
  bust(TAGS.feedback);
  return ok(id ? "Question updated." : "Question added.");
}

export async function deleteQuestion(id: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const rows = await sql`delete from public.feedback_questions where id = ${id} returning id`;
  if (!rows.length) return fail("Question not found.");
  await audit(user, "delete", "feedback_question", id);
  bust(TAGS.feedback);
  return ok("Question deleted.");
}

export async function reorderQuestions(formId: number, ids: number[]): Promise<ActionState> {
  const user = await assertRole("editor");
  const clean = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  for (let i = 0; i < clean.length; i++) await sql`update public.feedback_questions set sort_order = ${i + 1} where id = ${clean[i]} and form_id = ${formId}`;
  await audit(user, "reorder", "feedback_question", formId, { count: clean.length });
  bust(TAGS.feedback);
  return ok("Order saved.");
}

export async function deleteResponses(ids: number[]): Promise<ActionState> {
  const user = await assertRole("editor");
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
  if (!clean.length) return fail("Nothing selected.");
  const rows = await sql`delete from public.feedback_responses where id = any(${clean}::bigint[]) returning id`;
  await audit(user, "delete", "feedback_response", null, { count: rows.length });
  return ok(`${rows.length} response${rows.length === 1 ? "" : "s"} deleted.`);
}

export async function deleteAllResponses(formId: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql`delete from public.feedback_responses where form_id = ${formId} returning id`;
  await audit(user, "delete_all", "feedback_response", formId, { count: rows.length });
  return ok(`All ${rows.length} responses deleted.`);
}
