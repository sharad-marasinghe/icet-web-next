import { NextResponse, type NextRequest } from "next/server";
import { assertRole } from "@/lib/auth";
import { buildCertificatePdf } from "@/lib/registry/pdf";
import { parseMapping } from "@/app/admin/(dashboard)/registry/_shared";
import { SAMPLE_CERT_VALUES } from "@/components/admin/registry/shared";

export const maxDuration = 60;

/** Render a sample certificate PDF from an (unsaved) template + mapping. */
export async function POST(req: NextRequest) {
  try {
    await assertRole("editor");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { template_url?: unknown; mapping?: unknown; values?: Record<string, unknown> };
  const template = typeof body.template_url === "string" && /^https?:\/\//i.test(body.template_url) ? body.template_url : null;
  const mapping = parseMapping(body.mapping);
  const values = { ...SAMPLE_CERT_VALUES };
  for (const k of Object.keys(values) as (keyof typeof values)[]) {
    const v = body.values?.[k];
    if (typeof v === "string" && v.trim()) values[k] = v.replace(/<[^>]*>/g, "").slice(0, 200);
  }
  try {
    const pdf = await buildCertificatePdf(template, mapping, values);
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="certificate-preview.pdf"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not render PDF" }, { status: 500 });
  }
}
