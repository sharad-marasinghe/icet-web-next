"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import type { ActionState } from "@/components/admin/ui";

const fromPath = z.string().trim().min(2, "Enter the old path").max(500).regex(/^\/[^\s]*$/, "Must start with / and contain no spaces").refine((v) => !v.startsWith("/admin"), "Admin paths cannot be redirected");
const toPath = z.string().trim().min(1, "Enter the destination").max(1000).regex(/^(\/[^\s]*|https?:\/\/[^\s]+)$/, "Must be a path starting with / or an absolute URL");
const status = z.coerce.number().refine((v) => v === 301 || v === 302, "Status must be 301 or 302");

const normalise = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

const addSchema = z.object({ from_path: fromPath, to_path: toPath, status_code: status, is_active: z.boolean() });

function fieldErrors(issues: z.ZodError["issues"]) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.join(".")] = i.message;
  return errors;
}

export async function addRedirect(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const parsed = addSchema.safeParse({ from_path: fd.get("from_path"), to_path: fd.get("to_path"), status_code: fd.get("status_code") || 301, is_active: fd.get("is_active") !== "off" });
  if (!parsed.success) return { ok: false, message: "Please check the redirect.", errors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const from = normalise(d.from_path);
  const to = d.to_path.startsWith("/") ? normalise(d.to_path) : d.to_path;
  if (from === to) return { ok: false, message: "A redirect cannot point to itself.", errors: { to_path: "Destination equals the source" } };
  const exists = await sql`select 1 from public.redirects where from_path = ${from}`;
  if (exists.length) return { ok: false, message: "A redirect for that path already exists.", errors: { from_path: "Already redirected" } };
  const [row] = await sql<{ id: number }[]>`insert into public.redirects (from_path, to_path, status_code, is_active) values (${from}, ${to}, ${d.status_code}, ${d.is_active}) returning id`;
  bust(TAGS.redirects);
  await audit(user, "create", "redirect", row.id, { from, to, status: d.status_code });
  return { ok: true, message: `Redirect ${from} → ${to} added.`, id: row.id };
}

export async function updateRedirect(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Invalid redirect." };
  const parsed = addSchema.safeParse({ from_path: fd.get("from_path"), to_path: fd.get("to_path"), status_code: fd.get("status_code") || 301, is_active: fd.get("is_active") !== "off" });
  if (!parsed.success) return { ok: false, message: "Please check the redirect.", errors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const from = normalise(d.from_path);
  const to = d.to_path.startsWith("/") ? normalise(d.to_path) : d.to_path;
  if (from === to) return { ok: false, message: "A redirect cannot point to itself.", errors: { to_path: "Destination equals the source" } };
  const clash = await sql`select 1 from public.redirects where from_path = ${from} and id <> ${id}`;
  if (clash.length) return { ok: false, message: "Another redirect already uses that path.", errors: { from_path: "Already redirected" } };
  const rows = await sql`update public.redirects set from_path = ${from}, to_path = ${to}, status_code = ${d.status_code}, is_active = ${d.is_active} where id = ${id} returning id`;
  if (!rows.length) return { ok: false, message: "Redirect not found." };
  bust(TAGS.redirects);
  await audit(user, "update", "redirect", id, { from, to, status: d.status_code, is_active: d.is_active });
  return { ok: true, message: "Redirect updated." };
}

export async function toggleRedirect(id: number, active: boolean): Promise<ActionState> {
  const user = await assertRole("admin");
  if (!Number.isInteger(id)) return { ok: false, message: "Invalid redirect." };
  const rows = await sql<{ from_path: string }[]>`update public.redirects set is_active = ${active} where id = ${id} returning from_path`;
  if (!rows.length) return { ok: false, message: "Redirect not found." };
  bust(TAGS.redirects);
  await audit(user, active ? "activate" : "deactivate", "redirect", id, { from: rows[0].from_path });
  return { ok: true, message: active ? "Redirect enabled." : "Redirect disabled." };
}

export async function deleteRedirect(id: number): Promise<ActionState> {
  const user = await assertRole("admin");
  if (!Number.isInteger(id)) return { ok: false, message: "Invalid redirect." };
  const rows = await sql<{ from_path: string; to_path: string }[]>`delete from public.redirects where id = ${id} returning from_path, to_path`;
  if (!rows.length) return { ok: false, message: "Redirect not found." };
  bust(TAGS.redirects);
  await audit(user, "delete", "redirect", id, { ...rows[0] });
  return { ok: true, message: "Redirect deleted." };
}

export async function importRedirects(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const text = String(fd.get("lines") || "");
  const overwrite = fd.get("overwrite") === "on";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (!lines.length) return { ok: false, message: "Paste at least one line in the form from,to[,301|302]." };
  if (lines.length > 500) return { ok: false, message: "Import at most 500 redirects at a time." };
  const rows: { from: string; to: string; status: number }[] = [];
  const problems: string[] = [];
  lines.forEach((line, i) => {
    const parts = line.split(/[,\t]| {2,}/).map((p) => p.trim()).filter(Boolean);
    const [f, t, s] = parts;
    const pf = fromPath.safeParse(f);
    const pt = toPath.safeParse(t);
    const ps = status.safeParse(s || 301);
    if (!pf.success || !pt.success || !ps.success) { problems.push(`Line ${i + 1}: ${pf.success ? pt.success ? "invalid status" : pt.error.issues[0].message : pf.error.issues[0].message}`); return; }
    const from = normalise(pf.data);
    const to = pt.data.startsWith("/") ? normalise(pt.data) : pt.data;
    if (from === to) { problems.push(`Line ${i + 1}: points to itself`); return; }
    rows.push({ from, to, status: ps.data });
  });
  if (problems.length) return { ok: false, message: `${problems.length} line${problems.length > 1 ? "s" : ""} could not be read. Nothing was imported.`, errors: { lines: problems.slice(0, 8).join("\n") } };
  // De-duplicate by source path (last one wins).
  const map = new Map(rows.map((r) => [r.from, r]));
  let inserted = 0, updated = 0, skipped = 0;
  for (const r of map.values()) {
    if (overwrite) {
      const res = await sql<{ inserted: boolean }[]>`insert into public.redirects (from_path, to_path, status_code, is_active) values (${r.from}, ${r.to}, ${r.status}, true)
        on conflict (from_path) do update set to_path = excluded.to_path, status_code = excluded.status_code, is_active = true returning (xmax = 0) as inserted`;
      if (res[0]?.inserted) inserted++; else updated++;
    } else {
      const res = await sql`insert into public.redirects (from_path, to_path, status_code, is_active) values (${r.from}, ${r.to}, ${r.status}, true) on conflict (from_path) do nothing returning id`;
      if (res.length) inserted++; else skipped++;
    }
  }
  bust(TAGS.redirects);
  await audit(user, "import", "redirect", null, { inserted, updated, skipped });
  return { ok: true, message: `Imported ${inserted} new redirect${inserted === 1 ? "" : "s"}${updated ? `, updated ${updated}` : ""}${skipped ? `, skipped ${skipped} existing` : ""}.` };
}
