import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Eye } from "lucide-react";
import { sql } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { AlbumForm, type AlbumRecord } from "../album-form";
import type { GalleryImageRow } from "../actions";
import { ImageManager } from "./image-manager";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditAlbum({ params }: PageProps<"/admin/gallery/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[album], images] = await Promise.all([
    sql<AlbumRecord[]>`select id, slug, title, description, cover_url, event_date::text, is_active, sort_order from public.gallery_albums where id = ${id}`,
    sql<GalleryImageRow[]>`select id, album_id, url, alt, caption, width, height, sort_order from public.gallery_images where album_id = ${id} order by sort_order asc, created_at asc`,
  ]);
  if (!album) notFound();
  return (
    <>
      <PageHeader title={album.title} breadcrumbs={[{ label: "Gallery", href: "/admin/gallery" }, { label: album.title }]} description={`${images.length} image${images.length === 1 ? "" : "s"} · /student-life/gallery/${album.slug}`} actions={album.is_active ? <Button href={`/student-life/gallery/${album.slug}`} external variant="outline" size="sm"><Eye className="h-4 w-4" /> View album</Button> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title="Album details" className="self-start"><AlbumForm album={{ ...album }} /></Panel>
        <Panel title="Images" description="Drop files to upload. Drag to reorder; the order is saved automatically.">
          <ImageManager album={{ id: album.id, slug: album.slug, title: album.title, cover_url: album.cover_url }} images={images.map((i) => ({ ...i }))} />
        </Panel>
      </div>
    </>
  );
}
