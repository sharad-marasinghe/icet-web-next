import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { publicUrl, deleteObjects } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  await assertRole("viewer");
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const folder = sp.get("folder") || "";
  const type = sp.get("type") || "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const per = 40;
  const rows = await sql`
    select id, url, path, folder, filename, title, alt, mime_type, size_bytes, width, height, created_at::text
    from public.media
    where true
      ${q ? sql`and (filename ilike ${"%" + q + "%"} or title ilike ${"%" + q + "%"} or alt ilike ${"%" + q + "%"})` : sql``}
      ${folder ? sql`and folder = ${folder}` : sql``}
      ${type === "image" ? sql`and mime_type like 'image/%'` : type === "file" ? sql`and mime_type not like 'image/%'` : sql``}
    order by created_at desc limit ${per} offset ${(page - 1) * per}`;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from public.media where true ${q ? sql`and (filename ilike ${"%" + q + "%"} or title ilike ${"%" + q + "%"})` : sql``} ${folder ? sql`and folder = ${folder}` : sql``}`;
  const folders = await sql<{ folder: string; n: number }[]>`select folder, count(*)::int as n from public.media group by folder order by folder`;
  return NextResponse.json({ items: rows.map((r) => ({ ...r })), total: count, page, pages: Math.max(1, Math.ceil(count / per)), folders: folders.map((f) => ({ ...f })) });
}

const schema = z.object({
  path: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mime_type: z.string().max(100).default(""),
  size_bytes: z.number().int().nonnegative().default(0),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  folder: z.string().max(120).default(""),
  title: z.string().max(255).default(""),
  alt: z.string().max(500).default(""),
});

/** Register an object the browser already uploaded to the `media` bucket. */
export async function POST(req: NextRequest) {
  const user = await assertRole("editor");
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const d = body.data;
  const url = publicUrl("media", d.path);
  const rows = await sql`insert into public.media (bucket, path, url, folder, filename, title, alt, mime_type, size_bytes, width, height, uploaded_by)
    values ('media', ${d.path}, ${url}, ${d.folder}, ${d.filename}, ${d.title || d.filename}, ${d.alt}, ${d.mime_type}, ${d.size_bytes}, ${d.width ?? null}, ${d.height ?? null}, ${user.id})
    on conflict (bucket, path) do update set size_bytes = excluded.size_bytes, mime_type = excluded.mime_type, width = excluded.width, height = excluded.height
    returning id, url, path, filename, title, alt, mime_type, size_bytes, width, height, folder, created_at::text`;
  return NextResponse.json({ item: { ...rows[0] } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await assertRole("editor");
  const { id, title, alt, folder } = (await req.json()) as { id: string; title?: string; alt?: string; folder?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sql`update public.media set title = coalesce(${title ?? null}, title), alt = coalesce(${alt ?? null}, alt), folder = coalesce(${folder ?? null}, folder) where id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await assertRole("admin");
  const { id } = (await req.json()) as { id: string };
  const rows = await sql<{ path: string }[]>`delete from public.media where id = ${id} returning path`;
  if (rows[0]) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    try { await deleteObjects("media", [rows[0].path], data.session?.access_token); } catch { /* object may already be gone */ }
  }
  return NextResponse.json({ ok: true });
}
