import "server-only";
import { sql } from "@/lib/db";

export const INQUIRY_STATUSES = ["new", "contacted", "qualified", "converted", "closed", "spam"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_TYPES = ["apply", "contact", "callback", "brochure"] as const;

export type InquiryFilters = { q: string; status: string; type: string; program: string; assigned: string; from: string; to: string };

const str = (v: string | string[] | undefined | null) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export function parseInquiryFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): InquiryFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp[k]);
  const status = str(get("status"));
  const type = str(get("type"));
  const assigned = str(get("assigned"));
  return {
    q: str(get("q")),
    status: (INQUIRY_STATUSES as readonly string[]).includes(status) ? status : "",
    type: (INQUIRY_TYPES as readonly string[]).includes(type) ? type : "",
    program: str(get("program")).slice(0, 20),
    assigned: assigned === "unassigned" || assigned === "me" || isUuid(assigned) ? assigned : "",
    from: isDate(str(get("from"))) ? str(get("from")) : "",
    to: isDate(str(get("to"))) ? str(get("to")) : "",
  };
}

export function inquiryWhere(f: InquiryFilters, meId: string) {
  const like = `%${f.q}%`;
  const digits = f.q.replace(/\D/g, "");
  const phoneLike = digits.length >= 5 ? `%${digits.slice(-9)}%` : null;
  return sql`where true
    ${f.status ? sql`and i.status = ${f.status}::public.inquiry_status` : sql``}
    ${f.type ? sql`and i.type = ${f.type}` : sql``}
    ${f.program ? sql`and i.program_code = ${f.program}` : sql``}
    ${f.assigned === "unassigned" ? sql`and i.assigned_to is null` : f.assigned === "me" ? sql`and i.assigned_to = ${meId}` : f.assigned ? sql`and i.assigned_to = ${f.assigned}` : sql``}
    ${f.from ? sql`and i.created_at >= ${f.from}::date` : sql``}
    ${f.to ? sql`and i.created_at < (${f.to}::date + interval '1 day')` : sql``}
    ${f.q ? sql`and (i.name ilike ${like} or i.email ilike ${like} or i.message ilike ${like} ${phoneLike ? sql`or regexp_replace(i.phone, '\\D', '', 'g') like ${phoneLike} or regexp_replace(i.whatsapp, '\\D', '', 'g') like ${phoneLike}` : sql``})` : sql``}`;
}

export function filtersToQuery(f: InquiryFilters, extra: Record<string, string | number> = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) u.set(k, v);
  for (const [k, v] of Object.entries(extra)) if (v !== "" && v !== undefined) u.set(k, String(v));
  return u.toString();
}

export type InquiryListRow = {
  id: string; type: string; name: string; email: string; phone: string; whatsapp: string; program_code: string | null; intake: string | null;
  status: InquiryStatus; assigned_to: string | null; assigned_name: string | null; created_at: string; page_path: string | null;
};
