import { NextResponse } from "next/server";
import { formToken } from "@/lib/security";

export async function GET() {
  return NextResponse.json({ token: formToken() }, { headers: { "Cache-Control": "no-store" } });
}
