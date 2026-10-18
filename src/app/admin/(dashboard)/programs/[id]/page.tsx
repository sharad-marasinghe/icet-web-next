import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import type { Program } from "@/lib/data/content";
import { ProgramForm } from "../program-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditProgram({ params }: PageProps<"/admin/programs/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[program], faqGroups] = await Promise.all([
    sql<Program[]>`select id, code, slug, name, qualification, tagline, summary, level_label, duration, training, mode, logo_url, hero_image, brochure_url, fee_from::float, accent, content, seo, sort_order, is_active from public.programs where id = ${id}`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
  ]);
  if (!program) notFound();
  return <ProgramForm program={{ ...program, content: program.content || {}, seo: program.seo || {} }} faqGroups={faqGroups.map((g) => ({ ...g }))} />;
}
