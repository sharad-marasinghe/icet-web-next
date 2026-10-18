import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";

export type AdminRole = "super_admin" | "admin" | "editor" | "viewer";
export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  avatar_url: string | null;
  is_active: boolean;
};

const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, admin: 2, super_admin: 3 };

/** Current signed-in profile, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return null;
  const rows = await sql<AdminUser[]>`
    select id, email, full_name, role, avatar_url, is_active from public.profiles where id = ${uid} limit 1`;
  const u = rows[0];
  if (!u || !u.is_active) return null;
  return { ...u };
});

export function hasRole(user: AdminUser | null, min: AdminRole): user is AdminUser {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[min];
}

/** For pages: redirect to login if not signed in / too low a role. */
export async function requireUser(min: AdminRole = "viewer"): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!hasRole(user, min)) redirect("/admin/forbidden");
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertRole(min: AdminRole = "editor"): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: please sign in.");
  if (!hasRole(user, min)) throw new Error("Forbidden: insufficient permissions.");
  return user;
}

export async function audit(user: AdminUser | null, action: string, entity: string, entityId?: string | number | null, meta: Record<string, unknown> = {}) {
  try {
    await sql`insert into public.audit_log (user_id, user_email, action, entity, entity_id, meta)
      values (${user?.id ?? null}, ${user?.email ?? null}, ${action}, ${entity}, ${entityId == null ? null : String(entityId)}, ${sql.json(meta as never)})`;
  } catch {
    // auditing must never break the primary operation
  }
}
