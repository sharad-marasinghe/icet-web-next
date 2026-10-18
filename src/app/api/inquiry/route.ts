import { NextResponse, type NextRequest } from "next/server";
import { createInquiry, type InquiryInput } from "@/lib/inquiries";
import { verifyFormToken, rateLimit, clientIp, sha256 } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!verifyFormToken(req.headers.get("x-icet-form-token"))) return NextResponse.json({ success: false, message: "Security token expired. Please refresh the page." }, { status: 403 });
  const ip = clientIp(req.headers);
  if (!(await rateLimit(`inq:${sha256(ip)}`, 10, 3600))) return NextResponse.json({ success: false, message: "Too many submissions. Please try again later." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 }); }
  if (String(body.website || "").trim()) return NextResponse.json({ success: true }); // honeypot
  const type = (["apply", "contact", "callback", "brochure"].includes(String(body.type)) ? body.type : "contact") as InquiryInput["type"];
  const r = await createInquiry({
    type, name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), whatsapp: String(body.whatsapp || ""),
    program_code: String(body.program_code || ""), intake: String(body.intake || ""), message: String(body.message || ""),
    data: (body.data as Record<string, unknown>) || {}, utm: (body.utm as Record<string, string>) || {}, page_path: String(body.page_path || ""), ip,
  });
  if (!r.ok) return NextResponse.json({ success: false, message: r.error }, { status: 400 });
  return NextResponse.json({ success: true, id: r.id }, { status: 201 });
}
