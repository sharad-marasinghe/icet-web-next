"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { sanitizeHtml } from "@/lib/sanitize";
import { sendMail } from "@/lib/mailer";
import { buildCertificatePdf } from "@/lib/registry/pdf";
import { sanitizeForm, defaultCampaign } from "@/lib/registry/fields";
import type { ActionState } from "@/components/admin/ui";
import { SAMPLE_CERT_VALUES } from "@/components/admin/registry/shared";
import { fail, ok, parseEmailSettings, parseLocalDateTime, parseMapping, sanitizeHelp, str, uniqueSlug, zodErrors, intOrNull } from "../_shared";

const schema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  slug: z.string().trim().max(120),
  description: z.string().max(50000),
  hero_image: z.string().trim().max(1000),
  status: z.enum(["draft", "active", "completed"]),
  seats: z.number().int().min(0).max(100000).nullable(),
  starts_at: z.string().nullable(),
  registration_page_url: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), "Must be an absolute http(s) URL"),
  registration_campaign: z.string().trim().max(150),
  cert_id_prefix: z.string().trim().toUpperCase().max(30).regex(/^[A-Z0-9-]*$/, "Only A–Z, 0–9 and hyphens"),
  certificate_template_url: z.string().trim().max(1000),
});

export async function saveWorkshop(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("editor");
  const id = intOrNull(str(fd, "id"));
  const parsed = schema.safeParse({
    title: str(fd, "title"), slug: str(fd, "slug"), description: String(fd.get("description") ?? ""), hero_image: str(fd, "hero_image"),
    status: str(fd, "status") || "draft", seats: intOrNull(str(fd, "seats")), starts_at: parseLocalDateTime(str(fd, "starts_at")),
    registration_page_url: str(fd, "registration_page_url"), registration_campaign: str(fd, "registration_campaign"),
    cert_id_prefix: str(fd, "cert_id_prefix"), certificate_template_url: str(fd, "certificate_template_url"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const d = parsed.data;
  const slug = await uniqueSlug("reg_workshops", d.slug || d.title, id);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const regUrl = d.registration_page_url || `${base}/register/${slug}`;
  const campaign = d.registration_campaign ? d.registration_campaign.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "") : defaultCampaign(d.title, id ?? 0);
  const mapping = parseMapping(fd.get("certificate_mapping"));
  const form = sanitizeForm(String(fd.get("form_fields") ?? "{}"), sanitizeHelp);
  const emails = parseEmailSettings(fd.get("email_settings"), true);
  const description = sanitizeHtml(d.description);

  if (id) {
    const rows = await sql`update public.reg_workshops set
        title = ${d.title}, slug = ${slug}, description = ${description}, hero_image = ${d.hero_image || null}, status = ${d.status}::public.workshop_status,
        seats = ${d.seats}, starts_at = ${d.starts_at}, registration_page_url = ${regUrl}, registration_campaign = ${campaign},
        cert_id_prefix = ${d.cert_id_prefix}, certificate_template_url = ${d.certificate_template_url || null},
        certificate_mapping = ${sql.json(mapping as never)}, form_fields = ${JSON.stringify(form)}, email_settings = ${sql.json(emails as never)}, updated_at = now()
      where id = ${id} returning id`;
    if (!rows.length) return fail("Workshop not found.");
    await audit(user, "update", "workshop", id, { title: d.title });
    bust(TAGS.workshops);
    return ok("Workshop saved.", id);
  }
  const ins = await sql<{ id: number }[]>`insert into public.reg_workshops
      (title, slug, description, hero_image, status, seats, starts_at, registration_page_url, registration_campaign, cert_id_prefix, certificate_template_url, certificate_mapping, form_fields, email_settings)
    values (${d.title}, ${slug}, ${description}, ${d.hero_image || null}, ${d.status}::public.workshop_status, ${d.seats}, ${d.starts_at}, ${regUrl}, ${campaign}, ${d.cert_id_prefix}, ${d.certificate_template_url || null},
      ${sql.json(mapping as never)}, ${JSON.stringify(form)}, ${sql.json(emails as never)}) returning id`;
  await audit(user, "create", "workshop", ins[0].id, { title: d.title });
  bust(TAGS.workshops);
  redirect(`/admin/registry/workshops/${ins[0].id}?created=1`);
}

export async function setWorkshopStatus(id: number, status: "draft" | "active" | "completed"): Promise<ActionState> {
  const user = await assertRole("editor");
  if (!["draft", "active", "completed"].includes(status)) return fail("Invalid status.");
  const rows = await sql`update public.reg_workshops set status = ${status}::public.workshop_status, updated_at = now() where id = ${id} returning id`;
  if (!rows.length) return fail("Workshop not found.");
  await audit(user, "status", "workshop", id, { status });
  bust(TAGS.workshops);
  return ok(status === "completed" ? "Workshop marked as completed." : status === "active" ? "Workshop reactivated." : "Workshop moved to draft.");
}

export async function deleteWorkshop(id: number): Promise<ActionState> {
  const user = await assertRole("admin");
  const rows = await sql<{ title: string }[]>`delete from public.reg_workshops where id = ${id} returning title`;
  if (!rows.length) return fail("Workshop not found.");
  await audit(user, "delete", "workshop", id, { title: rows[0].title });
  bust(TAGS.workshops);
  return ok("Workshop deleted along with its enrolments and attendance records.");
}

/** Build a sample certificate PDF with the current (unsaved) template + mapping and email it. */
export async function sendTestCertificateEmail(input: { template_url: string; mapping: unknown; to: string; workshop_title?: string }): Promise<ActionState> {
  const user = await assertRole("editor");
  const to = String(input.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return fail("Enter a valid email address.");
  const mapping = parseMapping(input.mapping);
  const template = String(input.template_url || "").trim() || null;
  try {
    const pdf = await buildCertificatePdf(template, mapping, { ...SAMPLE_CERT_VALUES, course_name: input.workshop_title || SAMPLE_CERT_VALUES.course_name });
    const r = await sendMail({
      to, subject: "[TEST] Sample certificate from iCET admin", kind: "test",
      html: `<p>This is a test certificate rendered with the current template and coordinate mapping.</p><p>Sample values: ${SAMPLE_CERT_VALUES.student_name} · ${SAMPLE_CERT_VALUES.certificate_id}</p>`,
      attachments: [{ filename: `${SAMPLE_CERT_VALUES.certificate_id}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    await audit(user, "send_test", "certificate_template", null, { to });
    return r.ok ? ok(`Test certificate sent to ${to}.`) : fail(`Could not send: ${r.error}`);
  } catch (e) {
    return fail(`Could not build the PDF: ${e instanceof Error ? e.message : String(e)}`);
  }
}
