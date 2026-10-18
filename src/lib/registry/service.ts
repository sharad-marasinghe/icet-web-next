import "server-only";
import { sql } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { getSettingRaw } from "@/lib/data/settings";
import { uploadObject, downloadObject, deleteObjects, serviceToken, publicUrl } from "@/lib/storage";
import { randomCode, absoluteUrl } from "@/lib/utils";
import { sanitizeInline } from "@/lib/sanitize";
import { rateLimit, sha256 } from "@/lib/security";
import { buildCertificatePdf, type MappingItem } from "./pdf";
import {
  DEFAULT_EMAILS, normalizeIdentityFields, normalizeSource, normalizeUtm, renderTemplate, resolveTemplate, sanitizeConfig, sanitizeForm, validateAnswer,
  isLayout, isCoreColumn, UPLOAD_MIMES, MAX_UPLOAD_BYTES, type EmailTemplate, type EntityEmailSettings, type FormFields,
} from "./fields";

export type Workshop = {
  id: number; slug: string; title: string; description: string; hero_image: string | null; certificate_template_url: string | null;
  certificate_mapping: MappingItem[]; form_fields: FormFields; cert_id_prefix: string; registration_page_url: string | null; registration_campaign: string | null;
  email_settings: EntityEmailSettings; status: "draft" | "active" | "completed"; seats: number | null; starts_at: string | null; created_at: string; updated_at: string;
};
export type Batch = {
  id: number; slug: string; batch_name: string; course_code: string; intro_title: string; intro_html: string; form_fields: FormFields; form_version: number;
  email_settings: EntityEmailSettings; is_open: boolean; opens_at: string | null; closes_at: string | null; created_at: string;
};

export async function getWorkshopBySlug(slug: string): Promise<Workshop | null> {
  const rows = await sql<Workshop[]>`select *, starts_at::text, created_at::text, updated_at::text from public.reg_workshops where slug = ${slug} limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}
export async function getWorkshopById(id: number): Promise<Workshop | null> {
  const rows = await sql<Workshop[]>`select *, starts_at::text, created_at::text, updated_at::text from public.reg_workshops where id = ${id} limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}
export async function getBatchBySlug(slug: string): Promise<Batch | null> {
  const rows = await sql<Batch[]>`select *, opens_at::text, closes_at::text, created_at::text from public.reg_batches where slug = ${slug} limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}
export async function getBatchById(id: number): Promise<Batch | null> {
  const rows = await sql<Batch[]>`select *, opens_at::text, closes_at::text, created_at::text from public.reg_batches where id = ${id} limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}

export async function getGlobalEmailTemplates(): Promise<{ reg: EmailTemplate; cert: EmailTemplate }> {
  const stored = await getSettingRaw<Partial<{ reg: Partial<EmailTemplate>; cert: Partial<EmailTemplate> }>>("email_templates");
  return { reg: { ...DEFAULT_EMAILS.reg, ...(stored?.reg || {}) }, cert: { ...DEFAULT_EMAILS.cert, ...(stored?.cert || {}) } };
}

/* ───────────────────────── Registration ───────────────────────── */
export type RegisterInput = {
  workshopId?: number | null;
  batchId?: number | null;
  fields: Record<string, unknown>;            // posted scalar/array answers (name/email/phone/student_id + extra[...])
  files: Record<string, File | undefined>;    // files[field_key]
  attribution?: { source?: string; medium?: string; campaign?: string };
  sourceTracking?: boolean;
  ip: string;
};
export type RegisterResult =
  | { ok: true; message: string; student_id: string; reference_no?: string; email_sent: boolean }
  | { ok: false; status: number; message: string };

const fail = (status: number, message: string): RegisterResult => ({ ok: false, status, message });

export async function registerStudent(input: RegisterInput): Promise<RegisterResult> {
  const { workshopId, batchId } = input;
  if (!workshopId && !batchId) return fail(400, "workshop_id or batch_id is required.");
  if (!(await rateLimit(`reg:ip:${sha256(input.ip)}`, 30, 3600))) return fail(429, "Too many registrations from this connection. Please try again later.");

  let workshop: Workshop | null = null, batch: Batch | null = null, entityLabel = "";
  if (workshopId) {
    workshop = await getWorkshopById(workshopId);
    if (!workshop || workshop.status !== "active") return fail(404, "Workshop not found or registrations are closed.");
    entityLabel = workshop.title;
    if (workshop.seats) {
      const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from public.reg_enrollments where workshop_id = ${workshop.id}`;
      if (count >= workshop.seats) return fail(409, "Sorry, this workshop is fully booked.");
    }
  } else {
    batch = await getBatchById(batchId!);
    if (!batch) return fail(404, "Batch not found.");
    if (!batch.is_open) return fail(409, "Applications for this intake are closed.");
    entityLabel = batch.batch_name;
  }

  const fieldsConf = normalizeIdentityFields(sanitizeForm(workshop ? workshop.form_fields : batch!.form_fields, sanitizeInline));
  const collectName = !!fieldsConf.student_name?.enabled;
  const collectEmail = !!fieldsConf.student_email?.enabled;

  let studentName = String(input.fields.student_name ?? "").trim().replace(/<[^>]*>/g, "");
  let studentEmail = String(input.fields.student_email ?? "").trim().toLowerCase();
  if (collectEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(studentEmail)) return fail(400, "A valid email address is required.");
  } else {
    studentEmail = `anon-${randomCode(8).toLowerCase()}@applications.invalid`;
  }
  if (collectName && !studentName) return fail(400, "Your name is required.");
  if (!studentName) studentName = "Applicant";

  if (collectEmail) {
    const [{ c1 }] = await sql<{ c1: number }[]>`select count(*)::int as c1 from public.reg_students where lower(student_email) = ${studentEmail} and registered_at::date = current_date`;
    const [{ c2 }] = await sql<{ c2: number }[]>`select count(*)::int as c2 from public.reg_enrollments e join public.reg_students s on s.id = e.student_id where lower(s.student_email) = ${studentEmail} and e.enrolled_at::date = current_date`;
    if (Math.max(c1, c2) >= 3) return fail(429, "Daily registration limit reached for this email.");
  }

  let studentId = String(input.fields.student_id ?? "").trim().replace(/[^A-Za-z0-9/_-]/g, "").slice(0, 64);
  const sidConf = fieldsConf.student_id;
  if (!studentId) {
    if (sidConf?.enabled && sidConf.required) return fail(400, "Student ID is required.");
    do {
      studentId = `ICET-REG-${randomCode(4)}`;
    } while ((await sql`select 1 from public.reg_students where student_id = ${studentId}`).length);
  }

  // Validate every configured field; stage uploads.
  const answers: Record<string, string | string[]> = {};
  const extra: Record<string, string> = {};
  let studentPhone = "";
  const pending: { key: string; file: File; ext: string; mime: string }[] = [];

  for (const [k, conf] of Object.entries(fieldsConf)) {
    if (!conf.enabled || isLayout(conf.type)) continue;
    const label = conf.label || k;
    if (conf.type === "file") {
      if (!batch) continue; // uploads only make sense for applications
      const f = input.files[k];
      const has = f && typeof f === "object" && f.size > 0;
      if (!has) {
        if (conf.required) return fail(400, `${label} is required.`);
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) return fail(400, `${label}: file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB limit.`);
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const mime = UPLOAD_MIMES[ext];
      if (!mime || (f.type && f.type !== mime && !(mime === "image/jpeg" && f.type === "image/jpg"))) return fail(400, `${label}: unsupported file type. Allowed: PDF, JPG, PNG, WEBP.`);
      pending.push({ key: k, file: f, ext, mime });
      answers[k] = f.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200);
      continue;
    }
    let raw: unknown;
    if (k === "student_name") raw = studentName;
    else if (k === "student_email") raw = studentEmail;
    else if (k === "student_phone") raw = input.fields.student_phone;
    else if (k === "student_id") raw = studentId;
    else raw = input.fields[k];
    const v = validateAnswer(conf, raw);
    if (!v.ok) return fail(400, v.error);
    const empty = Array.isArray(v.value) ? v.value.length === 0 : v.value === "";
    if (conf.required && empty) return fail(400, `${label} is required.`);
    if (k === "student_phone") studentPhone = Array.isArray(v.value) ? "" : v.value;
    if (!empty) {
      answers[k] = v.value;
      if (!isCoreColumn(k)) extra[k] = Array.isArray(v.value) ? v.value.join(", ") : v.value;
    }
  }

  // Attribution
  let src = "direct", medium = "", campaign = "";
  if (workshop && input.sourceTracking) {
    src = normalizeSource(input.attribution?.source);
    medium = normalizeUtm(input.attribution?.medium, 100);
    campaign = normalizeUtm(input.attribution?.campaign, 150);
  }

  // Person row
  let studentPk: number;
  let insertedStudent = false;
  const existing = collectEmail ? (await sql<{ id: number; student_id: string; student_name: string; student_phone: string | null; extra_fields: Record<string, string>; batch_id: number | null }[]>`select id, student_id, student_name, student_phone, extra_fields, batch_id from public.reg_students where lower(student_email) = ${studentEmail} limit 1`)[0] : undefined;

  if (existing) {
    studentPk = existing.id;
    studentId = existing.student_id;
    if (batch) {
      const dup = await sql`select 1 from public.reg_applications where batch_id = ${batch.id} and student_id = ${studentPk}`;
      if (dup.length) return fail(409, "You have already applied to this intake. Contact us if you need to update your application.");
    }
    if (workshop) {
      const dup = await sql`select 1 from public.reg_enrollments where student_id = ${studentPk} and workshop_id = ${workshop.id}`;
      if (dup.length) return fail(409, "You are already registered for this workshop.");
    }
    const merged = { ...(existing.extra_fields || {}), ...extra };
    await sql`update public.reg_students set
        student_name = ${studentName || existing.student_name},
        student_phone = ${studentPhone || existing.student_phone},
        extra_fields = ${sql.json(merged as never)},
        batch_id = ${batch ? batch.id : existing.batch_id}
      where id = ${studentPk}`;
  } else {
    if (input.fields.student_id && (await sql`select 1 from public.reg_students where student_id = ${studentId}`).length) return fail(409, "Student ID is already registered.");
    const ins = await sql<{ id: number }[]>`insert into public.reg_students (student_id, batch_id, student_name, student_email, student_phone, extra_fields)
      values (${studentId}, ${batch ? batch.id : null}, ${studentName}, ${studentEmail}, ${studentPhone || null}, ${sql.json(extra as never)}) returning id`;
    studentPk = ins[0].id;
    insertedStudent = true;
  }

  const rollback = async () => {
    if (insertedStudent) await sql`delete from public.reg_students where id = ${studentPk}`;
  };

  if (workshop) {
    try {
      await sql`insert into public.reg_enrollments (student_id, workshop_id, registration_source, registration_medium, registration_campaign)
        values (${studentPk}, ${workshop.id}, ${src}, ${medium || null}, ${campaign || null})`;
    } catch {
      await rollback();
      return fail(500, "Could not create the workshop enrollment.");
    }
  }

  let referenceNo: string | undefined;
  if (batch) {
    const prefix = (batch.course_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || `BT${batch.id}`;
    let ref = "";
    do {
      ref = `${prefix}-${randomCode(3)}`;
    } while ((await sql`select 1 from public.reg_applications where reference_no = ${ref}`).length);
    let appId: number;
    try {
      const ins = await sql<{ id: number }[]>`insert into public.reg_applications (batch_id, student_id, reference_no, form_version, status, answers_json)
        values (${batch.id}, ${studentPk}, ${ref}, ${batch.form_version || 1}, 'submitted', ${JSON.stringify(answers)}) returning id`;
      appId = ins[0].id;
    } catch {
      await rollback();
      return fail(500, "Could not store the application.");
    }
    referenceNo = ref;
    // Project filterable answers
    for (const [k, v] of Object.entries(answers)) {
      const conf = fieldsConf[k];
      if (!conf?.filterable) continue;
      for (const single of Array.isArray(v) ? v : [v]) {
        const text = String(single).trim();
        if (!text) continue;
        const num = /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
        await sql`insert into public.reg_application_answers (application_id, batch_id, field_key, value_text, value_num) values (${appId}, ${batch.id}, ${k}, ${text.slice(0, 512)}, ${num})`;
      }
    }
    // Uploads → private bucket
    const token = await serviceToken();
    for (const p of pending) {
      const path = `${batch.id}/${appId}/${p.key}-${randomCode(8).toLowerCase()}.${p.ext}`;
      try {
        const buf = Buffer.from(await p.file.arrayBuffer());
        await uploadObject("applications", path, buf, p.mime, token, false);
        await sql`insert into public.reg_application_files (application_id, field_key, original_name, stored_path, mime_type, size_bytes)
          values (${appId}, ${p.key}, ${String(answers[p.key])}, ${path}, ${p.mime}, ${p.file.size})`;
      } catch (e) {
        console.error("application upload failed", e);
      }
    }
  }

  const reference = referenceNo ?? studentId;
  // Confirmation email
  let emailSent = true;
  if (collectEmail) {
    const globals = await getGlobalEmailTemplates();
    const tpl = resolveTemplate("reg", globals.reg, workshop ? workshop.email_settings : batch!.email_settings);
    if (tpl) {
      const { subject, body } = renderTemplate(tpl, { "{student_name}": studentName, "{workshop_title}": entityLabel, "{reference_no}": reference, "{student_id}": studentId });
      const r = await sendMail({ to: studentEmail, subject, html: body, fromName: tpl.sender_name, replyTo: tpl.reply_to, kind: "registration", entityType: workshop ? "workshop" : "batch", entityId: workshop ? workshop.id : batch!.id });
      emailSent = r.ok;
    }
  }
  return {
    ok: true,
    email_sent: emailSent,
    student_id: studentId,
    reference_no: referenceNo,
    message: emailSent
      ? `Registration successful! Your reference is ${reference}.`
      : `Registration successful! (Reference: ${reference}) We could not send your confirmation email — please keep this reference and contact us if you do not hear back.`,
  };
}

/* ───────────────────────── Certificates ───────────────────────── */
export type VerifyResult =
  | { valid: true; student_name: string; student_id: string; student_nic: string; course_name: string; certificate_code: string; issue_date: string; template_url: string | null; certificate_mapping: MappingItem[]; pdf_url: string | null }
  | { valid: false; is_suspended?: boolean; suspension_reason?: string | null; message: string };

export async function verifyCertificate(codeRaw: string): Promise<VerifyResult> {
  const code = String(codeRaw || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 64);
  if (!code) return { valid: false, message: "No certificate code provided." };
  const cert = (await sql<{ certificate_id: string; issue_date: string; course_name: string; is_suspended: boolean; suspension_reason: string | null; student_id: number; workshop_id: number | null; pdf_url: string | null }[]>`
    select certificate_id, issue_date::text, course_name, is_suspended, suspension_reason, student_id, workshop_id, pdf_url
    from public.reg_certificates where upper(certificate_id) = ${code} and status = 'valid' limit 1`)[0];
  if (cert) {
    if (cert.is_suspended) return { valid: false, is_suspended: true, suspension_reason: cert.suspension_reason, message: `Certificate suspended. Reason: ${cert.suspension_reason || "Contact iCET administration."}` };
    const row = (await sql<{ student_name: string; student_id: string; extra_fields: Record<string, string>; template: string | null; mapping: MappingItem[] | null; title: string | null }[]>`
      select s.student_name, s.student_id, s.extra_fields, w.certificate_template_url as template, w.certificate_mapping as mapping, w.title
      from public.reg_students s left join public.reg_workshops w on w.id = ${cert.workshop_id} where s.id = ${cert.student_id}`)[0];
    if (row) {
      const mapping = Array.isArray(row.mapping) ? row.mapping : [];
      return {
        valid: true, student_name: row.student_name, student_id: row.student_id,
        student_nic: mapping.some((m) => m.var_key === "student_nic") ? String(row.extra_fields?.nic || "") : "",
        course_name: cert.course_name || row.title || "", certificate_code: cert.certificate_id, issue_date: cert.issue_date,
        template_url: row.template, certificate_mapping: mapping, pdf_url: cert.pdf_url,
      };
    }
  }
  // Fallback: enrollment with a code but no synced certificate row
  const e = (await sql<{ certificate_code: string; enrolled_at: string; student_name: string; student_id: string; extra_fields: Record<string, string>; title: string; template: string | null; mapping: MappingItem[] | null }[]>`
    select e.certificate_code, e.enrolled_at::date::text as enrolled_at, s.student_name, s.student_id, s.extra_fields, w.title, w.certificate_template_url as template, w.certificate_mapping as mapping
    from public.reg_enrollments e join public.reg_students s on s.id = e.student_id join public.reg_workshops w on w.id = e.workshop_id
    where upper(e.certificate_code) = ${code} limit 1`)[0];
  if (e) {
    const mapping = Array.isArray(e.mapping) ? e.mapping : [];
    return { valid: true, student_name: e.student_name, student_id: e.student_id, student_nic: mapping.some((m) => m.var_key === "student_nic") ? String(e.extra_fields?.nic || "") : "", course_name: e.title, certificate_code: e.certificate_code, issue_date: e.enrolled_at, template_url: e.template, certificate_mapping: mapping, pdf_url: null };
  }
  return { valid: false, message: "Certificate not found. Check the code and try again." };
}

export function certificatePrefix(w: Pick<Workshop, "id" | "cert_id_prefix">) {
  return w.cert_id_prefix ? `${w.cert_id_prefix.toUpperCase()}-` : `ICET-WS${w.id}-`;
}

async function uniqueCertCode(prefix: string) {
  let code = "";
  do {
    code = `${prefix}${randomCode(4)}`.toUpperCase();
  } while ((await sql`select 1 from public.reg_enrollments where certificate_code = ${code}`).length || (await sql`select 1 from public.reg_certificates where certificate_id = ${code}`).length);
  return code;
}

/** Generate (if needed), store and email one enrollment's certificate. */
export async function issueCertificate(studentPk: number, workshopId: number, opts: { requireAttendance?: boolean; sendEmail?: boolean } = {}): Promise<{ ok: true; code: string; emailed: boolean; error?: string } | { ok: false; error: string }> {
  const w = await getWorkshopById(workshopId);
  if (!w) return { ok: false, error: "Workshop not found." };
  const enr = (await sql<{ id: number; certificate_code: string | null; student_name: string; student_email: string; student_id: string; extra_fields: Record<string, string> }[]>`
    select e.id, e.certificate_code, s.student_name, s.student_email, s.student_id, s.extra_fields
    from public.reg_enrollments e join public.reg_students s on s.id = e.student_id where e.student_id = ${studentPk} and e.workshop_id = ${workshopId}`)[0];
  if (!enr) return { ok: false, error: "Enrollment not found." };
  if (opts.requireAttendance) {
    const att = await sql`select 1 from public.reg_attendance where student_id = ${studentPk} and workshop_id = ${workshopId} and is_attended`;
    if (!att.length) return { ok: false, error: "Student must be marked as attended before a certificate can be issued." };
  }
  let code = enr.certificate_code;
  if (!code) {
    code = await uniqueCertCode(certificatePrefix(w));
    await sql`update public.reg_enrollments set certificate_code = ${code} where id = ${enr.id}`;
  }
  const today = new Date().toISOString().slice(0, 10);
  const existing = (await sql<{ id: number; pdf_url: string | null; issue_date: string }[]>`select id, pdf_url, issue_date::text from public.reg_certificates where certificate_id = ${code}`)[0];
  const issueDate = existing?.issue_date || today;
  const hash = sha256(`${code}${enr.student_name}${issueDate}`);
  if (!existing) {
    await sql`insert into public.reg_certificates (certificate_id, student_id, workshop_id, course_name, issue_date, certificate_hash, status)
      values (${code}, ${studentPk}, ${workshopId}, ${w.title}, ${issueDate}, ${hash}, 'valid') on conflict (certificate_id) do nothing`;
  }
  // PDF
  let pdfBytes: Uint8Array | null = null;
  let pdfUrl = existing?.pdf_url || null;
  try {
    pdfBytes = await buildCertificatePdf(w.certificate_template_url, Array.isArray(w.certificate_mapping) ? w.certificate_mapping : [], {
      student_name: enr.student_name, certificate_id: code, student_id: enr.student_id, student_nic: enr.extra_fields?.nic || "", issue_date: issueDate, course_name: w.title,
    });
    const token = await serviceToken();
    const path = `${w.id}/${code}.pdf`;
    await uploadObject("certificates", path, Buffer.from(pdfBytes), "application/pdf", token, true);
    pdfUrl = publicUrl("certificates", path);
    await sql`update public.reg_certificates set pdf_url = ${pdfUrl} where certificate_id = ${code}`;
  } catch (e) {
    console.error("certificate pdf failed", e);
  }
  let emailed = false;
  let error: string | undefined;
  if (opts.sendEmail !== false && !enr.student_email.endsWith("@applications.invalid")) {
    const globals = await getGlobalEmailTemplates();
    const tpl = resolveTemplate("cert", globals.cert, w.email_settings) || globals.cert;
    const link = absoluteUrl(`/verify-certificate?id=${encodeURIComponent(code)}`);
    const { subject, body } = renderTemplate(tpl, { "{student_name}": enr.student_name, "{workshop_title}": w.title, "{certificate_code}": code, "{certificate_link}": link, "{student_id}": enr.student_id });
    const r = await sendMail({
      to: enr.student_email, subject, html: body, fromName: tpl.sender_name, replyTo: tpl.reply_to, kind: "certificate", entityType: "workshop", entityId: w.id,
      attachments: pdfBytes ? [{ filename: `${code}.pdf`, content: Buffer.from(pdfBytes), contentType: "application/pdf" }] : undefined,
    });
    emailed = r.ok;
    if (!r.ok) error = r.error;
    if (r.ok) await sql`update public.reg_enrollments set email_sent_status = true where id = ${enr.id}`;
  }
  return { ok: true, code, emailed, error };
}

/** Delete an application and its private files. */
export async function deleteApplication(appId: number) {
  const files = await sql<{ stored_path: string }[]>`select stored_path from public.reg_application_files where application_id = ${appId}`;
  if (files.length) {
    try { await deleteObjects("applications", files.map((f) => f.stored_path), await serviceToken()); } catch { /* ignore */ }
  }
  await sql`delete from public.reg_applications where id = ${appId}`;
}

export async function readApplicationFile(fileId: number) {
  const f = (await sql<{ stored_path: string; original_name: string; mime_type: string }[]>`select stored_path, original_name, mime_type from public.reg_application_files where id = ${fileId}`)[0];
  if (!f) return null;
  const { buffer, contentType } = await downloadObject("applications", f.stored_path, await serviceToken());
  return { buffer, contentType: f.mime_type || contentType, filename: f.original_name };
}

export { sanitizeConfig, sanitizeForm };
