"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { createAnonClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/admin/ui";

function fieldErrors(issues: z.ZodError["issues"]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.join(".")] = i.message;
  return errors;
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  avatar_url: z.string().trim().max(600).refine((v) => !v || /^(https?:\/\/|\/)/i.test(v), "Enter a valid image URL"),
});

export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("viewer");
  const parsed = profileSchema.safeParse({ full_name: fd.get("full_name"), avatar_url: fd.get("avatar_url") ?? "" });
  if (!parsed.success) return { ok: false, message: "Please check the form.", errors: fieldErrors(parsed.error.issues) };
  await sql`update public.profiles set full_name = ${parsed.data.full_name}, avatar_url = ${parsed.data.avatar_url || null} where id = ${user.id}`;
  await audit(user, "update", "profile", user.id, { full_name: parsed.data.full_name });
  return { ok: true, message: "Profile updated." };
}

const passwordSchema = z.object({
  current_password: z.string().min(1, "Enter your current password"),
  new_password: z.string().min(10, "Use at least 10 characters").max(72).refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include letters and numbers"),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, { path: ["confirm_password"], message: "Passwords do not match" })
  .refine((d) => d.new_password !== d.current_password, { path: ["new_password"], message: "Choose a different password" });

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("viewer");
  const parsed = passwordSchema.safeParse({ current_password: fd.get("current_password"), new_password: fd.get("new_password"), confirm_password: fd.get("confirm_password") });
  if (!parsed.success) return { ok: false, message: "Please check the form.", errors: fieldErrors(parsed.error.issues) };
  const anon = createAnonClient();
  const { error } = await anon.auth.signInWithPassword({ email: user.email, password: parsed.data.current_password });
  if (error) {
    await audit(user, "password_check_failed", "profile", user.id);
    return { ok: false, message: "Your current password is incorrect.", errors: { current_password: "Incorrect password" } };
  }
  await anon.auth.signOut().catch(() => {});
  await sql`select public.admin_set_password(${user.id}::uuid, ${parsed.data.new_password})`;
  await audit(user, "change_password", "profile", user.id);
  return { ok: true, message: "Password changed. Use it next time you sign in." };
}
