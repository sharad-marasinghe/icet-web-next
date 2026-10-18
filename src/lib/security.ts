import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { sql } from "@/lib/db";

const secret = () => process.env.APP_SECRET || "dev-secret-change-me";

/** Stateless anti-CSRF / anti-bot token for public forms (12h buckets, previous bucket accepted). */
export function formToken(bucketOffset = 0) {
  const bucket = Math.ceil(Date.now() / (12 * 3600 * 1000)) + bucketOffset;
  return createHmac("sha256", secret()).update(`icet-public-form-${bucket}`).digest("hex");
}
export function verifyFormToken(token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(token);
  for (const off of [0, -1]) {
    const b = Buffer.from(formToken(off));
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function verifySignature(value: string, sig: string) {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashIp(ip: string) {
  return createHash("sha256").update(ip + secret()).digest("hex").slice(0, 32);
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Sliding fixed-window rate limiter backed by the rate_limits table.
 * Returns true when the caller is within budget.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (limit <= 0) return true;
  const rows = await sql<{ count: number }[]>`
    insert into public.rate_limits (key, count, expires_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when public.rate_limits.expires_at < now() then 1 else public.rate_limits.count + 1 end,
      expires_at = case when public.rate_limits.expires_at < now() then now() + make_interval(secs => ${windowSeconds}) else public.rate_limits.expires_at end
    returning count`;
  return (rows[0]?.count ?? 0) <= limit;
}

export function clientIp(headers: Headers) {
  return (headers.get("x-forwarded-for") || "").split(",")[0].trim() || headers.get("x-real-ip") || "0.0.0.0";
}
