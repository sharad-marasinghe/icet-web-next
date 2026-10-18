import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const rows = await sql`select kind, title, url, snippet, image_url from public.site_search(${q}, 12)`;
    return NextResponse.json({ results: rows.map((r) => ({ ...r })) }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ results: [] });
  }
}
