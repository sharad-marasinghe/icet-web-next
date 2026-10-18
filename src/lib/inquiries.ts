import "server-only";
import { sql } from "@/lib/db";
import { sendMail, layoutEmail } from "@/lib/mailer";
import { getSiteSettingsUncached } from "@/lib/data/settings";
import { hashIp } from "@/lib/security";

export type InquiryInput = {
  type: "apply" | "contact" | "callback" | "brochure";
  name: string; email?: string; phone?: string; whatsapp?: string; program_code?: string; intake?: string; message?: string;
  data?: Record<string, unknown>; utm?: Record<string, string>; page_path?: string; ip: string;
};

const clean = (v: unknown, max = 300) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export async function createInquiry(input: InquiryInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = clean(input.name, 120);
  const email = clean(input.email, 200).toLowerCase();
  const phone = clean(input.phone, 40);
  if (!name) return { ok: false, error: "Please enter your name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (input.type === "apply" && !phone) return { ok: false, error: "Please enter your contact number." };
  if (input.type === "contact" && !email) return { ok: false, error: "Please enter your email address." };
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.data || {})) if (/^[a-z0-9_]{1,40}$/.test(k)) data[k] = clean(v, 2000);
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.utm || {})) if (/^utm_[a-z]+$/.test(k)) utm[k] = clean(v, 150);

  const rows = await sql<{ id: string }[]>`insert into public.inquiries (type, name, email, phone, whatsapp, program_code, intake, message, data, utm, page_path, ip_hash)
    values (${input.type}, ${name}, ${email}, ${phone}, ${clean(input.whatsapp, 40)}, ${clean(input.program_code, 20) || null}, ${clean(input.intake, 80) || null},
            ${clean(input.message, 4000)}, ${sql.json(data as never)}, ${sql.json(utm as never)}, ${clean(input.page_path, 200) || null}, ${hashIp(input.ip)}) returning id`;
  const id = rows[0].id;

  // Notify staff (best effort)
  try {
    const s = await getSiteSettingsUncached();
    const to = (s.apply?.notify_emails || []).filter(Boolean);
    if (to.length) {
      const rowsHtml = [
        ["Type", input.type], ["Name", name], ["Email", email], ["Phone", phone], ["WhatsApp", clean(input.whatsapp)], ["Programme", clean(input.program_code)], ["Intake", clean(input.intake)],
        ...Object.entries(data).map(([k, v]) => [k.replace(/_/g, " "), v]), ["Message", clean(input.message, 4000)], ["Page", clean(input.page_path)],
      ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:6px 10px;color:#64748b;text-transform:capitalize;white-space:nowrap">${k}</td><td style="padding:6px 10px;font-weight:600">${String(v).replace(/</g, "&lt;")}</td></tr>`).join("");
      await sendMail({
        to: to.join(","), subject: `New ${input.type === "apply" ? "application inquiry" : input.type} — ${name}`,
        html: layoutEmail(`New ${input.type === "apply" ? "Application Inquiry" : "Website Message"}`, `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">${rowsHtml}</table><p style="margin-top:18px"><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin/inquiries/${id}" style="background:#046bd2;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open in admin</a></p>`),
        kind: "inquiry", entityType: "inquiry", entityId: id,
      });
    }
    if (email && input.type === "apply") {
      await sendMail({
        to: email, subject: `We received your inquiry – ${s.site_name.split(" - ")[0]}`,
        html: layoutEmail("Thank you for your interest in iCET", `<p>Dear ${name.replace(/</g, "&lt;")},</p><p>${s.apply?.success_message || "Our student counsellor will contact you shortly."}</p><p>Hotline / WhatsApp: <strong>${s.phone_display}</strong><br>Email: <a href="mailto:${s.email}">${s.email}</a></p><p>Regards,<br>Admissions Team · iCET</p>`),
        kind: "inquiry", entityType: "inquiry", entityId: id,
      });
    }
  } catch (e) {
    console.error("inquiry notification failed", e);
  }
  return { ok: true, id };
}
