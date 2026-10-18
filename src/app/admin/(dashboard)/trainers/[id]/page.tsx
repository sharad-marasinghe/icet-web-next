import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import type { Trainer } from "@/lib/data/content";
import { TrainerForm } from "../trainer-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditTrainer({ params }: PageProps<"/admin/trainers/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [trainer] = await sql<(Trainer & { is_active: boolean })[]>`select id, slug, name, title, qualifications, bio, email, photo_url, linkedin_url, is_featured, is_active, sort_order from public.trainers where id = ${id}`;
  if (!trainer) notFound();
  return <TrainerForm trainer={{ ...trainer }} />;
}
