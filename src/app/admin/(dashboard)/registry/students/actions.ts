"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { randomCode } from "@/lib/utils";
import { rateLimit } from "@/lib/security";
import { issueCertificate } from "@/lib/registry/service";
import { sanitizeKey } from "@/lib/registry/fields";
import type { ActionState } from "@/components/admin/ui";
import { fail, ok, str, zodErrors, intOrNull } from "../_shared";

export async function toggleAttendance(studentPk: number, workshopId: number, attended: boolean): Promise<ActionState> {
  const user = await assertRole("editor");
  const enr = await sql`select 1 from public.reg_enrollments where student_id = ${studentPk} and workshop_id = ${workshopId}`;
  if (!enr.length) return fail("Student is not enrolled in this workshop.");
  await sql`insert into public.reg_attendance (student_id, workshop_id, is_attended, marked_at, marked_by) values (${studentPk}, ${workshopId}, ${attended}, now(), ${user.id})
    on conflict (student_id, workshop_id) do update set is_attended = excluded.is_attended, marked_at = now(), marked_by = excluded.marked_by`;
  await audit(user, "attendance", "student", studentPk, { workshopId, attended });
  return ok(attended ? "Marked as attended." : "Marked as not attended.");
}

const studentSchema = z.object({
  student_id: z.string().trim().max(64).regex(/^[A-Za-z0-9/_-]*$/, "Letters, digits, / _ - only"),
  student_name: z.string().trim().min(1, "Name is required").max(200),
  student_email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  student_phone: z.string().trim().max(40),
  batch_id: z.number().int().nullable(),
  workshop_ids: z.array(z.number().int().positive()).max(100),
});

function parseExtra(raw: FormDataEntryValue | null): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(String(raw));
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = sanitizeKey(k);
      if (!key) continue;
      out[key] = String(v ?? "").replace(/<[^>]*>/g, "").slice(0, 2000);
    }
    return out;
  } catch { return {}; }
}

function parseIds(raw: FormData, k: string): number[] {
  return [...new Set(raw.getAll(k).map((v) => parseInt(String(v), 10)).filter((n) => Number.isFinite(n) && n > 0))];
}

export async function addStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const parsed = studentSchema.safeParse({ student_id: str(fd, "student_id"), student_name: str(fd, "student_name"), student_email: str(fd, "student_email"), student_phone: str(fd, "student_phone"), batch_id: intOrNull(str(fd, "batch_id")), workshop_ids: parseIds(fd, "workshop_ids") });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  if ((await sql`select 1 from public.reg_students where lower(student_email) = ${d.student_email}`).length) return fail("A student with this email already exists.", { student_email: "Already registered" });
  let sid = d.student_id;
  if (sid) {
    if ((await sql`select 1 from public.reg_students where student_id = ${sid}`).length) return fail("That Student ID is already in use.", { student_id: "Already in use" });
  } else {
    do { sid = `ICET-REG-${randomCode(4)}`; } while ((await sql`select 1 from public.reg_students where student_id = ${sid}`).length);
  }
  const extra = parseExtra(fd.get("extra_fields"));
  const ins = await sql<{ id: number }[]>`insert into public.reg_students (student_id, batch_id, student_name, student_email, student_phone, extra_fields)
    values (${sid}, ${d.batch_id}, ${d.student_name}, ${d.student_email}, ${d.student_phone || null}, ${sql.json(extra as never)}) returning id`;
  for (const w of d.workshop_ids) await sql`insert into public.reg_enrollments (student_id, workshop_id, registration_source, registration_medium) values (${ins[0].id}, ${w}, 'admin', 'manual') on conflict do nothing`;
  await audit(user, "create", "student", ins[0].id, { student_id: sid });
  bust(TAGS.workshops);
  return ok(`Student ${sid} added.`, ins[0].id);
}

export async function editStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const pk = intOrNull(str(fd, "id"));
  if (!pk) return fail("Missing student.");
  const parsed = studentSchema.safeParse({ student_id: str(fd, "student_id"), student_name: str(fd, "student_name"), student_email: str(fd, "student_email"), student_phone: str(fd, "student_phone"), batch_id: intOrNull(str(fd, "batch_id")), workshop_ids: parseIds(fd, "workshop_ids") });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  if (!d.student_id) return fail("Student ID is required.", { student_id: "Required" });
  if ((await sql`select 1 from public.reg_students where student_id = ${d.student_id} and id <> ${pk}`).length) return fail("That Student ID belongs to another student.", { student_id: "Already in use" });
  if ((await sql`select 1 from public.reg_students where lower(student_email) = ${d.student_email} and id <> ${pk}`).length) return fail("That email belongs to another student.", { student_email: "Already in use" });
  const extra = parseExtra(fd.get("extra_fields"));
  const rows = await sql`update public.reg_students set student_id = ${d.student_id}, student_name = ${d.student_name}, student_email = ${d.student_email}, student_phone = ${d.student_phone || null}, batch_id = ${d.batch_id}, extra_fields = ${sql.json(extra as never)} where id = ${pk} returning id`;
  if (!rows.length) return fail("Student not found.");
  // Sync enrolments: add missing, remove deselected (certificates already issued are kept in reg_certificates).
  const current = (await sql<{ workshop_id: number }[]>`select workshop_id from public.reg_enrollments where student_id = ${pk}`).map((r) => r.workshop_id);
  const toAdd = d.workshop_ids.filter((w) => !current.includes(w));
  const toRemove = current.filter((w) => !d.workshop_ids.includes(w));
  for (const w of toAdd) await sql`insert into public.reg_enrollments (student_id, workshop_id, registration_source, registration_medium) values (${pk}, ${w}, 'admin', 'manual') on conflict do nothing`;
  if (toRemove.length) {
    await sql`delete from public.reg_enrollments where student_id = ${pk} and workshop_id = any(${toRemove}::bigint[])`;
    await sql`delete from public.reg_attendance where student_id = ${pk} and workshop_id = any(${toRemove}::bigint[])`;
  }
  await audit(user, "update", "student", pk, { added: toAdd, removed: toRemove });
  bust(TAGS.workshops);
  return ok("Student updated.", pk);
}

export async function issueSingleCertificate(studentPk: number, workshopId: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const r = await issueCertificate(studentPk, workshopId, { requireAttendance: true, sendEmail: true });
  if (!r.ok) return fail(r.error);
  await audit(user, "issue_certificate", "student", studentPk, { workshopId, code: r.code, emailed: r.emailed });
  return ok(r.emailed ? `Certificate ${r.code} issued and emailed.` : `Certificate ${r.code} issued, but the email could not be sent${r.error ? `: ${r.error}` : "."}`);
}

export async function resendCertificateEmail(studentPk: number, workshopId: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const enr = (await sql<{ certificate_code: string | null }[]>`select certificate_code from public.reg_enrollments where student_id = ${studentPk} and workshop_id = ${workshopId}`)[0];
  if (!enr) return fail("Enrolment not found.");
  if (!enr.certificate_code) return fail("No certificate has been issued yet. Use Issue certificate first.");
  if (!(await rateLimit(`cert-resend:${studentPk}:${workshopId}`, 1, 60))) return fail("Please wait 60 seconds before re-sending to this student.");
  const r = await issueCertificate(studentPk, workshopId, { requireAttendance: false, sendEmail: true });
  if (!r.ok) return fail(r.error);
  await audit(user, "resend_certificate", "student", studentPk, { workshopId, code: r.code });
  return r.emailed ? ok(`Certificate email re-sent (${r.code}).`) : fail(`Email could not be sent${r.error ? `: ${r.error}` : "."}`);
}

export async function unassignWorkshop(studentPk: number, workshopId: number): Promise<ActionState> {
  const user = await assertRole("editor");
  const rows = await sql`delete from public.reg_enrollments where student_id = ${studentPk} and workshop_id = ${workshopId} returning id`;
  if (!rows.length) return fail("Enrolment not found.");
  await sql`delete from public.reg_attendance where student_id = ${studentPk} and workshop_id = ${workshopId}`;
  await audit(user, "unassign", "student", studentPk, { workshopId });
  bust(TAGS.workshops);
  return ok("Workshop unassigned.");
}

export async function deleteStudent(studentPk: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql<{ student_id: string }[]>`delete from public.reg_students where id = ${studentPk} returning student_id`;
  if (!rows.length) return fail("Student not found.");
  await audit(user, "delete", "student", studentPk, { student_id: rows[0].student_id });
  bust(TAGS.workshops);
  return ok(`Student ${rows[0].student_id} deleted.`);
}

export type StudentDetails = {
  student: { id: number; student_id: string; student_name: string; student_email: string; student_phone: string | null; batch_name: string | null; registered_at: string; extra_fields: Record<string, string> };
  enrollments: { workshop_id: number; title: string; certificate_code: string | null; email_sent_status: boolean; registration_source: string; registration_campaign: string | null; is_attended: boolean; enrolled_at: string }[];
  certificates: { certificate_id: string; course_name: string; issue_date: string; status: string; is_suspended: boolean; pdf_url: string | null }[];
  applications: { id: number; reference_no: string; status: string; batch_name: string; submitted_at: string }[];
};

export async function getStudentDetails(studentPk: number): Promise<StudentDetails | null> {
  await assertRole("viewer");
  const student = (await sql<StudentDetails["student"][]>`select s.id, s.student_id, s.student_name, s.student_email, s.student_phone, b.batch_name, s.registered_at::text, s.extra_fields from public.reg_students s left join public.reg_batches b on b.id = s.batch_id where s.id = ${studentPk}`)[0];
  if (!student) return null;
  const [enrollments, certificates, applications] = await Promise.all([
    sql<StudentDetails["enrollments"]>`select e.workshop_id, w.title, e.certificate_code, e.email_sent_status, coalesce(nullif(e.registration_source, ''), 'direct') as registration_source, e.registration_campaign, coalesce(a.is_attended, false) as is_attended, e.enrolled_at::text
      from public.reg_enrollments e join public.reg_workshops w on w.id = e.workshop_id left join public.reg_attendance a on a.student_id = e.student_id and a.workshop_id = e.workshop_id where e.student_id = ${studentPk} order by e.enrolled_at desc`,
    sql<StudentDetails["certificates"]>`select certificate_id, course_name, issue_date::text, status::text, is_suspended, pdf_url from public.reg_certificates where student_id = ${studentPk} order by issue_date desc`,
    sql<StudentDetails["applications"]>`select a.id, a.reference_no, a.status::text, b.batch_name, a.submitted_at::text from public.reg_applications a join public.reg_batches b on b.id = a.batch_id where a.student_id = ${studentPk} order by a.submitted_at desc`,
  ]);
  return { student: { ...student }, enrollments: enrollments.map((e) => ({ ...e })), certificates: certificates.map((c) => ({ ...c })), applications: applications.map((a) => ({ ...a })) };
}
