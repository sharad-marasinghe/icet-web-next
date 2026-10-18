/** Client-safe helpers shared by the registry admin screens. */
import type { MappingItem } from "@/lib/registry/pdf";

export type SearchParams = Record<string, string | string[] | undefined>;
export type AdminPageProps<P extends Record<string, string> = Record<string, string>> = { params: Promise<P>; searchParams: Promise<SearchParams> };

export function sp(v: string | string[] | undefined, fallback = ""): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s == null ? fallback : String(s);
}
export function spInt(v: string | string[] | undefined, fallback = 0): number {
  const n = parseInt(sp(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Build a query string from a filter object, skipping blanks. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const MAPPING_VARS: Record<string, string> = {
  student_name: "Student name",
  certificate_id: "Certificate ID",
  student_id: "Student ID",
  student_nic: "NIC number",
  issue_date: "Issue date",
  course_name: "Course / workshop name",
  signature: "Signature image",
};

export const SAMPLE_CERT_VALUES = {
  student_name: "Amal Perera",
  certificate_id: "ICET-WS1-9D4D19F2",
  student_id: "ICET-REG-7A3F21C0",
  student_nic: "200012345678",
  issue_date: new Date().toISOString().slice(0, 10),
  course_name: "Introduction to DevOps Workshop",
};

export const DEFAULT_MAPPING_ITEM: Omit<MappingItem, "var_key"> = { x: 0, y: 0, font_size: 36, font_color: "#0b1f3a", font_weight: "bold", align: "center" };

/** Convert an ISO timestamp to the value a datetime-local input expects, in Sri Lanka time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export const APPLICATION_STATUSES = ["submitted", "under_review", "shortlisted", "accepted", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = { submitted: "Submitted", under_review: "Under review", shortlisted: "Shortlisted", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" };

export const FEEDBACK_TYPES: Record<string, string> = { text: "Short text", textarea: "Paragraph", rating: "Star rating", yes_no: "Yes / No", info: "Info text (no input)" };

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
