"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import type { ActionState } from "@/components/admin/ui";

const STATUSES = ["new", "contacted", "qualified", "converted", "closed", "spam"] as const;
const uuid = z.string().uuid();
const statusSchema = z.enum(STATUSES);

export async function bulkInquiryStatus(ids: string[], status: string): Promise<ActionState> {
  const user = await assertRole("editor");
  const pIds = z.array(uuid).min(1, "Select at least one inquiry").max(500).safeParse(ids);
  const pStatus = statusSchema.safeParse(status);
  if (!pIds.success) return { ok: false, message: pIds.error.issues[0]?.message || "Invalid selection." };
  if (!pStatus.success) return { ok: false, message: "Choose a valid status." };
  const rows = await sql`update public.inquiries set status = ${pStatus.data}::public.inquiry_status where id in ${sql(pIds.data)} returning id`;
  await audit(user, "bulk_status", "inquiry", null, { status: pStatus.data, count: rows.length, ids: pIds.data.slice(0, 50) });
  return { ok: true, message: `${rows.length} inquir${rows.length === 1 ? "y" : "ies"} marked ${pStatus.data}.` };
}

export async function updateInquiryStatus(id: string, status: string): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid inquiry." };
  const p = statusSchema.safeParse(status);
  if (!p.success) return { ok: false, message: "Choose a valid status." };
  const rows = await sql<{ status: string }[]>`update public.inquiries set status = ${p.data}::public.inquiry_status where id = ${id} returning status`;
  if (!rows.length) return { ok: false, message: "Inquiry not found." };
  await audit(user, "status", "inquiry", id, { status: p.data });
  return { ok: true, message: `Status set to ${p.data}.` };
}

export async function assignInquiry(id: string, assignee: string | null): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid inquiry." };
  if (assignee && !uuid.safeParse(assignee).success) return { ok: false, message: "Invalid user." };
  if (assignee) {
    const ok = await sql`select 1 from public.profiles where id = ${assignee} and is_active`;
    if (!ok.length) return { ok: false, message: "That user is not active." };
  }
  const rows = await sql`update public.inquiries set assigned_to = ${assignee} where id = ${id} returning id`;
  if (!rows.length) return { ok: false, message: "Inquiry not found." };
  await audit(user, "assign", "inquiry", id, { assigned_to: assignee });
  return { ok: true, message: assignee ? "Inquiry assigned." : "Assignment cleared." };
}

export async function addInquiryNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = z.object({ id: uuid, note: z.string().trim().min(1, "Write a note first").max(4000) }).safeParse({ id: fd.get("id"), note: fd.get("note") });
  if (!parsed.success) return { ok: false, message: "Please check the note.", errors: { note: parsed.error.issues[0]?.message || "Invalid" } };
  const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const entry = `[${stamp} · ${user.full_name || user.email}]\n${parsed.data.note}`;
  const rows = await sql`update public.inquiries set notes = case when notes = '' then ${entry} else notes || E'\n\n' || ${entry} end where id = ${parsed.data.id} returning id`;
  if (!rows.length) return { ok: false, message: "Inquiry not found." };
  await audit(user, "note", "inquiry", parsed.data.id, { length: parsed.data.note.length });
  return { ok: true, message: "Note added." };
}

export async function deleteInquiry(id: string): Promise<ActionState> {
  const user = await assertRole("admin");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid inquiry." };
  const rows = await sql<{ name: string; email: string; type: string }[]>`delete from public.inquiries where id = ${id} returning name, email, type`;
  if (!rows.length) return { ok: false, message: "Inquiry not found." };
  await audit(user, "delete", "inquiry", id, { ...rows[0] });
  return { ok: true, message: "Inquiry deleted." };
}
