"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/data/settings";
import type { ActionState } from "@/components/admin/ui";

const str = (max = 500) => z.string().trim().max(max).default("");
const urlish = (max = 600) => z.string().trim().max(max).refine((v) => !v || /^(https?:\/\/|\/|mailto:|tel:)/i.test(v), "Enter a full URL (https://…) or a path starting with /").default("");
const optStr = (max = 300) => z.string().trim().max(max).optional();
const optUrl = (max = 600) => z.string().trim().max(max).refine((v) => !v || /^https?:\/\//i.test(v), "Enter a full URL (https://…)").optional();
const email = z.string().trim().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email address").default("");
const intNum = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const schema = z.object({
  site_name: z.string().trim().min(2, "Site name is required").max(160),
  tagline: str(200),
  logo_url: urlish(),
  logo_dark_url: urlish(),
  favicon_url: urlish(),
  phone: str(40),
  phone_display: str(40),
  whatsapp: z.string().trim().max(20).regex(/^\d*$/, "Digits only, including the country code (e.g. 94705805805)").default(""),
  whatsapp_message: str(600),
  whatsapp_channel_url: urlish(),
  email,
  email_academics: email,
  address_line1: str(200),
  address_line2: str(200),
  city: str(80),
  postal_code: str(20),
  country: str(80),
  map_url: urlish(),
  map_embed_url: urlish(2000),
  opening_hours: str(200),
  tvec_reg_no: str(40),
  founded_year: intNum(1900, 2100),
  lms_url: urlish(),
  social: z.object({ facebook: optUrl(), youtube: optUrl(), linkedin: optUrl(), instagram: optUrl(), tiktok: optUrl(), whatsapp: optUrl(), x: optUrl() }).default({}),
  footer_about: str(600),
  footer_copyright: str(300),
  announcement: z.object({ enabled: z.boolean().default(false), text: str(300), link_label: optStr(60), link_url: z.string().trim().max(600).refine((v) => !v || /^(https?:\/\/|\/)/i.test(v), "Enter a URL or a path").optional(), tone: z.enum(["brand", "navy", "green"]).optional() }),
  seo: z.object({ default_title: str(200), title_template: str(200), default_description: str(400), default_og_image: urlish(), keywords: z.array(z.string().trim().min(1).max(80)).max(40).default([]), twitter_handle: optStr(40) }),
  analytics: z.object({ ga4_id: optStr(40), gtm_id: optStr(40), fb_pixel_id: optStr(40), clarity_id: optStr(40), google_site_verification: optStr(200) }).default({}),
  stats: z.object({ professionals_trained: intNum(0, 10_000_000), years_excellence: intNum(0, 200), current_students: intNum(0, 1_000_000), partners: intNum(0, 100_000), placement_rate: optStr(20) }),
  google_review_url: urlish(),
  bank_details: str(2000),
  apply: z.object({ intake_label: str(120), intake_subtitle: str(200), success_message: str(400), notify_emails: z.array(z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email")).max(20).default([]) }),
});

/** Remove empty strings from optional nested maps so defaults/absence behave consistently. */
function stripEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== "" && v !== undefined) out[k] = v;
  return out as T;
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") || "{}"));
  } catch {
    return { ok: false, message: "Could not read the form data." };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".")] = issue.message;
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }
  const d = parsed.data;
  const value: SiteSettings = {
    ...DEFAULT_SETTINGS,
    ...d,
    social: stripEmpty(d.social),
    analytics: stripEmpty(d.analytics),
    announcement: { ...stripEmpty(d.announcement), enabled: d.announcement.enabled, text: d.announcement.text, tone: d.announcement.tone || "brand" },
    seo: { ...d.seo, twitter_handle: d.seo.twitter_handle || undefined, keywords: Array.from(new Set(d.seo.keywords)) },
    stats: { ...d.stats, placement_rate: d.stats.placement_rate || undefined },
    apply: { ...d.apply, notify_emails: Array.from(new Set(d.apply.notify_emails)) },
  };
  if (!value.announcement.link_label) delete value.announcement.link_label;
  if (!value.announcement.link_url) delete value.announcement.link_url;

  await sql`insert into public.site_settings (key, value, is_public, updated_at, updated_by)
    values ('site', ${sql.json(value as never)}, true, now(), ${user.id})
    on conflict (key) do update set value = excluded.value, is_public = true, updated_at = now(), updated_by = excluded.updated_by`;
  bust(TAGS.settings);
  await audit(user, "update", "site_settings", "site", { sections: Object.keys(d) });
  return { ok: true, message: "Site settings saved." };
}
