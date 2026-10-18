import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { toCsv } from "@/lib/utils";
import { readStudentFilters, studentWhere } from "@/app/admin/(dashboard)/registry/students/query";

/** Students export honouring the same filters as the directory screen. */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await assertRole("editor");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const f = readStudentFilters(req.nextUrl.searchParams);
  const rows = await sql<{ id: number; student_id: string; student_name: string; student_email: string; student_phone: string | null; batch_name: string | null; registered_at: string; extra_fields: Record<string, string>; attended: string | null }[]>`
    select s.id, s.student_id, s.student_name, s.student_email, s.student_phone, b.batch_name, to_char(s.registered_at at time zone 'Asia/Colombo', 'YYYY-MM-DD HH24:MI:SS') as registered_at, s.extra_fields,
      (select string_agg(w.title, ', ' order by w.title) from public.reg_attendance att join public.reg_workshops w on w.id = att.workshop_id where att.student_id = s.id and att.is_attended) as attended
    from public.reg_students s left join public.reg_batches b on b.id = s.batch_id ${studentWhere(f)} order by s.registered_at desc limit 50000`;
  const csv = toCsv([
    ["Student ID", "Name", "Email", "Phone", "Batch", "Attended Workshops", "Registered At", "Extra Fields"],
    ...rows.map((r) => [r.student_id, r.student_name, r.student_email, r.student_phone || "", r.batch_name || "", r.attended || "—", r.registered_at, JSON.stringify(r.extra_fields || {})]),
  ]);
  const suffix = f.attendance === "attended" ? "-attended" : f.attendance === "not_attended" ? "-not-attended" : "";
  await audit(user, "export", "students", null, { rows: rows.length, filters: f });
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="icet-students${suffix}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
