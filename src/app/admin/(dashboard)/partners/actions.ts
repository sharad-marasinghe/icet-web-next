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
  logo_url: z.string().trim().min(1, "A logo is required").max(1000),
  website_url: z.union([z.literal(""), z.url("Enter a full URL starting with https://")]),
  category: z.string().trim().min(1, "Category is required").max(60).regex(/^[a-z0-9_-]+$/, "Lower-case letters, numbers, hyphen or underscore"),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export async function savePartner(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = schema.safeParse({
    id: str(fd, "id") || undefined, name: str(fd, "name"), logo_url: str(fd, "logo_url"), website_url: str(fd, "website_url").trim(),
    category: str(fd, "category").trim().toLowerCase().replace(/\s+/g, "_") || "industry", is_active: bool(fd, "is_active"), sort_order: num(fd, "sort_order") ?? 0,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const values = { name: d.name, logo_url: d.logo_url, website_url: optional(d.website_url), category: d.category, is_active: d.is_active, sort_order: d.sort_order };
  if (d.id) {
    await sql`update public.partners set ${sql(values)} where id = ${d.id}`;
    await audit(user, "update", "partner", d.id, { name: d.name });
    bust(TAGS.partners);
    return { ok: true, message: "Partner saved.", id: d.id };
  }
  const [row] = await sql<{ id: string }[]>`insert into public.partners ${sql(values)} returning id`;
  await audit(user, "create", "partner", row.id, { name: d.name });
  bust(TAGS.partners);
  redirect(`/admin/partners/${row.id}`);
}

export async function deletePartner(id: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Invalid id." };
  const [row] = await sql<{ name: string }[]>`delete from public.partners where id = ${id} returning name`;
  if (!row) return { ok: false, message: "Partner not found." };
  await audit(user, "delete", "partner", id, { name: row.name });
  bust(TAGS.partners);
  return { ok: true, message: "Partner deleted." };
}
