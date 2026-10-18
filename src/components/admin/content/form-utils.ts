/**
 * Isomorphic helpers shared by the admin content forms and their server actions.
 * No "server-only"/"use client" so both sides can import freely.
 */
import type { ZodError } from "zod";
import type { PageSeo } from "@/lib/blocks/types";

/** Flatten a zod error into { field: message } for ActionState.errors. */
export function zodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function str(fd: FormData, key: string, max = 100000): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.slice(0, max) : "";
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function optional(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Parse a JSON value from a hidden input; returns fallback on failure. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Accepts a JSON array string or a comma separated list; returns trimmed unique strings. */
export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let arr: unknown = null;
  try {
    arr = JSON.parse(raw);
  } catch {
    arr = raw.split(",");
  }
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map((x) => String(x).trim()).filter(Boolean)));
}

export function parseIntArray(raw: string | null | undefined): number[] {
  return parseStringArray(raw).map((x) => Number(x)).filter((n) => Number.isInteger(n));
}

/** Clean an incoming SEO object (from the SeoFields hidden input). */
export function cleanSeo(input: unknown): PageSeo {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const out: PageSeo = {
    title: text(s.title, 160),
    description: text(s.description, 320),
    og_image: text(s.og_image, 1000),
    canonical: text(s.canonical, 1000),
    noindex: s.noindex === true ? true : undefined,
    keywords: Array.isArray(s.keywords) ? s.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 30) : undefined,
    faq_group_slug: text(s.faq_group_slug, 120),
  };
  if (s.schema && typeof s.schema === "object") out.schema = s.schema as PageSeo["schema"];
  for (const k of Object.keys(out) as (keyof PageSeo)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/* ───────── Date/time in Asia/Colombo (fixed UTC+05:30, no DST) ───────── */
const COLOMBO_OFFSET = "+05:30";

/** ISO/timestamptz → value for <input type="datetime-local"> in Colombo time. */
export function toLocalInput(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** datetime-local value (Colombo wall-clock) → ISO string with the Colombo offset, or null. */
export function fromLocalInput(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3] || "00"}${COLOMBO_OFFSET}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Reading time from HTML content, at ~200 words per minute (minimum 1). */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function clampPage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
export function firstParam(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) || "";
}
export const PER_PAGE = 25;
