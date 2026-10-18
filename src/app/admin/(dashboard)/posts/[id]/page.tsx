import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Category } from "@/components/admin/content/category-manager";
import { PostForm, type PostFull } from "../post-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function EditPost({ params }: PageProps<"/admin/posts/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCurrentUser();
  const [[post], categories, faqGroups, tags] = await Promise.all([
    sql<PostFull[]>`select id, slug, title, excerpt, content, cover_image, author_name, author_title, author_photo, category_ids, tags, reading_minutes, status::text, is_featured, published_at::text, seo, updated_at::text from public.posts where id = ${id}`,
    sql<Category[]>`select id, slug, name from public.post_categories order by name`,
    sql<{ value: string; label: string }[]>`select slug as value, title as label from public.faq_groups order by title`,
    sql<{ tag: string }[]>`select distinct unnest(tags) as tag from public.posts order by 1 limit 100`,
  ]);
  if (!post) notFound();
  return <PostForm post={{ ...post, seo: post.seo || {}, tags: post.tags || [], category_ids: post.category_ids || [] }} categories={categories.map((c) => ({ ...c }))} faqGroups={faqGroups.map((g) => ({ ...g }))} author={{ name: user?.full_name || "", title: "", photo: user?.avatar_url || "" }} tagSuggestions={tags.map((t) => t.tag)} />;
}
