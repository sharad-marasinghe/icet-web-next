import Image from "next/image";
import { connection } from "next/server";
import { PlayCircle, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { PageHeader, Panel, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteVideo } from "./actions";

type Row = { id: string; title: string; youtube_id: string; thumbnail_url: string | null; collection: string; sort_order: number; is_active: boolean };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function VideosPage({ searchParams }: PageProps<"/admin/videos">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (title ilike ${"%" + q + "%"} or youtube_id ilike ${"%" + q + "%"})` : sql``} ${status === "inactive" ? sql`and not is_active` : status ? sql`and collection = ${status}` : sql``}`;
  const [rows, [{ count }], cols] = await Promise.all([
    sql<Row[]>`select id, title, youtube_id, thumbnail_url, collection, sort_order, is_active from public.videos ${where} order by collection asc, sort_order asc, created_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.videos ${where}`,
    sql<{ collection: string; n: number }[]>`select collection, count(*)::int as n from public.videos group by collection order by collection`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/videos${qs({ q })}`, active: !status },
    ...cols.map((c) => ({ label: c.collection.replace(/_/g, " "), href: `/admin/videos${qs({ q, status: c.collection })}`, active: status === c.collection, count: c.n })),
    { label: "Inactive", href: `/admin/videos${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  return (
    <>
      <PageHeader title="Videos" description="YouTube videos grouped into collections (student life, alumni podcast, testimonials…)." actions={<Button href="/admin/videos/new" size="sm"><Plus className="h-4 w-4" /> New video</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search title or video id…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/videos/${r.id}`}
          empty={<EmptyState icon={<PlayCircle className="h-6 w-6" />} title={q || status ? "No videos match" : "No videos yet"} description="Add YouTube videos to show them in video gallery blocks." action={!q && !status ? <Button href="/admin/videos/new" size="sm"><Plus className="h-4 w-4" /> New video</Button> : undefined} />}
          columns={[
            { key: "title", header: "Video", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-11 w-[76px] shrink-0 overflow-hidden rounded-md bg-slate-900"><Image src={r.thumbnail_url || `https://i.ytimg.com/vi/${r.youtube_id}/mqdefault.jpg`} alt="" fill sizes="76px" className="object-cover" unoptimized /><PlayCircle className="absolute inset-0 m-auto h-5 w-5 text-white/90" /></span>
                <span><span className="block font-semibold text-slate-900">{r.title}</span><span className="block font-mono text-[11px] text-slate-500">{r.youtube_id}</span></span>
              </span>
            ) },
            { key: "collection", header: "Collection", render: (r) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">{r.collection.replace(/_/g, " ")}</span> },
            { key: "sort_order", header: "Order", hideBelow: "lg", className: "text-center", render: (r) => <span className="text-slate-500">{r.sort_order}</span> },
            { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-28", render: (r) => <RowActions id={r.id} editHref={`/admin/videos/${r.id}`} viewHref={`https://www.youtube.com/watch?v=${r.youtube_id}`} onDelete={deleteVideo} deleteMessage={`Delete video “${r.title}”?`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/videos${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
