import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { VideoForm, type VideoRecord } from "../video-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditVideo({ params }: PageProps<"/admin/videos/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[item], cols] = await Promise.all([
    sql<VideoRecord[]>`select id, title, youtube_id, thumbnail_url, collection, sort_order, is_active from public.videos where id = ${id}`,
    sql<{ collection: string }[]>`select distinct collection from public.videos order by collection`,
  ]);
  if (!item) notFound();
  return <VideoForm item={{ ...item }} collections={cols.map((c) => c.collection)} />;
}
