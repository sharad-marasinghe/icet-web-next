"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { sanitizeHtml } from "@/lib/sanitize";
import { sanitizeForm } from "@/lib/registry/fields";
import type { ActionState } from "@/components/admin/ui";
import { fail, ok, parseEmailSettings, parseLocalDateTime, sanitizeHelp, str, uniqueSlug, zodErrors, intOrNull } from "../_shared";

const schema = z.object({
  batch_name: z.string().trim().min(2, "Batch name is required").max(200),
  slug: z.string().trim().max(120),
  course_code: z.string().trim().max(40).regex(/^[A-Za-z0-9 _-]*$/, "Letters, digits, spaces and hyphens only"),
  intro_title: z.string().trim().max(200),
  intro_html: z.string().max(50000),
  is_open: z.boolean(),
  opens_at: z.string().nullable(),
  closes_at: z.string().nullable(),
});

export async function saveBatch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const id = intOrNull(str(fd, "id"));
  const parsed = schema.safeParse({
    batch_name: str(fd, "batch_name"), slug: str(fd, "slug"), course_code: str(fd, "course_code"), intro_title: str(fd, "intro_title"),
    intro_html: String(fd.get("intro_html") ?? ""), is_open: fd.get("is_open") === "on" || fd.get("is_open") === "true",
    opens_at: parseLocalDateTime(str(fd, "opens_at")), closes_at: parseLocalDateTime(str(fd, "closes_at")),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  if (d.opens_at && d.closes_at && d.closes_at < d.opens_at) return fail("Closing date must be after the opening date.", { closes_at: "Must be after the opening date" });
  const slug = await uniqueSlug("reg_batches", d.slug || d.batch_name, id);
  const form = sanitizeForm(String(fd.get("form_fields") ?? "{}"), sanitizeHelp);
  const emails = parseEmailSettings(fd.get("email_settings"), false);
  const intro = sanitizeHtml(d.intro_html);

  if (id) {
    const prev = (await sql<{ form_fields: unknown }[]>`select form_fields from public.reg_batches where id = ${id}`)[0];
    if (!prev) return fail("Batch not found.");
    const formChanged = JSON.stringify(prev.form_fields) !== JSON.stringify(form);
    await sql`update public.reg_batches set batch_name = ${d.batch_name}, slug = ${slug}, course_code = ${d.course_code}, intro_title = ${d.intro_title}, intro_html = ${intro},
        is_open = ${d.is_open}, opens_at = ${d.opens_at}, closes_at = ${d.closes_at}, form_fields = ${JSON.stringify(form)},
        form_version = form_version + ${formChanged ? 1 : 0}, email_settings = ${sql.json(emails as never)}, updated_at = now() where id = ${id}`;
    await audit(user, "update", "batch", id, { batch_name: d.batch_name, formChanged });
    bust(TAGS.batches);
    return ok("Batch saved.", id);
  }
  const ins = await sql<{ id: number }[]>`insert into public.reg_batches (batch_name, slug, course_code, intro_title, intro_html, is_open, opens_at, closes_at, form_fields, email_settings)
    values (${d.batch_name}, ${slug}, ${d.course_code}, ${d.intro_title}, ${intro}, ${d.is_open}, ${d.opens_at}, ${d.closes_at}, ${JSON.stringify(form)}, ${sql.json(emails as never)}) returning id`;
  await audit(user, "create", "batch", ins[0].id, { batch_name: d.batch_name });
  bust(TAGS.batches);
  redirect(`/admin/registry/batches/${ins[0].id}?created=1`);
}

export async function setBatchOpen(id: number, open: boolean): Promise<ActionState> {
  const user = await assertRole("editor");
  const rows = await sql`update public.reg_batches set is_open = ${open}, updated_at = now() where id = ${id} returning id`;
  if (!rows.length) return fail("Batch not found.");
  await audit(user, "status", "batch", id, { is_open: open });
  bust(TAGS.batches);
  return ok(open ? "Applications are now open." : "Applications closed.");
}

export async function deleteBatch(id: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql<{ batch_name: string }[]>`delete from public.reg_batches where id = ${id} returning batch_name`;
  if (!rows.length) return fail("Batch not found.");
  await audit(user, "delete", "batch", id, { batch_name: rows[0].batch_name });
  bust(TAGS.batches);
  return ok("Batch deleted along with its applications.");
}
