import { NextResponse, type NextRequest } from "next/server";
import { submitFeedback } from "@/lib/feedback";
import { verifyFormToken, rateLimit, clientIp, sha256 } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!verifyFormToken(req.headers.get("x-icet-form-token"))) return NextResponse.json({ success: false, message: "Security token expired. Please refresh the page." }, { status: 403 });
  const ip = clientIp(req.headers);
  if (!(await rateLimit(`fb:${sha256(ip)}`, 20, 3600))) return NextResponse.json({ success: false, message: "Too many submissions." }, { status: 429 });
  let body: { slug?: string; answers?: Record<string, unknown>; website?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 }); }
  if (String(body.website || "").trim()) return NextResponse.json({ success: true, message: "Thank you!" });
  const r = await submitFeedback(String(body.slug || ""), body.answers || {}, { ip, ua: req.headers.get("user-agent") || "" });
  if (!r.ok) return NextResponse.json({ success: false, message: r.error }, { status: 400 });
  return NextResponse.json({ success: true, redirect: r.redirect, message: r.message });
}
