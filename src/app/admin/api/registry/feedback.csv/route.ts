import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { toCsv } from "@/lib/utils";

/** Export every response of one feedback form; one column per (non-info) question. */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await assertRole("editor");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const formId = parseInt(req.nextUrl.searchParams.get("form_id") || "", 10);
  if (!Number.isFinite(formId)) return NextResponse.json({ error: "form_id is required" }, { status: 400 });
  const form = (await sql<{ name: string; slug: string }[]>`select name, slug from public.feedback_forms where id = ${formId}`)[0];
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  const questions = await sql<{ id: number; question: string }[]>`select id, question from public.feedback_questions where form_id = ${formId} and field_type <> 'info' order by sort_order, id`;
  const rows = await sql<{ id: number; created_at: string; rating: number | null; redirected: boolean; answers: Record<string, string> }[]>`
    select id, to_char(created_at at time zone 'Asia/Colombo', 'YYYY-MM-DD HH24:MI:SS') as created_at, rating, redirected, answers from public.feedback_responses where form_id = ${formId} order by created_at desc limit 50000`;
  const csv = toCsv([
    ["ID", "Submitted At", "Rating", "Redirected to Google", ...questions.map((q) => q.question.replace(/<[^>]*>/g, ""))],
    ...rows.map((r) => [r.id, r.created_at, r.rating ?? "", r.redirected ? "Yes" : "No", ...questions.map((q) => r.answers?.[String(q.id)] ?? "")]),
  ]);
  await audit(user, "export", "feedback_responses", formId, { rows: rows.length });
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="feedback-${form.slug}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
