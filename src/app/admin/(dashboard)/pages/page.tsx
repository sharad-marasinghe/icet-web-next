import { FileText, Plus, Search as SearchIcon } from "lucide-react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, DataTable, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deletePage, duplicatePage } from "./actions";

type Row = { id: string; title: string; slug: string; status: string; show_in_search: boolean; updated_at: string; blocks_count: number };

const livePath = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function PagesList({ searchParams }: PageProps<"/admin/pages">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (title ilike ${"%" + q + "%"} or slug ilike ${"%" + q + "%"})` : sql``} ${status ? sql`and status = ${status}::public.publish_status` : sql``}`;
  const [rows, [{ count }], counts] = await Promise.all([
    sql<Row[]>`select id, title, slug, status::text, show_in_search, updated_at::text, jsonb_array_length(blocks) as blocks_count from public.pages ${where} order by updated_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.pages ${where}`,
    sql<{ status: string; n: number }[]>`select status::text, count(*)::int as n from public.pages group by status`,
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const total = counts.reduce((a, c) => a + c.n, 0);
  const tabs = [
    { label: "All", href: `/admin/pages${qs({ q })}`, active: !status, count: total },
    { label: "Published", href: `/admin/pages${qs({ q, status: "published" })}`, active: status === "published", count: n("published") },
    { label: "Drafts", href: `/admin/pages${qs({ q, status: "draft" })}`, active: status === "draft", count: n("draft") },
    { label: "Archived", href: `/admin/pages${qs({ q, status: "archived" })}`, active: status === "archived", count: n("archived") },
  ];
  return (
    <>
      <PageHeader title="Pages" description="Block-based pages of the public website. The home page uses the slug “home”." actions={<Button href="/admin/pages/new" size="sm"><Plus className="h-4 w-4" /> New page</Button>} />
      <Panel padded>
        <ListToolbar q={q} placeholder="Search title or slug…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/pages/${r.id}`}
          empty={<EmptyState icon={<FileText className="h-6 w-6" />} title={q || status ? "No pages match" : "No pages yet"} description={q || status ? "Try a different search or filter." : "Create your first page to start building the site."} action={!q && !status ? <Button href="/admin/pages/new" size="sm"><Plus className="h-4 w-4" /> New page</Button> : undefined} />}
          columns={[
            { key: "title", header: "Title", render: (r) => <><span className="font-semibold text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{r.blocks_count} block{r.blocks_count === 1 ? "" : "s"}</span></> },
            { key: "slug", header: "Slug", hideBelow: "md", render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{livePath(r.slug)}</code> },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            { key: "show_in_search", header: "Search", hideBelow: "lg", className: "text-center", render: (r) => <span title={r.show_in_search ? "Listed in sitemap & site search" : "Hidden from sitemap & site search"} className={r.show_in_search ? "text-green-600" : "text-slate-300"}><SearchIcon className="mx-auto h-4 w-4" /></span> },
            { key: "updated_at", header: "Updated", hideBelow: "sm", render: (r) => <span className="text-slate-500">{formatDateTime(r.updated_at)}</span> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-36", render: (r) => <RowActions id={r.id} editHref={`/admin/pages/${r.id}`} viewHref={r.status === "published" ? livePath(r.slug) : undefined} onDuplicate={duplicatePage} onDelete={deletePage} editBase="/admin/pages" deleteMessage={`Delete “${r.title}”? Visitors will see a 404 at ${livePath(r.slug)}.`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/pages${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
