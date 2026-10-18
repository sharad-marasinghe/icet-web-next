"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { sendMail, testSmtp, getSmtpSettings, type SmtpSettings } from "@/lib/mailer";
import { DEFAULT_EMAILS, renderTemplate, type EmailTemplate } from "@/lib/registry/fields";
import { getGlobalEmailTemplates } from "@/lib/registry/service";
import type { ActionState } from "@/components/admin/ui";
import { fail, ok, sanitizeEmailHtml, str, zodErrors } from "../_shared";

const templateSchema = z.object({
  sender_name: z.string().trim().min(1, "Sender name is required").max(150),
  reply_to: z.string().trim().email("Enter a valid reply-to address").max(200).or(z.literal("")),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(20000),
});

const SAMPLE_VARS: Record<"reg" | "cert", Record<string, string>> = {
  reg: { "{student_name}": "Amal Perera", "{workshop_title}": "Introduction to DevOps Workshop", "{reference_no}": "ICET-REG-7A3F21C0", "{student_id}": "ICET-REG-7A3F21C0" },
  cert: { "{student_name}": "Amal Perera", "{workshop_title}": "Introduction to DevOps Workshop", "{certificate_code}": "ICET-WS1-9D4D19F2", "{certificate_link}": `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/verify-certificate?id=ICET-WS1-9D4D19F2`, "{student_id}": "ICET-REG-7A3F21C0" },
};

/** Save one of the two global templates (site_settings.email_templates). Admin only. */
export async function saveGlobalTemplate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const type = str(fd, "type") === "cert" ? "cert" : "reg";
  const parsed = templateSchema.safeParse({ sender_name: str(fd, "sender_name"), reply_to: str(fd, "reply_to"), subject: str(fd, "subject"), body: str(fd, "body") });
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
  const tpl: EmailTemplate = { ...parsed.data, body: sanitizeEmailHtml(parsed.data.body) };
  const current = await getGlobalEmailTemplates();
  const value = { ...current, [type]: tpl };
  await sql`insert into public.site_settings (key, value, is_public, updated_by) values ('email_templates', ${sql.json(value as never)}, false, ${user.id})
    on conflict (key) do update set value = excluded.value, is_public = false, updated_at = now(), updated_by = excluded.updated_by`;
  await audit(user, "update", "email_template", type, { type });
  return ok(type === "reg" ? "Registration confirmation template saved." : "Certificate delivery template saved.");
}

export async function resetGlobalTemplate(type: "reg" | "cert"): Promise<ActionState> {
  const user = await assertRole("admin");
  const current = await getGlobalEmailTemplates();
  const value = { ...current, [type]: DEFAULT_EMAILS[type] };
  await sql`insert into public.site_settings (key, value, is_public, updated_by) values ('email_templates', ${sql.json(value as never)}, false, ${user.id})
    on conflict (key) do update set value = excluded.value, is_public = false, updated_at = now(), updated_by = excluded.updated_by`;
  await audit(user, "reset", "email_template", type);
  return ok("Template reset to the default wording.");
}

/**
 * Send a test rendering of a template with sample variables. Used by the global
 * template forms and by per-workshop/batch overrides (editor role).
 */
export async function sendTemplateTest(input: { type: "reg" | "cert"; template: Partial<EmailTemplate>; to: string; entityId?: number; entityType?: "workshop" | "batch" }): Promise<ActionState> {
  const user = await assertRole("editor");
  const to = String(input.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return fail("Enter a valid email address for the test.");
  const type = input.type === "cert" ? "cert" : "reg";
  const globals = await getGlobalEmailTemplates();
  const base = globals[type];
  const tpl: EmailTemplate = { ...base };
  for (const f of ["sender_name", "reply_to", "subject", "body"] as const) {
    const v = String(input.template?.[f] ?? "").trim();
    if (v) tpl[f] = f === "body" ? sanitizeEmailHtml(v) : v.slice(0, 20000);
  }
  const { subject, body } = renderTemplate(tpl, SAMPLE_VARS[type]);
  const r = await sendMail({ to, subject: `[TEST] ${subject}`, html: body, fromName: tpl.sender_name, replyTo: tpl.reply_to, kind: "test", entityType: input.entityType, entityId: input.entityId });
  await audit(user, "send_test", "email_template", type, { to });
  return r.ok ? ok(`Test email sent to ${to}.`) : fail(`Could not send: ${r.error}`);
}

const smtpSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.enum(["none", "tls", "ssl"]),
  user: z.string().trim().max(255),
  pass: z.string().max(500),
  from_email: z.string().trim().email("Enter a valid from address").max(200).or(z.literal("")),
  from_name: z.string().trim().max(150),
});

async function smtpFromForm(fd: FormData): Promise<{ ok: true; cfg: SmtpSettings } | { ok: false; errors: Record<string, string> }> {
  const stored = await getSmtpSettings();
  const parsed = smtpSchema.safeParse({
    enabled: fd.get("enabled") === "on" || fd.get("enabled") === "true",
    host: str(fd, "host"), port: str(fd, "port") || 587, secure: str(fd, "secure") || "tls", user: str(fd, "user"),
    pass: String(fd.get("pass") ?? "") || stored.pass, from_email: str(fd, "from_email"), from_name: str(fd, "from_name") || "iCET",
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  if (parsed.data.enabled && !parsed.data.host) return { ok: false, errors: { host: "Host is required when SMTP is enabled" } };
  return { ok: true, cfg: parsed.data };
}

export async function saveSmtpSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const r = await smtpFromForm(fd);
  if (!r.ok) return fail("Please fix the highlighted fields.", r.errors);
  await sql`insert into public.site_settings (key, value, is_public, updated_by) values ('smtp', ${sql.json(r.cfg as never)}, false, ${user.id})
    on conflict (key) do update set value = excluded.value, is_public = false, updated_at = now(), updated_by = excluded.updated_by`;
  await audit(user, "update", "smtp_settings", "smtp", { host: r.cfg.host, enabled: r.cfg.enabled });
  return ok("SMTP settings saved.");
}

export async function testSmtpConnection(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await assertRole("admin");
  const r = await smtpFromForm(fd);
  if (!r.ok) return fail("Please fix the highlighted fields.", r.errors);
  if (!r.cfg.host) return fail("Enter an SMTP host first.");
  const t = await testSmtp(r.cfg);
  return t.ok ? ok(`Connected to ${r.cfg.host}:${r.cfg.port} successfully.`) : fail(`Connection failed: ${t.error}`);
}

export async function sendSmtpTestEmail(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const to = str(fd, "test_to");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return fail("Enter a valid recipient address.", { test_to: "Enter a valid email" });
  const r = await smtpFromForm(fd);
  if (!r.ok) return fail("Please fix the highlighted fields.", r.errors);
  const cfg = { ...r.cfg, enabled: true };
  const res = await sendMail({ to, subject: "iCET SMTP test email", html: `<p>This is a test message from the iCET website admin, sent at ${new Date().toISOString()}.</p><p>If you are reading this, outgoing email is configured correctly.</p>`, kind: "test" }, cfg);
  await audit(user, "send_test", "smtp_settings", "smtp", { to });
  return res.ok ? ok(`Test email sent to ${to}.`) : fail(`Sending failed: ${res.error}`);
}
