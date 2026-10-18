import "server-only";
import { z } from "zod";
import { sql } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { sanitizeInline } from "@/lib/sanitize";
import type { MappingItem } from "@/lib/registry/pdf";
import type { EntityEmailSettings } from "@/lib/registry/fields";
import type { ActionState } from "@/components/admin/ui";

export const MAPPING_KEYS = ["student_name", "certificate_id", "student_id", "student_nic", "issue_date", "course_name", "signature"] as const;

const mappingItem = z.object({
  var_key: z.enum(MAPPING_KEYS),
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
  font_size: z.coerce.number().min(6).max(400).optional(),
  font_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  font_weight: z.enum(["normal", "bold", "italic"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  image_url: z.string().max(1000).optional(),
  width: z.coerce.number().min(1).max(5000).optional(),
  height: z.coerce.number().min(1).max(5000).optional(),
});

/** Parse the JSON produced by the canvas mapper; invalid items are dropped. */
export function parseMapping(raw: unknown): MappingItem[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (!Array.isArray(data)) return [];
  const out: MappingItem[] = [];
  for (const item of data) {
    const r = mappingItem.safeParse(item);
    if (!r.success) continue;
    const m = r.data;
    if (m.image_url && !/^(https?:)?\//i.test(m.image_url)) m.image_url = undefined;
    out.push({ ...m, x: Math.round(m.x), y: Math.round(m.y) });
  }
  return out.slice(0, 40);
}

const tpl = z.object({
  mode: z.enum(["default", "custom", "off"]).optional(),
  sender_name: z.string().max(150).optional(),
  reply_to: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().max(20000).optional(),
});

export function parseEmailSettings(raw: unknown, allowCert: boolean): EntityEmailSettings {
  let data: unknown = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return {}; }
  }
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const out: EntityEmailSettings = {};
  const reg = tpl.safeParse(d.reg);
  if (reg.success) out.reg = { ...reg.data, body: reg.data.body ? sanitizeEmailHtml(reg.data.body) : undefined };
  if (allowCert) {
    const cert = tpl.safeParse(d.cert);
    if (cert.success) {
      const mode = cert.data.mode === "off" ? "default" : cert.data.mode;
      out.cert = { ...cert.data, mode, body: cert.data.body ? sanitizeEmailHtml(cert.data.body) : undefined };
    }
  }
  return out;
}

/** Email bodies may carry block-level HTML; strip scripts/styles but keep structure. */
export function sanitizeEmailHtml(html: string) {
  return String(html)
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

export const sanitizeHelp = (h: string) => sanitizeInline(h);

/** Ensure a slug is unique within a table, appending -2, -3… when needed. */
export async function uniqueSlug(table: "reg_workshops" | "reg_batches" | "feedback_forms", desired: string, excludeId?: number | null): Promise<string> {
  const base = slugify(desired) || "item";
  let slug = base;
  for (let i = 2; i < 200; i++) {
    const rows = table === "reg_workshops"
      ? await sql`select id from public.reg_workshops where slug = ${slug} and id <> ${excludeId ?? 0}`
      : table === "reg_batches"
        ? await sql`select id from public.reg_batches where slug = ${slug} and id <> ${excludeId ?? 0}`
        : await sql`select id from public.feedback_forms where slug = ${slug} and id <> ${excludeId ?? 0}`;
    if (!rows.length) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** datetime-local value (interpreted in Asia/Colombo) → ISO string or null. */
export function parseLocalDateTime(v: string | null | undefined): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  // Sri Lanka has no DST: fixed +05:30.
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}
export function ok(message: string, id?: string | number): ActionState {
  return { ok: true, message, id };
}

export function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_";
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const intOrNull = (v: string) => (v === "" ? null : Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : null);
