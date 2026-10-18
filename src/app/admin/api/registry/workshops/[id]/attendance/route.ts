import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";

/** Enrolled students for a workshop with their attendance flag and certificate code. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await assertRole("viewer");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const workshopId = parseInt(id, 10);
  if (!Number.isFinite(workshopId)) return NextResponse.json({ error: "Invalid workshop id" }, { status: 400 });
  const w = (await sql<{ id: number; title: string; status: string }[]>`select id, title, status::text from public.reg_workshops where id = ${workshopId}`)[0];
  if (!w) return NextResponse.json({ error: "Workshop not found" }, { status: 404 });
  const students = await sql<{ student_id: number; student_code: string; student_name: string; student_email: string; is_attended: boolean; certificate_code: string | null }[]>`
    select s.id as student_id, s.student_id as student_code, s.student_name, s.student_email, coalesce(a.is_attended, false) as is_attended, e.certificate_code
    from public.reg_enrollments e
    join public.reg_students s on s.id = e.student_id
    left join public.reg_attendance a on a.student_id = e.student_id and a.workshop_id = e.workshop_id
    where e.workshop_id = ${workshopId}
    order by s.student_name asc`;
  const list = students.map((s) => ({ ...s }));
  return NextResponse.json({ workshop_id: w.id, workshop_title: w.title, status: w.status, total_students: list.length, attended_count: list.filter((s) => s.is_attended).length, students: list });
}
