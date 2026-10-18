"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import type { ActionState } from "@/components/admin/ui";
import { str, bool, num, optional, zodErrors } from "@/components/admin/content/form-utils";

const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(160),
  role: z.string().trim().max(200),
  company: z.string().trim().max(200),
  quote: z.string().trim().min(1, "Quote is required").max(3000),
  photo_url: z.string().trim().max(1000),
  video_url: z.union([z.literal(""), z.url("Enter a full URL")]),
  program_code: z.string().trim().max(20),
  rating: z.number().int().min(1).max(5).nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export async function saveTestimonial(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, name: str(fd, "name"), role: str(fd, "role"), company: str(fd, "company"), quote: str(fd, "quote"), photo_url: str(fd, "photo_url"),
    video_url: str(fd, "video_url").trim(), program_code: str(fd, "program_code"), rating: num(fd, "rating"), is_active: bool(fd, "is_active"), sort_order: num(fd, "sort_order") ?? 0,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const values = { name: d.name, role: d.role, company: d.company, quote: d.quote, photo_url: optional(d.photo_url), video_url: optional(d.video_url), program_code: optional(d.program_code), rating: d.rating, is_active: d.is_active, sort_order: d.sort_order };
  if (d.id) {
    await sql`update public.testimonials set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "testimonial", d.id, { name: d.name });
    bust(TAGS.testimonials);
    return { ok: true, message: "Testimonial saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.testimonials ${sql(values)} returning id`;
  await audit(user, "create", "testimonial", row.id, { name: d.name });
  bust(TAGS.testimonials);
  redirect(`/admin/testimonials/${row.id}`);
}

export async function deleteTestimonial(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ name: string }[]>`delete from public.testimonials where id = ${id} returning name`;
  if (!row) return { ok: false, message: "Testimonial not found." };
  await audit(user, "delete", "testimonial", id, { name: row.name });
  bust(TAGS.testimonials);
  return { ok: true, message: "Testimonial deleted." };
}
