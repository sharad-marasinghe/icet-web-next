import Image from "next/image";
import { connection } from "next/server";
import { Image as ImageIcon, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageHeader, Panel, Pagination, StatusBadge, EmptyState } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { ListToolbar, qs } from "@/components/admin/content/list-toolbar";
import { RowActions } from "@/components/admin/content/row-actions";
import { clampPage, firstParam, PER_PAGE } from "@/components/admin/content/form-utils";
import { deleteAlbum } from "./actions";

type Row = { id: string; slug: string; title: string; cover_url: string | null; event_date: string | null; is_active: boolean; sort_order: number; image_count: number };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function GalleryPage({ searchParams }: PageProps<"/admin/gallery">) {
  await connection();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const status = firstParam(sp.status);
  const page = clampPage(sp.page);
  const where = sql`where true ${q ? sql`and (a.title ilike ${"%" + q + "%"} or a.slug ilike ${"%" + q + "%"})` : sql``} ${status === "active" ? sql`and a.is_active` : status === "inactive" ? sql`and not a.is_active` : sql``}`;
  const [rows, [{ count }]] = await Promise.all([
    sql<Row[]>`select a.id, a.slug, a.title, coalesce(a.cover_url, (select url from public.gallery_images i where i.album_id = a.id order by sort_order limit 1)) as cover_url, a.event_date::text, a.is_active, a.sort_order,
        (select count(*) from public.gallery_images i where i.album_id = a.id)::int as image_count
      from public.gallery_albums a ${where} order by a.sort_order asc, a.event_date desc nulls last, a.title limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ count: number }[]>`select count(*)::int from public.gallery_albums a ${where}`,
  ]);
  const tabs = [
    { label: "All", href: `/admin/gallery${qs({ q })}`, active: !status },
    { label: "Active", href: `/admin/gallery${qs({ q, status: "active" })}`, active: status === "active" },
    { label: "Inactive", href: `/admin/gallery${qs({ q, status: "inactive" })}`, active: status === "inactive" },
  ];
  return (
    <>
      <PageHeader title="Gallery" description="Photo albums shown under Student Life and in gallery blocks." actions={<Button href="/admin/gallery/new" size="sm"><Plus className="h-4 w-4" /> New album</Button>} />
      <Panel>
        <ListToolbar q={q} placeholder="Search albums…" tabs={tabs} hidden={{ status }} />
        <DataTable<Row>
          rows={rows}
          onRowHref={(r) => `/admin/gallery/${r.id}`}
          empty={<EmptyState icon={<ImageIcon className="h-6 w-6" />} title={q || status ? "No albums match" : "No albums yet"} description="Create an album, then drag photos into it." action={!q && !status ? <Button href="/admin/gallery/new" size="sm"><Plus className="h-4 w-4" /> New album</Button> : undefined} />}
          columns={[
            { key: "title", header: "Album", render: (r) => (
              <span className="flex items-center gap-3">
                <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">{r.cover_url ? <Image src={r.cover_url} alt="" fill sizes="64px" className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />}</span>
                <span><span className="block font-semibold text-slate-900">{r.title}</span><span className="block font-mono text-xs text-slate-500">{r.slug}</span></span>
              </span>
            ) },
            { key: "image_count", header: "Images", className: "text-center", render: (r) => <span className="font-semibold text-slate-800">{r.image_count}</span> },
            { key: "event_date", header: "Event date", hideBelow: "md", render: (r) => <span className="text-slate-600">{r.event_date ? formatDate(r.event_date) : "—"}</span> },
            { key: "sort_order", header: "Order", hideBelow: "lg", className: "text-center", render: (r) => <span className="text-slate-500">{r.sort_order}</span> },
            { key: "is_active", header: "Status", render: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
            { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-28", render: (r) => <RowActions id={r.id} editHref={`/admin/gallery/${r.id}`} viewHref={r.is_active ? `/student-life/gallery/${r.slug}` : undefined} onDelete={deleteAlbum} deleteMessage={`Delete album “${r.title}” and its ${r.image_count} image${r.image_count === 1 ? "" : "s"}? Files stay in the media library.`} /> },
          ]}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil(count / PER_PAGE))} baseHref={`/admin/gallery${qs({ q, status, page: "__PAGE__" })}`} />
      </Panel>
    </>
  );
}
