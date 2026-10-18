import { NextResponse, type NextRequest } from "next/server";
import { registerStudent } from "@/lib/registry/service";
import { verifyFormToken, clientIp } from "@/lib/security";

export const maxDuration = 60;

/**
 * Public registration endpoint (workshops + academic batch applications).
 * Accepts multipart/form-data (with files[...]) or JSON.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-icet-form-token");
  if (!verifyFormToken(token)) return NextResponse.json({ success: false, message: "Security token expired. Please refresh the page and try again." }, { status: 403 });

  const fields: Record<string, unknown> = {};
  const files: Record<string, File | undefined> = {};
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data") || ctype.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      for (const [key, value] of fd.entries()) {
        const fileMatch = key.match(/^files\[([a-z0-9_]+)\]$/);
        if (fileMatch) {
          if (value instanceof File) files[fileMatch[1]] = value;
          continue;
        }
        if (value instanceof File) continue;
        const extraMulti = key.match(/^extra\[([a-z0-9_]+)\]\[\]$/);
        const extraSingle = key.match(/^extra\[([a-z0-9_]+)\]$/);
        if (extraMulti) {
          const arr = (fields[extraMulti[1]] as string[] | undefined) || [];
          arr.push(String(value));
          fields[extraMulti[1]] = arr;
        } else if (extraSingle) {
          fields[extraSingle[1]] = String(value);
        } else {
          fields[key] = String(value);
        }
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      Object.assign(fields, body);
      const extra = body.extra_fields;
      if (extra && typeof extra === "object") Object.assign(fields, extra as Record<string, unknown>);
    }
  } catch {
    return NextResponse.json({ success: false, message: "Could not read the submission." }, { status: 400 });
  }

  // Honeypot
  if (String(fields.icet_hp_email_confirm || "").trim()) return NextResponse.json({ success: true, message: "Registration successful!" }, { status: 201 });

  const workshopId = Number(fields.workshop_id) || null;
  const batchId = Number(fields.batch_id) || null;
  const result = await registerStudent({
    workshopId,
    batchId,
    fields,
    files,
    sourceTracking: String(fields.source_tracking) === "true",
    attribution: { source: fields.registration_source as string, medium: fields.registration_medium as string, campaign: fields.registration_campaign as string },
    ip: clientIp(req.headers),
  });
  if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  return NextResponse.json({ success: true, ...result }, { status: 201 });
}
