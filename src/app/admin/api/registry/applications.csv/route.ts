import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { toCsv } from "@/lib/utils";
import { sanitizeInline } from "@/lib/sanitize";
import { isLayout, normalizeIdentityFields, sanitizeForm, type FormFields } from "@/lib/registry/fields";
import { readApplicationFilters, applicationWhere } from "@/app/admin/(dashboard)/registry/applications/query";

/** Applications export for one intake: fixed columns + one column per enabled form field. */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await assertRole("editor");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const f = readApplicationFilters(req.nextUrl.searchParams);
  if (!f.batch) return NextResponse.json({ error: "batch_id is required" }, { status: 400 });
  const batch = (await sql<{ batch_name: string; course_code: string; form_fields: FormFields }[]>`select batch_name, course_code, form_fields from public.reg_batches where id = ${f.batch}`)[0];
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  const form = normalizeIdentityFields(sanitizeForm(batch.form_fields, sanitizeInline));
  const fields = Object.entries(form).filter(([k, c]) => c.enabled && !isLayout(c.type) && !["student_name", "student_email", "student_id", "student_phone"].includes(k));
  const rows = await sql<{ reference_no: string; status: string; student_id: string; student_name: string; student_email: string; student_phone: string | null; submitted_at: string; answers_json: Record<string, string | string[]> }[]>`
    select a.reference_no, a.status::text, s.student_id, s.student_name, s.student_email, s.student_phone, to_char(a.submitted_at at time zone 'Asia/Colombo', 'YYYY-MM-DD HH24:MI:SS') as submitted_at, a.answers_json
    from public.reg_applications a join public.reg_students s on s.id = a.student_id ${applicationWhere(f)} order by a.submitted_at desc limit 50000`;
  const csv = toCsv([
    ["Reference", "Status", "Student ID", "Name", "Email", "Phone", "Submitted At", ...fields.map(([, c]) => c.label)],
    ...rows.map((r) => [r.reference_no, r.status, r.student_id, r.student_name, r.student_email, r.student_phone || "", r.submitted_at, ...fields.map(([k]) => { const v = r.answers_json?.[k]; return Array.isArray(v) ? v.join(", ") : v ?? ""; })]),
  ]);
  await audit(user, "export", "applications", f.batch, { rows: rows.length, filters: f });
  const name = (batch.course_code || batch.batch_name || "batch").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="icet-applications-${name}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
