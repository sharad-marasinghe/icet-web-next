import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertRole, audit } from "@/lib/auth";
import { issueCertificate } from "@/lib/registry/service";

export const maxDuration = 120;

const schema = z.object({
  workshop_id: z.coerce.number().int().positive(),
  student_ids: z.array(z.coerce.number().int().positive()).min(1).max(10),
  require_attendance: z.boolean().optional().default(true),
});

/** Issue certificates for a small chunk of students (called repeatedly by the admin UI). */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await assertRole("editor");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload: workshop_id and 1–10 student_ids are required." }, { status: 400 });
  const { workshop_id, student_ids, require_attendance } = parsed.data;
  const results = [];
  for (const sid of student_ids) {
    try {
      const r = await issueCertificate(sid, workshop_id, { requireAttendance: require_attendance, sendEmail: true });
      results.push(r.ok ? { student_id: sid, ok: true, code: r.code, emailed: r.emailed, error: r.error } : { student_id: sid, ok: false, error: r.error });
    } catch (e) {
      results.push({ student_id: sid, ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
    }
  }
  await audit(user, "issue_certificates", "workshop", workshop_id, { count: student_ids.length, ok: results.filter((r) => r.ok).length });
  return NextResponse.json({ results });
}
