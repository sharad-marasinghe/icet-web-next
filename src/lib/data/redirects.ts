import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { TAGS } from "@/lib/cache";

export async function lookupRedirect(path: string): Promise<{ to_path: string; status_code: number } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.redirects);
  const rows = await sql<{ to_path: string; status_code: number }[]>`select to_path, status_code from public.redirects where is_active and (from_path = ${path} or from_path = ${path + "/"}) limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}
