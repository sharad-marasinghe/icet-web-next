import { NextResponse, type NextRequest } from "next/server";
import { assertRole } from "@/lib/auth";
import { readApplicationFile } from "@/lib/registry/service";

/** Stream a privately stored application document to staff. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  try {
    await assertRole("viewer");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const { fileId } = await ctx.params;
  const id = parseInt(fileId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  try {
    const f = await readApplicationFile(id);
    if (!f) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const safeName = f.filename.replace(/[^\w.\- ()]/g, "_");
    return new NextResponse(new Uint8Array(f.buffer), {
      headers: { "Content-Type": f.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Download failed" }, { status: 500 });
  }
}
