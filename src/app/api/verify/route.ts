import { NextResponse, type NextRequest } from "next/server";
import { verifyCertificate } from "@/lib/registry/service";
import { rateLimit, clientIp, sha256 } from "@/lib/security";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("code") || "";
  if (!(await rateLimit(`verify:${sha256(clientIp(req.headers))}`, 60, 600))) {
    return NextResponse.json({ valid: false, message: "Too many lookups. Please wait a few minutes." }, { status: 429 });
  }
  const r = await verifyCertificate(code);
  return NextResponse.json(r, { status: r.valid ? 200 : r.is_suspended ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
