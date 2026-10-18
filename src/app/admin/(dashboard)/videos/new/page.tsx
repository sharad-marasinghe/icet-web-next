import { sql } from "@/lib/db";
import { connection } from "next/server";
import { VideoForm } from "../video-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewVideo() {
  await connection();
  const cols = await sql<{ collection: string }[]>`select distinct collection from public.videos order by collection`;
  return <VideoForm item={null} collections={cols.map((c) => c.collection)} />;
}
