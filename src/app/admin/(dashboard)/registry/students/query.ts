import "server-only";
import { sql } from "@/lib/db";
import { normalizeSource, sanitizeKey } from "@/lib/registry/fields";
import { sp, type SearchParams } from "@/components/admin/registry/shared";

export type StudentFilters = { q: string; workshop: string; batch: number; attendance: string; source: string; from: string; to: string; extraKey: string; extraVal: string };

export function readStudentFilters(spv: SearchParams | URLSearchParams): StudentFilters {
  const get = (k: string) => (spv instanceof URLSearchParams ? spv.get(k) || "" : sp(spv[k]));
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return {
    q: get("q").trim().slice(0, 200),
    workshop: get("workshop_id") === "unassigned" ? "unassigned" : String(parseInt(get("workshop_id"), 10) || ""),
    batch: parseInt(get("batch_id"), 10) || 0,
    attendance: ["attended", "not_attended"].includes(get("attendance")) ? get("attendance") : "",
    source: get("source") ? normalizeSource(get("source")) : "",
    from: date(get("date_from")),
    to: date(get("date_to")),
    extraKey: sanitizeKey(get("extra_key")),
    extraVal: get("extra_val").trim().slice(0, 200),
  };
}

export function isFiltered(f: StudentFilters) {
  return !!(f.q || f.workshop || f.batch || f.attendance || f.source || f.from || f.to || f.extraKey || f.extraVal);
}

/** WHERE fragment mirroring the WordPress plugin's build_students_query_where(). */
export function studentWhere(f: StudentFilters) {
  const wsId = f.workshop && f.workshop !== "unassigned" ? parseInt(f.workshop, 10) : 0;
  const like = (v: string) => "%" + v.replace(/[%_\\]/g, (m) => "\\" + m) + "%";
  return sql`where true
    ${f.q ? sql`and (s.student_name ilike ${like(f.q)} or s.student_email ilike ${like(f.q)} or s.student_id ilike ${like(f.q)} or coalesce(s.student_phone, '') ilike ${like(f.q)})` : sql``}
    ${f.batch ? sql`and s.batch_id = ${f.batch}` : sql``}
    ${f.workshop === "unassigned" ? sql`and not exists (select 1 from public.reg_enrollments e where e.student_id = s.id)` : wsId ? sql`and exists (select 1 from public.reg_enrollments e where e.student_id = s.id and e.workshop_id = ${wsId})` : sql``}
    ${f.source ? sql`and exists (select 1 from public.reg_enrollments src where src.student_id = s.id ${wsId ? sql`and src.workshop_id = ${wsId}` : sql``} and ${f.source === "direct" ? sql`coalesce(nullif(src.registration_source, ''), 'direct') = 'direct'` : sql`src.registration_source = ${f.source}`})` : sql``}
    ${f.attendance === "attended" ? sql`and exists (select 1 from public.reg_attendance att where att.student_id = s.id and att.is_attended ${wsId ? sql`and att.workshop_id = ${wsId}` : sql``})` : f.attendance === "not_attended" ? sql`and not exists (select 1 from public.reg_attendance att where att.student_id = s.id and att.is_attended ${wsId ? sql`and att.workshop_id = ${wsId}` : sql``})` : sql``}
    ${f.from ? sql`and s.registered_at >= (${f.from}::date)::timestamp at time zone 'Asia/Colombo'` : sql``}
    ${f.to ? sql`and s.registered_at < ((${f.to}::date + 1))::timestamp at time zone 'Asia/Colombo'` : sql``}
    ${f.extraVal ? (f.extraKey ? sql`and coalesce(s.extra_fields ->> ${f.extraKey}, '') ilike ${like(f.extraVal)}` : sql`and s.extra_fields::text ilike ${like(f.extraVal)}`) : f.extraKey ? sql`and coalesce(s.extra_fields ->> ${f.extraKey}, '') <> ''` : sql``}`;
}

export type StudentRow = {
  id: number; student_id: string; student_name: string; student_email: string; student_phone: string | null; extra_fields: Record<string, string>; registered_at: string;
  batch_id: number | null; batch_name: string | null;
  enrollments: { workshop_id: number; title: string; certificate_code: string | null; email_sent_status: boolean; registration_source: string; is_attended: boolean; enrolled_at: string }[];
};

export async function listStudents(f: StudentFilters, page: number, per: number): Promise<{ rows: StudentRow[]; total: number }> {
  const where = studentWhere(f);
  const [rows, [{ count }]] = await Promise.all([
    sql<StudentRow[]>`select s.id, s.student_id, s.student_name, s.student_email, s.student_phone, s.extra_fields, s.registered_at::text, s.batch_id, b.batch_name,
        coalesce((select json_agg(json_build_object('workshop_id', e.workshop_id, 'title', w.title, 'certificate_code', e.certificate_code, 'email_sent_status', e.email_sent_status,
            'registration_source', coalesce(nullif(e.registration_source, ''), 'direct'), 'is_attended', coalesce(a.is_attended, false), 'enrolled_at', e.enrolled_at::text) order by e.enrolled_at desc)
          from public.reg_enrollments e join public.reg_workshops w on w.id = e.workshop_id
          left join public.reg_attendance a on a.student_id = e.student_id and a.workshop_id = e.workshop_id where e.student_id = s.id), '[]'::json) as enrollments
      from public.reg_students s left join public.reg_batches b on b.id = s.batch_id ${where}
      order by s.registered_at desc limit ${per} offset ${(page - 1) * per}`,
    sql<{ count: number }[]>`select count(*)::int from public.reg_students s ${where}`,
  ]);
  return { rows: rows.map((r) => ({ ...r })), total: count };
}

/** Extra-field keys present in the data (for the filter dropdown). */
export async function availableExtraKeys(): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`select distinct k as key from public.reg_students s, jsonb_object_keys(s.extra_fields) k order by 1 limit 200`;
  return rows.map((r) => r.key);
}
