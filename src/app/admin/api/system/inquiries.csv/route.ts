import { type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { toCsv } from "@/lib/utils";
import { parseInquiryFilters, inquiryWhere } from "@/components/admin/inquiries/query";

type Row = {
  id: string; type: string; name: string; email: string; phone: string; whatsapp: string; program_code: string | null; intake: string | null; message: string;
  data: Record<string, unknown>; utm: Record<string, string>; page_path: string | null; status: string; assigned_name: string | null; notes: string; created_at: string; updated_at: string;
};

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await assertRole("editor");
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Forbidden", { status: 403 });
  }
  const f = parseInquiryFilters(req.nextUrl.searchParams);
  const rows = await sql<Row[]>`select i.id, i.type, i.name, i.email, i.phone, i.whatsapp, i.program_code, i.intake, i.message, i.data, i.utm, i.page_path, i.status, p.full_name as assigned_name, i.notes,
      to_char(i.created_at at time zone 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') as created_at, to_char(i.updated_at at time zone 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') as updated_at
    from public.inquiries i left join public.profiles p on p.id = i.assigned_to ${inquiryWhere(f, user.id)} order by i.created_at desc limit 20000`;
  const dataKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.data || {})))).sort();
  const utmKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.utm || {})))).sort();
  const header = ["Received", "Type", "Status", "Name", "Email", "Phone", "WhatsApp", "Programme", "Intake", "Message", ...dataKeys, "Assigned to", "Page", ...utmKeys, "Notes", "Updated", "ID"];
  const body = rows.map((r) => [
    r.created_at, r.type, r.status, r.name, r.email, r.phone, r.whatsapp, r.program_code ?? "", r.intake ?? "", r.message,
    ...dataKeys.map((k) => { const v = (r.data || {})[k]; return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); }),
    r.assigned_name ?? "", r.page_path ?? "", ...utmKeys.map((k) => (r.utm || {})[k] ?? ""), r.notes, r.updated_at, r.id,
  ]);
  const csv = "﻿" + toCsv([header, ...body]);
  await audit(user, "export", "inquiry", null, { count: rows.length, filters: f });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inquiries-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
