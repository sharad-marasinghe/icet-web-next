import { sql } from "@/lib/db";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { Category } from "@/components/admin/content/category-manager";
import { PostForm } from "../post-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewPost() {
  await connection();
  const user = await getCurrentUser();
  const [categories, faqGroups, tags] = await Promise.all([
    sql<Category[]>`select id, slug, name from public.post_categories order by name`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
    sql<{ tag: string }[]>`select distinct unnest(tags) as tag from public.posts order by 1 limit 100`,
  ]);
  return <PostForm post={null} categories={categories.map((c) => ({ ...c }))} faqGroups={faqGroups.map((g) => ({ ...g }))} author={{ name: user?.full_name || "", title: "", photo: user?.avatar_url || "" }} tagSuggestions={tags.map((t) => t.tag)} />;
}
