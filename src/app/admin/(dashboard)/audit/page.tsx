import type { Metadata } from "next";
import { connection } from "next/server";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, DataTable, Pagination, AInput, ASelect, EmptyState, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { MetaViewer } from "@/components/admin/system/meta-viewer";

export const metadata: Metadata = { title: "Activity log" };
const PER = 25;

type Row = { id: number; user_id: string | null; user_email: string | null; action: string; entity: string; entity_id: string | null; meta: unknown; created_at: string };
const ACTION_TONE: Record<string, string> = { create: "green", update: "brand", delete: "rose", reset: "amber", import: "brand", set_password: "amber", activate: "green", deactivate: "slate", bulk_status: "brand", status: "brand", assign: "brand", note: "slate" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await requireUser("admin");
  const sp = await searchParams;
  const f = { user: str(sp.user), entity: str(sp.entity), action: str(sp.action), from: isDate(str(sp.from)) ? str(sp.from) : "", to: isDate(str(sp.to)) ? str(sp.to) : "", q: str(sp.q) };
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sql`where true
    ${f.user ? sql`and user_email = ${f.user}` : sql``}
    ${f.entity ? sql`and entity = ${f.entity}` : sql``}
    ${f.action ? sql`and action = ${f.action}` : sql``}
    ${f.from ? sql`and created_at >= ${f.from}::date` : sql``}
    ${f.to ? sql`and created_at < (${f.to}::date + interval '1 day')` : sql``}
    ${f.q ? sql`and (entity_id ilike ${"%" + f.q + "%"} or meta::text ilike ${"%" + f.q + "%"})` : sql``}`;
  const [rows, [{ count }], users, entities, actions] = await Promise.all([
    sql<Row[]>`select id, user_id, user_email, action, entity, entity_id, meta, created_at::text from public.audit_log ${where} order by created_at desc, id desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.audit_log ${where}`,
    sql<{ user_email: string }[]>`select distinct user_email from public.audit_log where user_email is not null order by 1`,
    sql<{ entity: string }[]>`select distinct entity from public.audit_log order by 1`,
    sql<{ action: string }[]>`select distinct action from public.audit_log order by 1`,
  ]);
  const pages = Math.max(1, Math.ceil(count / PER));
  const qs = (() => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) u.set(k, v); u.set("page", "__PAGE__"); return `/admin/audit?${u}`; })();
  const filtered = Object.values(f).some(Boolean);

  return (
    <>
      <PageHeader title="Activity log" description="Every change made through the admin, newest first." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Activity log" }]} />
      <Panel padded={false}>
        <form className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-6">
          <ASelect name="user" defaultValue={f.user} aria-label="User"><option value="">All users</option>{users.map((u) => <option key={u.user_email} value={u.user_email}>{u.user_email}</option>)}</ASelect>
          <ASelect name="entity" defaultValue={f.entity} aria-label="Entity"><option value="">All entities</option>{entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity.replace(/_/g, " ")}</option>)}</ASelect>
          <ASelect name="action" defaultValue={f.action} aria-label="Action"><option value="">All actions</option>{actions.map((a) => <option key={a.action} value={a.action}>{a.action.replace(/_/g, " ")}</option>)}</ASelect>
          <AInput type="date" name="from" defaultValue={f.from} aria-label="From date" />
          <AInput type="date" name="to" defaultValue={f.to} aria-label="To date" />
          <div className="flex gap-2">
            <AInput name="q" defaultValue={f.q} placeholder="Entity ID or detail…" aria-label="Search" />
            <Button type="submit" size="sm" className="h-10 shrink-0">Filter</Button>
            {filtered && <Button href="/admin/audit" variant="ghost" size="sm" className="h-10 shrink-0">Clear</Button>}
          </div>
        </form>
        <div className="p-4">
          <p className="mb-3 text-xs text-slate-500">{count.toLocaleString()} entr{count === 1 ? "y" : "ies"}</p>
          <DataTable
            rows={rows}
            dense
            empty={<EmptyState icon={<ScrollText className="h-7 w-7" />} title="No activity matches" description={filtered ? "Try widening the filters." : "Changes made in the admin will be recorded here."} />}
            columns={[
              { key: "created_at", header: "When", className: "whitespace-nowrap", render: (r) => <span className="text-slate-600">{formatDateTime(r.created_at)}</span> },
              { key: "user_email", header: "User", render: (r) => <span className="font-medium text-slate-900">{r.user_email || <span className="text-slate-400">system</span>}</span> },
              { key: "action", header: "Action", render: (r) => <StatusBadge value={r.action} map={ACTION_TONE} /> },
              { key: "entity", header: "Entity", render: (r) => <span className="text-slate-700">{r.entity.replace(/_/g, " ")}{r.entity_id && <span className="ml-1.5 font-mono text-[11px] text-slate-400">{r.entity_id.length > 14 ? r.entity_id.slice(0, 8) + "…" : r.entity_id}</span>}</span> },
              { key: "meta", header: "Details", hideBelow: "md", render: (r) => <MetaViewer value={r.meta} /> },
            ]}
          />
          <Pagination page={page} pages={pages} baseHref={qs} />
        </div>
      </Panel>
    </>
  );
}
