import "server-only";
import nodemailer from "nodemailer";
import { sql } from "@/lib/db";
import { getSettingRaw } from "@/lib/data/settings";

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: "none" | "tls" | "ssl";
  user: string;
  pass: string;
  from_email: string;
  from_name: string;
};

export const DEFAULT_SMTP: SmtpSettings = { enabled: false, host: "", port: 587, secure: "tls", user: "", pass: "", from_email: "", from_name: "iCET" };

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const stored = await getSettingRaw<Partial<SmtpSettings>>("smtp");
  const env: Partial<SmtpSettings> = process.env.SMTP_HOST
    ? { enabled: true, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: (process.env.SMTP_SECURE as SmtpSettings["secure"]) || "tls", user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "", from_email: process.env.SMTP_FROM || "", from_name: process.env.SMTP_FROM_NAME || "iCET" }
    : {};
  return { ...DEFAULT_SMTP, ...env, ...(stored || {}) };
}

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
  kind?: string;
  entityType?: string;
  entityId?: string | number;
};

export type MailResult = { ok: true; messageId?: string } | { ok: false; error: string };

export async function sendMail(input: MailInput, smtp?: SmtpSettings): Promise<MailResult> {
  const cfg = smtp || (await getSmtpSettings());
  let result: MailResult;
  if (!cfg.enabled || !cfg.host) {
    result = { ok: false, error: "SMTP is not configured. Set it under Admin → Registry → Email Settings." };
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure === "ssl",
        requireTLS: cfg.secure === "tls",
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
        connectionTimeout: 15000,
      });
      const from = cfg.from_email ? `"${(input.fromName || cfg.from_name || "iCET").replace(/["<>]/g, "")}" <${cfg.from_email}>` : undefined;
      const info = await transporter.sendMail({
        from,
        sender: cfg.from_email || undefined,
        to: input.to,
        replyTo: input.replyTo || undefined,
        subject: input.subject,
        html: input.html,
        text: input.text || input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        attachments: input.attachments,
      });
      result = { ok: true, messageId: info.messageId };
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  try {
    await sql`insert into public.email_log (to_email, subject, kind, status, error, entity_type, entity_id)
      values (${input.to}, ${input.subject}, ${input.kind || "generic"}, ${result.ok ? "sent" : "failed"}, ${result.ok ? null : result.error}, ${input.entityType ?? null}, ${input.entityId == null ? null : String(input.entityId)})`;
  } catch {
    /* logging must not break sending */
  }
  return result;
}

export async function testSmtp(cfg: SmtpSettings): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure === "ssl", requireTLS: cfg.secure === "tls",
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined, connectionTimeout: 15000,
    });
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Branded wrapper for system notifications (inquiries etc.). */
export function layoutEmail(title: string, bodyHtml: string, footer = "iCET – Institute of Computer Engineering Technology · 223 A, Galle Road, Panadura · +94 705 805 805") {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%">
    <tr><td style="background:#0b1f3a;padding:22px 32px;color:#fff;font-size:20px;font-weight:700">${title}</td></tr>
    <tr><td style="padding:28px 32px;font-size:15px;line-height:1.65">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">${footer}</td></tr>
  </table></td></tr></table></body></html>`;
}
