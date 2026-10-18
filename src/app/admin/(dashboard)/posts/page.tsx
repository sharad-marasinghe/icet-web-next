import Image from "next/image";
import { connection } from "next/server";
import { Newspaper, Plus, Star } from "lucide-react";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Panel, DataTable, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deletePost, duplicatePost } from "./actions";

type Row = { id: string; slug: string; title: string; cover_image: string | null; author_name: string; status: string; is_featured: boolean; published_at: string | null; updated_at: string; reading_minutes: number; categories: string[] | null };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (p.title ilike ${"%" + q + "%"} or p.slug ilike ${"%" + q + "%"} or p.author_name ilike ${"%" + q + "%"} or ${q} = any(p.tags))` : sql``} ${status ? sql`and p.status = ${status}::public.publish_status` : sql``}`;
  const [rows, [{ count }], counts] = await Promise.all([
    sql<Row[]>`select p.id, p.slug, p.title, p.cover_image, p.author_name, p.status::text, p.is_featured, p.published_at::text, p.updated_at::text, p.reading_minutes,
        (select array_agg(c.name order by c.name) from public.post_categories c where c.id = any(p.category_ids)) as categories
      from public.posts p ${where} order by coalesce(p.published_at, p.updated_at) desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.posts p ${where}`,
    sql<{ status: string; n: number }[]>`select status::text, count(*)::int as n from public.posts group by status`,
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const tabs = [
    { label: "All", href: `/admin/posts${qs({ q })}`, active: !status, count: counts.reduce((a, c) => a + c.n, 0) },
    { label: "Published", href: `/admin/posts${qs({ q, status: "published" })}`, active: status === "published", count: n("published") },
    { label: "Drafts", href: `/admin/posts${qs({ q, status: "draft" })}`, active: status === "draft", count: n("draft") },
    { label: "Archived", href: `/admin/posts${qs({ q, status: "archived" })}`, active: status === "archived", count: n("archived") },
  ];
  return (
    <>
      <PageHeader title="Blog posts" description="Articles and insights published under /blogs." actions={<Button href="/admin/posts/new" size="sm"><Plus className="h-4 w-4" /> New post</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search title, author or tag…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/posts/${r.id}`}
          empty={<EmptyState icon={<Newspaper className="h-6 w-6" />} title={q || status ? "No posts match" : "No posts yet"} description="Write the first article for the iCET blog." action={!q && !status ? <Button href="/admin/posts/new" size="sm"><Plus className="h-4 w-4" /> New post</Button> : undefined} />}
          columns={[
            { key: "title", header: "Post", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">{r.cover_image ? <Image src={r.cover_image} alt="" fill sizes="64px" className="object-cover" /> : <Newspaper className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />}</span>
                <span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold text-slate-900">{r.title}{r.is_featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Featured" />}</span><span className="block truncate text-xs text-slate-500">{r.categories?.join(", ") || "Uncategorised"} · {r.reading_minutes} min read</span></span>
              </span>
            ) },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            { key: "published_at", header: "Published", hideBelow: "md", render: (r) => <span className="text-slate-600">{r.published_at ? formatDateTime(r.published_at) : <span className="text-slate-400">—</span>}</span> },
            { key: "author_name", header: "Author", hideBelow: "lg", render: (r) => <span className="text-slate-600">{r.author_name || "—"}</span> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-36", render: (r) => <RowActions id={r.id} editHref={`/admin/posts/${r.id}`} viewHref={r.status === "published" ? `/blogs/${r.slug}` : undefined} onDuplicate={duplicatePost} onDelete={deletePost} editBase="/admin/posts" deleteMessage={`Delete post “${r.title}”?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/posts${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
