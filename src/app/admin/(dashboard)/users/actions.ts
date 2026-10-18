"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit, type AdminRole } from "@/lib/auth";
import type { ActionState } from "@/components/admin/ui";

const ROLES = ["super_admin", "admin", "editor", "viewer"] as const;
const RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, admin: 2, super_admin: 3 };
const password = z.string().min(10, "Use at least 10 characters").max(72).refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include letters and numbers");
const uuid = z.string().uuid();

function fieldErrors(issues: z.ZodError["issues"]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.join(".")] = i.message;
  return errors;
}

type Target = { id: string; email: string; role: AdminRole; is_active: boolean };
async function getTarget(id: string): Promise<Target | null> {
  const rows = await sql<Target[]>`select id, email, role, is_active from public.profiles where id = ${id}`;
  return rows[0] ?? null;
}
async function activeSuperAdmins(excludeId?: string) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.profiles where role = 'super_admin' and is_active ${excludeId ? sql`and id <> ${excludeId}` : sql``}`;
  return n;
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  full_name: z.string().trim().min(2, "Enter the person's name").max(120),
  role: z.enum(ROLES),
  password,
});

export async function createUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("super_admin");
  const parsed = createSchema.safeParse({ email: fd.get("email"), full_name: fd.get("full_name"), role: fd.get("role"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, message: "Please check the form.", errors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const exists = await sql`select 1 from public.profiles where lower(email) = ${d.email}`;
  if (exists.length) return { ok: false, message: "A user with that email already exists.", errors: { email: "Already registered" } };
  try {
    const [row] = await sql<{ id: string }[]>`select public.admin_create_user(${d.email}, ${d.password}, ${d.full_name}, ${d.role}::public.admin_role) as id`;
    await audit(user, "create", "user", row.id, { email: d.email, role: d.role });
    return { ok: true, message: `${d.full_name} can now sign in as ${d.role.replace("_", " ")}.`, id: row.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? `Could not create the user: ${e.message}` : "Could not create the user." };
  }
}

const updateSchema = z.object({ id: uuid, full_name: z.string().trim().min(2, "Enter the person's name").max(120), role: z.enum(ROLES), is_active: z.boolean() });

export async function updateUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const parsed = updateSchema.safeParse({ id: fd.get("id"), full_name: fd.get("full_name"), role: fd.get("role"), is_active: fd.get("is_active") !== "off" });
  if (!parsed.success) return { ok: false, message: "Please check the form.", errors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const target = await getTarget(d.id);
  if (!target) return { ok: false, message: "User not found." };
  const self = target.id === user.id;
  if (!self && RANK[target.role] > RANK[user.role]) return { ok: false, message: "You cannot edit a user with a higher role than yours." };
  if (d.role !== target.role) {
    if (user.role !== "super_admin") return { ok: false, message: "Only a super admin can change roles.", errors: { role: "Not permitted" } };
    if (self && RANK[d.role] < RANK[user.role]) return { ok: false, message: "You cannot demote your own account.", errors: { role: "Ask another super admin" } };
  }
  if (!d.is_active && self) return { ok: false, message: "You cannot deactivate your own account." };
  const losingSuper = target.role === "super_admin" && target.is_active && (d.role !== "super_admin" || !d.is_active);
  if (losingSuper && (await activeSuperAdmins(target.id)) === 0) return { ok: false, message: "There must always be at least one active super admin." };
  await sql`update public.profiles set full_name = ${d.full_name}, role = ${d.role}::public.admin_role, is_active = ${d.is_active} where id = ${d.id}`;
  await audit(user, "update", "user", d.id, { email: target.email, role: d.role, is_active: d.is_active, previous_role: target.role });
  return { ok: true, message: "User updated." };
}

export async function setUserPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const parsed = z.object({ id: uuid, password }).safeParse({ id: fd.get("id"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, message: "Please check the password.", errors: fieldErrors(parsed.error.issues) };
  const target = await getTarget(parsed.data.id);
  if (!target) return { ok: false, message: "User not found." };
  if (target.id !== user.id && RANK[target.role] > RANK[user.role]) return { ok: false, message: "You cannot change the password of a user with a higher role." };
  await sql`select public.admin_set_password(${target.id}::uuid, ${parsed.data.password})`;
  await audit(user, "set_password", "user", target.id, { email: target.email });
  return { ok: true, message: `Password updated for ${target.email}.` };
}

export async function deleteUser(id: string): Promise<ActionState> {
  const user = await assertRole("super_admin");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid user." };
  if (id === user.id) return { ok: false, message: "You cannot delete your own account." };
  const target = await getTarget(id);
  if (!target) return { ok: false, message: "User not found." };
  if (target.role === "super_admin" && target.is_active && (await activeSuperAdmins(id)) === 0) return { ok: false, message: "There must always be at least one active super admin." };
  await sql`select public.admin_delete_user(${id}::uuid)`;
  await sql`delete from public.profiles where id = ${id}`; // in case the auth cascade did not run
  await audit(user, "delete", "user", id, { email: target.email, role: target.role });
  return { ok: true, message: `${target.email} has been removed.` };
}
