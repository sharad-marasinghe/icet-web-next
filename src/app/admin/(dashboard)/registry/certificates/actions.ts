"use server";

import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { rateLimit } from "@/lib/security";
import { issueCertificate } from "@/lib/registry/service";
import type { ActionState } from "@/components/admin/ui";
import { fail, ok } from "../_shared";

async function certRow(certificateId: string) {
  return (await sql<{ id: number; certificate_id: string; student_id: number; workshop_id: number | null; is_suspended: boolean }[]>`select id, certificate_id, student_id, workshop_id, is_suspended from public.reg_certificates where certificate_id = ${certificateId}`)[0];
}

/** (Re)generate the PDF for an existing certificate without emailing. */
export async function generateCertificatePdf(certificateId: string): Promise<ActionState> {
  const user = await assertRole("editor");
  const c = await certRow(certificateId);
  if (!c) return fail("Certificate not found.");
  if (!c.workshop_id) return fail("This certificate is not linked to a workshop template.");
  const r = await issueCertificate(c.student_id, c.workshop_id, { requireAttendance: false, sendEmail: false });
  if (!r.ok) return fail(r.error);
  await audit(user, "generate_pdf", "certificate", c.id, { code: c.certificate_id });
  return ok("PDF generated.");
}

export async function resendCertificate(certificateId: string): Promise<ActionState> {
  const user = await assertRole("editor");
  const c = await certRow(certificateId);
  if (!c) return fail("Certificate not found.");
  if (!c.workshop_id) return fail("This certificate is not linked to a workshop.");
  if (c.is_suspended) return fail("Suspended certificates cannot be re-sent. Reactivate it first.");
  if (!(await rateLimit(`cert-resend:${c.student_id}:${c.workshop_id}`, 1, 60))) return fail("Please wait 60 seconds before re-sending this certificate.");
  const r = await issueCertificate(c.student_id, c.workshop_id, { requireAttendance: false, sendEmail: true });
  if (!r.ok) return fail(r.error);
  await audit(user, "resend", "certificate", c.id, { code: c.certificate_id });
  return r.emailed ? ok("Certificate email re-sent.") : fail(`Email could not be sent${r.error ? `: ${r.error}` : "."}`);
}

export async function suspendCertificate(certificateId: string, reason: string): Promise<ActionState> {
  const user = await assertRole("admin");
  const why = String(reason || "").replace(/<[^>]*>/g, "").trim().slice(0, 500);
  if (!why) return fail("A reason is required.");
  const rows = await sql`update public.reg_certificates set is_suspended = true, suspension_reason = ${why} where certificate_id = ${certificateId} returning id`;
  if (!rows.length) return fail("Certificate not found.");
  await audit(user, "suspend", "certificate", certificateId, { reason: why });
  return ok("Certificate suspended. Verification now reports it as suspended.");
}

export async function reactivateCertificate(certificateId: string): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql`update public.reg_certificates set is_suspended = false, suspension_reason = null where certificate_id = ${certificateId} returning id`;
  if (!rows.length) return fail("Certificate not found.");
  await audit(user, "reactivate", "certificate", certificateId);
  return ok("Certificate reactivated.");
}

export type StudentHit = { id: number; student_id: string; student_name: string; student_email: string; workshops: { id: number; title: string; attended: boolean; certificate_code: string | null }[] };

export async function searchStudents(q: string): Promise<StudentHit[]> {
  await assertRole("editor");
  const term = String(q || "").trim().slice(0, 100);
  if (term.length < 2) return [];
  const like = "%" + term.replace(/[%_\\]/g, (m) => "\\" + m) + "%";
  const rows = await sql<StudentHit[]>`select s.id, s.student_id, s.student_name, s.student_email,
      coalesce((select json_agg(json_build_object('id', w.id, 'title', w.title, 'attended', coalesce(a.is_attended, false), 'certificate_code', e.certificate_code) order by w.title)
        from public.reg_enrollments e join public.reg_workshops w on w.id = e.workshop_id left join public.reg_attendance a on a.student_id = e.student_id and a.workshop_id = e.workshop_id where e.student_id = s.id), '[]'::json) as workshops
    from public.reg_students s where s.student_name ilike ${like} or s.student_email ilike ${like} or s.student_id ilike ${like} order by s.student_name limit 12`;
  return rows.map((r) => ({ ...r }));
}

/** Manually issue a certificate: enrols the student if needed, optionally bypassing attendance. */
export async function manualIssue(studentPk: number, workshopId: number, bypassAttendance: boolean, sendEmail: boolean): Promise<ActionState> {
  const user = await assertRole("editor");
  const w = (await sql<{ id: number }[]>`select id from public.reg_workshops where id = ${workshopId}`)[0];
  if (!w) return fail("Workshop not found.");
  const enrolled = await sql`select 1 from public.reg_enrollments where student_id = ${studentPk} and workshop_id = ${workshopId}`;
  if (!enrolled.length) await sql`insert into public.reg_enrollments (student_id, workshop_id, registration_source, registration_medium) values (${studentPk}, ${workshopId}, 'admin', 'manual') on conflict do nothing`;
  if (bypassAttendance) {
    await sql`insert into public.reg_attendance (student_id, workshop_id, is_attended, marked_at, marked_by) values (${studentPk}, ${workshopId}, true, now(), ${user.id}) on conflict (student_id, workshop_id) do update set is_attended = true, marked_at = now(), marked_by = excluded.marked_by`;
  }
  const r = await issueCertificate(studentPk, workshopId, { requireAttendance: !bypassAttendance, sendEmail });
  if (!r.ok) return fail(r.error);
  await audit(user, "manual_issue", "certificate", r.code, { studentPk, workshopId, bypassAttendance, emailed: r.emailed });
  return ok(sendEmail ? (r.emailed ? `Certificate ${r.code} issued and emailed.` : `Certificate ${r.code} issued; email failed${r.error ? `: ${r.error}` : "."}`) : `Certificate ${r.code} issued.`);
}
