"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { deleteApplication } from "@/lib/registry/service";
import type { ActionState } from "@/components/admin/ui";
import { APPLICATION_STATUSES } from "@/components/admin/registry/shared";
import { fail, ok, str, intOrNull } from "../_shared";

const statusEnum = z.enum(APPLICATION_STATUSES);

export async function setApplicationStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const id = intOrNull(str(fd, "id"));
  const status = statusEnum.safeParse(str(fd, "status"));
  if (!id || !status.success) return fail("Invalid status.");
  const notes = String(fd.get("review_notes") ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 5000);
  const rows = await sql`update public.reg_applications set status = ${status.data}::public.application_status, review_notes = ${notes || null}, reviewed_by = ${user.id}, reviewed_at = now(), updated_at = now() where id = ${id} returning id`;
  if (!rows.length) return fail("Application not found.");
  await audit(user, "set_status", "application", id, { status: status.data });
  return ok("Application updated.");
}

export async function bulkSetApplicationStatus(ids: number[], status: string): Promise<ActionState> {
  const user = await assertRole("editor");
  const st = statusEnum.safeParse(status);
  const clean = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!st.success || !clean.length) return fail("Select at least one application and a status.");
  const rows = await sql`update public.reg_applications set status = ${st.data}::public.application_status, reviewed_by = ${user.id}, reviewed_at = now(), updated_at = now() where id = any(${clean}::bigint[]) returning id`;
  await audit(user, "bulk_status", "application", null, { status: st.data, count: rows.length });
  return ok(`${rows.length} application${rows.length === 1 ? "" : "s"} marked as ${st.data.replace(/_/g, " ")}.`);
}

export async function deleteApplicationAction(id: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const row = (await sql<{ reference_no: string }[]>`select reference_no from public.reg_applications where id = ${id}`)[0];
  if (!row) return fail("Application not found.");
  await deleteApplication(id);
  await audit(user, "delete", "application", id, { reference_no: row.reference_no });
  return ok(`Application ${row.reference_no} deleted.`);
}
