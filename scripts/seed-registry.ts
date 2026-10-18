/**
 * Registry migration: workshops, batches, students, enrollments, attendance,
 * certificates and applications scraped from the WordPress plugin.
 * Idempotent. Run after `npm run seed` (needs the media map for templates).
 */
import { sql, getToken, uploadFile, MIME, readJson, slugify } from "./lib";
import { looksLikeHtml } from "./lib";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const WP = "https://icet.lk/wp-content/uploads/";
const LEGACY_DIR = process.env.LEGACY_MEDIA_DIR || "/tmp/claude-1000/-run-media-sharadamarasinghe-01DCB46A126F9D70-iCET-web-next/fddb6949-9408-4df4-a0ad-abb7c1f8c86e/scratchpad/site/dl";
let token = "";

async function U(legacy: string | null | undefined): Promise<string | null> {
  if (!legacy) return null;
  if (!legacy.startsWith(WP)) return legacy;
  const rel = legacy.slice(WP.length).replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");
  const hit = await sql<{ url: string }[]>`select url from public.media where path = ${"legacy/" + rel}`;
  if (hit[0]) return hit[0].url;
  const local = path.join(LEGACY_DIR, rel);
  let buf: Buffer | null = fs.existsSync(local) ? fs.readFileSync(local) : null;
  if (!buf) {
    const res = await fetch(WP + rel, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) buf = Buffer.from(await res.arrayBuffer());
  }
  const ext = rel.split(".").pop()!.toLowerCase();
  if (!buf || (ext !== "svg" && looksLikeHtml(buf))) return legacy;
  const url = await uploadFile(token, "media", "legacy/" + rel, buf, MIME[ext] || "application/octet-stream");
  await sql`insert into public.media (bucket, path, url, folder, filename, title, mime_type, size_bytes) values ('media', ${"legacy/" + rel}, ${url}, ${"legacy/" + rel.split("/").slice(0, 2).join("/")}, ${path.basename(rel)}, ${path.basename(rel)}, ${MIME[ext] || ""}, ${buf.length}) on conflict (bucket, path) do nothing`;
  return url;
}
async function rewrite(html: string) {
  let out = html;
  for (const u of new Set(html.match(/https:\/\/icet\.lk\/wp-content\/uploads\/[^"'\s)]+/g) || [])) out = out.split(u).join((await U(u)) || u);
  return out;
}
function parseWpDate(s: string): string | null {
  // "October 4, 2026 6:19 am"
  const d = new Date(s + " +0530");
  return isNaN(d.getTime()) ? null : d.toISOString();
}

type Ws = { id: number; title: string; status: string; description: string; registration_page_url: string; registration_campaign: string; cert_id_prefix: string; certificate_template_url: string; certificate_mapping: unknown[]; form_fields: Record<string, unknown>; email_settings: Record<string, Record<string, string>> };
type Bt = { id: number; batch_name: string; course_code: string; form_fields: Record<string, unknown>; email_settings: Record<string, Record<string, string>> };
type Student = { pk: number; student_id: string; name: string; email: string; phone: string; batch: string; batch_id: string; date: string; extra: Record<string, string> | unknown[]; enrollments: { workshop_id: string; certificate_code: string | null; email_sent_status: string; enrolled_at: string; registration_source: string | null; registration_medium: string | null; registration_campaign: string | null }[]; attendance: Record<string, boolean> };
type Cert = { certificate_id: string; student_id: string; name: string; email: string; workshop: string; issue_date: string; status: string; reason: string; suspended?: boolean };

async function main() {
  token = await getToken();
  const reg = readJson<{ workshops: Ws[]; batches: Bt[]; global_emails: { reg: Record<string, string>; cert: Record<string, string> } }>("registry.json");

  // Global email templates (private setting)
  await sql`insert into public.site_settings (key, value, is_public) values ('email_templates', ${sql.json({ reg: { ...reg.global_emails.reg, body: await rewrite(reg.global_emails.reg.body || "") }, cert: { ...reg.global_emails.cert, body: await rewrite(reg.global_emails.cert.body || "") } } as never)}, false) on conflict (key) do update set value = excluded.value, is_public = false`;

  const slugFor: Record<number, string> = { 2: "devops-workshop", 3: "agentic-ai-development-workshop", 4: "agentic-ai-application-development-workshop", 5: "agentic-ai-development-short-course", 6: "mobile-application-development-workshop" };
  const heroFor: Record<number, string> = { 2: "2026/07/devops-ws.jpeg", 3: "2026/08/AI-Workshop-Post.jpeg", 4: "2026/09/WhatsApp-Image-2026-09-14-at-8.57.12-AM-1024x256.jpeg", 5: "2026/09/aw02.jpeg", 6: "2026/09/mobile.jpeg" };
  for (const w of reg.workshops) {
    const email = { reg: { ...w.email_settings.reg, body: await rewrite(w.email_settings.reg.body || "") }, cert: { ...w.email_settings.cert, body: await rewrite(w.email_settings.cert.body || "") } };
    const title = w.id === 4 ? "Agentic AI Application Development Workshop" : w.title;
    await sql`insert into public.reg_workshops (id, slug, title, description, hero_image, certificate_template_url, certificate_mapping, form_fields, cert_id_prefix, registration_page_url, registration_campaign, email_settings, status, created_at)
      values (${w.id}, ${slugFor[w.id] || slugify(w.title)}, ${title}, ${w.description.replace(/\r\n/g, "<br>")}, ${await U(WP + heroFor[w.id])}, ${await U(w.certificate_template_url || null)}, ${sql.json(w.certificate_mapping as never)}, ${JSON.stringify(w.form_fields)}, ${w.cert_id_prefix}, ${`${process.env.NEXT_PUBLIC_SITE_URL || "https://icet.lk"}/register/${slugFor[w.id]}`}, ${w.registration_campaign}, ${sql.json(email as never)}, ${w.status === "completed" ? "completed" : "active"}, now())
      on conflict (id) do update set title = excluded.title, description = excluded.description, hero_image = excluded.hero_image, certificate_template_url = excluded.certificate_template_url, certificate_mapping = excluded.certificate_mapping, form_fields = excluded.form_fields, cert_id_prefix = excluded.cert_id_prefix, email_settings = excluded.email_settings, status = excluded.status`;
  }
  await sql`select setval('public.reg_workshops_id_seq', (select max(id) from public.reg_workshops))`;
  console.log("workshops ✓");

  const batchSlug: Record<number, string> = { 1: "icd128-weekdays", 2: "icp-26-27" };
  const batchIntro: Record<number, [string, string]> = {
    1: ["Academic Registration Form for iCET iCD128 WEEKDAYS Batch", "<p>Please complete every section and upload the required documents in PDF format.</p>"],
    2: ["Academic Registration Form for iCET iCP26/27 Batch", "<p>Please complete every section and upload the required documents in PDF format.</p>"],
  };
  for (const b of reg.batches) {
    const email = { reg: { ...b.email_settings.reg, body: await rewrite(b.email_settings.reg.body || "") } };
    await sql`insert into public.reg_batches (id, slug, batch_name, course_code, intro_title, intro_html, form_fields, form_version, email_settings, is_open)
      values (${b.id}, ${batchSlug[b.id]}, ${b.batch_name}, ${b.course_code || (b.id === 1 ? "iCD" : "iCP")}, ${batchIntro[b.id][0]}, ${batchIntro[b.id][1]}, ${JSON.stringify(b.form_fields)}, 1, ${sql.json(email as never)}, true)
      on conflict (id) do update set batch_name = excluded.batch_name, course_code = excluded.course_code, form_fields = excluded.form_fields, email_settings = excluded.email_settings`;
  }
  await sql`select setval('public.reg_batches_id_seq', (select max(id) from public.reg_batches))`;
  console.log("batches ✓");

  const students = readJson<Student[]>("students.json");
  const batchByName: Record<string, number> = { "iCD128 Weekdays": 1, "iCP 26/27": 2 };
  let n = 0;
  for (const s of students) {
    const extra = Array.isArray(s.extra) ? {} : s.extra || {};
    const registered = parseWpDate(s.date) || new Date().toISOString();
    const batchId = s.batch_id ? Number(s.batch_id) : batchByName[s.batch] || null;
    await sql`insert into public.reg_students (id, student_id, batch_id, student_name, student_email, student_phone, extra_fields, registered_at)
      values (${s.pk}, ${s.student_id}, ${batchId && batchId > 0 ? batchId : null}, ${s.name}, ${s.email.toLowerCase()}, ${s.phone || null}, ${sql.json(extra as never)}, ${registered})
      on conflict (id) do update set student_name = excluded.student_name, student_email = excluded.student_email, student_phone = excluded.student_phone, extra_fields = excluded.extra_fields, batch_id = excluded.batch_id`;
    for (const e of s.enrollments) {
      await sql`insert into public.reg_enrollments (student_id, workshop_id, enrolled_at, certificate_code, email_sent_status, registration_source, registration_medium, registration_campaign)
        values (${s.pk}, ${Number(e.workshop_id)}, ${e.enrolled_at + "+05:30"}, ${e.certificate_code || null}, ${e.email_sent_status === "1"}, ${e.registration_source || "direct"}, ${e.registration_medium}, ${e.registration_campaign})
        on conflict (student_id, workshop_id) do update set certificate_code = excluded.certificate_code, email_sent_status = excluded.email_sent_status`;
    }
    for (const [wid, att] of Object.entries(s.attendance || {})) {
      await sql`insert into public.reg_attendance (student_id, workshop_id, is_attended) values (${s.pk}, ${Number(wid)}, ${att}) on conflict (student_id, workshop_id) do update set is_attended = excluded.is_attended`;
    }
    n++;
  }
  await sql`select setval('public.reg_students_id_seq', (select max(id) from public.reg_students))`;
  console.log(`students ✓ (${n})`);

  const certs = readJson<Cert[]>("certificates.json");
  const wsByTitle = Object.fromEntries((await sql<{ id: number; title: string }[]>`select id, title from public.reg_workshops`).map((w) => [w.title, w.id]));
  wsByTitle["Register Now"] = 4;
  let c = 0;
  for (const ct of certs) {
    const st = (await sql<{ id: number; student_name: string }[]>`select id, student_name from public.reg_students where student_id = ${ct.student_id} limit 1`)[0];
    if (!st) { console.warn("  ! no student for cert", ct.certificate_id, ct.student_id); continue; }
    const wid = wsByTitle[ct.workshop] ?? null;
    const issue = /^\d{4}-\d{2}-\d{2}$/.test(ct.issue_date) ? ct.issue_date : new Date().toISOString().slice(0, 10);
    const hash = createHash("sha256").update(`${ct.certificate_id}${st.student_name}${issue}`).digest("hex");
    await sql`insert into public.reg_certificates (certificate_id, student_id, workshop_id, course_name, issue_date, certificate_hash, status, is_suspended, suspension_reason)
      values (${ct.certificate_id}, ${st.id}, ${wid}, ${ct.workshop}, ${issue}, ${hash}, 'valid', ${ct.suspended || /suspend/i.test(ct.status)}, ${ct.reason || null})
      on conflict (certificate_id) do update set workshop_id = excluded.workshop_id, is_suspended = excluded.is_suspended, suspension_reason = excluded.suspension_reason`;
    c++;
  }
  console.log(`certificates ✓ (${c})`);

  // Applications (answers only — documents stayed on the old server)
  const apps = readJson<{ id: string; batch_id: number; kv: [string, string][]; answers: [string, string][] }[]>("applications.json");
  for (const a of apps) {
    const kv = Object.fromEntries(a.kv.map(([k, v]) => [k.toLowerCase(), v]));
    const email = (kv.email || "").toLowerCase();
    if (!email) continue;
    const st = (await sql<{ id: number }[]>`select id from public.reg_students where lower(student_email) = ${email} limit 1`)[0];
    if (!st) continue;
    const ref = kv.reference || `BT${a.batch_id}-${a.id}`;
    const answers = Object.fromEntries(a.answers.map(([q, v]) => [q.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48), v]));
    await sql`insert into public.reg_applications (batch_id, student_id, reference_no, status, answers_json, review_notes)
      values (${a.batch_id}, ${st.id}, ${ref}, 'submitted', ${JSON.stringify(answers)}, 'Migrated from WordPress. Uploaded documents remain on the old server.')
      on conflict (batch_id, student_id) do nothing`;
  }
  console.log("applications ✓");
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
