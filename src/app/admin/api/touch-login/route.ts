import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST() {
  const u = await getCurrentUser();
  if (u) await sql`update public.profiles set last_login_at = now() where id = ${u.id}`;
  return NextResponse.json({ ok: !!u });
}
