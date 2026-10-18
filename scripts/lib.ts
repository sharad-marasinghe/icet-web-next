/* Shared helpers for seed scripts (run with tsx, outside Next.js). */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

export const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 4, transform: { undefined: null } });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function getToken(): Promise<string> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.STORAGE_USER!;
  const password = process.env.STORAGE_PASSWORD!;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error("Could not sign in storage account: " + (await res.text()));
  return ((await res.json()) as { access_token: string }).access_token;
}

export function publicUrl(bucket: string, p: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${p.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadFile(token: string, bucket: string, p: string, body: Buffer, contentType: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${p.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || ANON, Authorization: `Bearer ${token}`, "Content-Type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`upload ${p} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return publicUrl(bucket, p);
}

export const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", gif: "image/gif", pdf: "application/pdf", jpe: "image/jpeg" };

export function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/data", rel), "utf8")) as T;
}

export function slugify(input: string) {
  return input.toString().normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

export function bid(prefix = "b") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Image size via header sniffing (png/jpeg/webp) without extra deps. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + len;
      }
    }
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") { const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24]; return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
      if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch { /* ignore */ }
  return null;
}

/** True when a "downloaded image" is really an HTML error page (404s are often served with status 200 or saved by curl -o). */
export function looksLikeHtml(buf: Buffer) {
  const head = buf.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || (head.startsWith("<") && head.includes("<head"));
}
