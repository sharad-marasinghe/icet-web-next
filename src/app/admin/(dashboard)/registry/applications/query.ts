import "server-only";
import { sql } from "@/lib/db";
import { sanitizeKey } from "@/lib/registry/fields";
import { APPLICATION_STATUSES, sp, type SearchParams } from "@/components/admin/registry/shared";

export type ApplicationFilters = { batch: number; status: string; q: string; from: string; to: string; fieldKey: string; fieldVal: string };

export function readApplicationFilters(spv: SearchParams | URLSearchParams): ApplicationFilters {
  const get = (k: string) => (spv instanceof URLSearchParams ? spv.get(k) || "" : sp(spv[k]));
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return {
    batch: parseInt(get("batch_id"), 10) || 0,
    status: (APPLICATION_STATUSES as readonly string[]).includes(get("status")) ? get("status") : "",
    q: get("q").trim().slice(0, 200),
    from: date(get("date_from")), to: date(get("date_to")),
    fieldKey: sanitizeKey(get("field_key")), fieldVal: get("field_val").trim().slice(0, 512),
  };
}

/** Everything except the status clause (so the tabs can count per status). */
export function applicationWhere(f: ApplicationFilters, includeStatus = true) {
  const like = "%" + f.q.replace(/[%_\\]/g, (m) => "\\" + m) + "%";
  return sql`where a.batch_id = ${f.batch}
    ${includeStatus && f.status ? sql`and a.status = ${f.status}::public.application_status` : sql``}
    ${f.q ? sql`and (a.reference_no ilike ${like} or s.student_name ilike ${like} or s.student_email ilike ${like} or s.student_id ilike ${like})` : sql``}
    ${f.from ? sql`and a.submitted_at >= (${f.from}::date)::timestamp at time zone 'Asia/Colombo'` : sql``}
    ${f.to ? sql`and a.submitted_at < ((${f.to}::date + 1))::timestamp at time zone 'Asia/Colombo'` : sql``}
    ${f.fieldKey && f.fieldVal ? sql`and exists (select 1 from public.reg_application_answers x where x.application_id = a.id and x.field_key = ${f.fieldKey} and x.value_text = ${f.fieldVal})` : sql``}`;
}
