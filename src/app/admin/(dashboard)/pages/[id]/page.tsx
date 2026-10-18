import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import type { PageRecord } from "@/lib/blocks/types";
import { PageEditor } from "./page-editor";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[page], faqGroups] = await Promise.all([
    sql<PageRecord[]>`select id, slug, title, template, blocks, seo, status::text, show_in_search, published_at::text, updated_at::text from public.pages where id = ${id}`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
  ]);
  if (!page) notFound();
  return <PageEditor page={{ ...page, blocks: Array.isArray(page.blocks) ? page.blocks : [], seo: page.seo || {} }} faqGroups={faqGroups.map((g) => ({ ...g }))} />;
}
