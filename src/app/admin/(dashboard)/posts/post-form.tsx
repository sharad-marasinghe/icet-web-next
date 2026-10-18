"use client";

import * as React from "react";
import { useActionState } from "react";
import { Newspaper, Search as SearchIcon, Clock } from "lucide-react";
import type { PostRecord } from "@/lib/data/content";
import type { PageSeo } from "@/lib/blocks/types";
import { AField, AInput, ATextarea, ASelect, Toggle, Tabs, Panel, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { SeoFields, type RefOption } from "@/components/admin/content/seo-fields";
import { SlugField, useSlugSync } from "@/components/admin/content/slug-input";
import { TagsInput } from "@/components/admin/content/tags-input";
import { CategoryChecklist, type Category } from "@/components/admin/content/category-manager";
import { EditorBar, EditorGrid, FieldGroup, useDirty } from "@/components/admin/content/form-bits";
import { readingMinutes, toLocalInput } from "@/components/admin/content/form-utils";
import { deletePostCategory, savePost, savePostCategory } from "./actions";

export type PostFull = PostRecord & { status: "draft" | "published" | "archived" };
export type AuthorDefaults = { name: string; title: string; photo: string };

export function PostForm({ post, categories, faqGroups, author, tagSuggestions }: { post: PostFull | null; categories: Category[]; faqGroups: RefOption[]; author: AuthorDefaults; tagSuggestions: string[] }) {
  const [state, action] = useActionState(savePost, initialActionState);
  const { dirty, touch } = useDirty(state);
  const isNew = !post;
  const s = useSlugSync(post?.title || "", post?.slug || "", isNew);
  const [tab, setTab] = React.useState<"post" | "seo">("post");
  const [content, setContent] = React.useState(post?.content || "");
  const [cover, setCover] = React.useState(post?.cover_image || "");
  const [authorPhoto, setAuthorPhoto] = React.useState(post?.author_photo ?? author.photo);
  const [catIds, setCatIds] = React.useState<number[]>(post?.category_ids || []);
  const [tags, setTags] = React.useState<string[]>(post?.tags || []);
  const [minutes, setMinutes] = React.useState<string>(String(post?.reading_minutes ?? Math.max(1, readingMinutes(post?.content || ""))));
  const [minutesTouched, setMinutesTouched] = React.useState(!!post);
  const [status, setStatus] = React.useState<PostFull["status"]>(post?.status || "draft");
  const [publishedAt, setPublishedAt] = React.useState(toLocalInput(post?.published_at));
  const [featured, setFeatured] = React.useState(post?.is_featured ?? false);
  const [seo, setSeo] = React.useState<PageSeo>(post?.seo || {});
  const err = state?.errors || {};
  const words = content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

  const onContent = (html: string) => {
    setContent(html);
    if (!minutesTouched) setMinutes(String(readingMinutes(html)));
    touch();
  };
  const onStatus = (v: PostFull["status"]) => {
    setStatus(v);
    if (v === "published" && !publishedAt) setPublishedAt(toLocalInput(new Date()));
    touch();
  };

  return (
    <form action={action} onChange={touch}>
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="cover_image" value={cover} />
      <input type="hidden" name="author_photo" value={authorPhoto} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="is_featured" value={featured ? "true" : "false"} />
      <EditorBar backHref="/admin/posts" backLabel="Blog posts" title={isNew ? "New post" : s.title || "Post"} subtitle={post ? <span className="font-mono">/blogs/{s.slug}</span> : undefined} dirty={dirty} state={state} viewHref={post?.status === "published" ? `/blogs/${post.slug}` : null} saveLabel={isNew ? "Create post" : "Save changes"}>
        <ASelect value={status} onChange={(e) => onStatus(e.target.value as PostFull["status"])} className="h-9 w-32 text-xs font-semibold" aria-label="Status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </ASelect>
      </EditorBar>

      <Tabs tabs={[{ id: "post", label: <span className="inline-flex items-center gap-1.5"><Newspaper className="h-4 w-4" /> Post</span> }, { id: "seo", label: <span className="inline-flex items-center gap-1.5"><SearchIcon className="h-4 w-4" /> SEO</span> }]} active={tab} onChange={(id) => setTab(id as "post" | "seo")} />
      <div className="pt-5">
        <div className={tab === "post" ? "" : "hidden"}>
          <EditorGrid aside={
            <>
              <Panel title="Publishing">
                <FieldGroup>
                  <AField label="Publish date" htmlFor="published_at" error={err.published_at} hint="Set automatically when you first publish."><AInput id="published_at" name="published_at" type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /></AField>
                  <Toggle checked={featured} onChange={(v) => { setFeatured(v); touch(); }} label="Featured" description="Pinned at the top of the blog index." />
                  <AField label={<span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Reading time (minutes)</span>} htmlFor="reading_minutes" error={err.reading_minutes} hint={`${words.toLocaleString()} words · auto ≈ ${readingMinutes(content)} min${minutesTouched ? " (manual override)" : ""}`}>
                    <div className="flex gap-2">
                      <AInput id="reading_minutes" name="reading_minutes" type="number" min={1} value={minutes} onChange={(e) => { setMinutes(e.target.value); setMinutesTouched(true); }} />
                      {minutesTouched && <button type="button" onClick={() => { setMinutesTouched(false); setMinutes(String(readingMinutes(content))); touch(); }} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">Auto</button>}
                    </div>
                  </AField>
                </FieldGroup>
              </Panel>
              <Panel title="Taxonomy">
                <FieldGroup>
                  <CategoryChecklist categories={categories} value={catIds} onChange={(ids) => { setCatIds(ids); touch(); }} onSave={savePostCategory} onDelete={deletePostCategory} />
                  <AField label="Tags" hint="Lower-case keywords; press Enter after each."><TagsInput name="tags" value={tags} onChange={(v) => { setTags(v.map((t) => t.toLowerCase())); touch(); }} suggestions={tagSuggestions} placeholder="software-engineering, ai, careers…" max={20} /></AField>
                </FieldGroup>
              </Panel>
              <Panel title="Author">
                <FieldGroup>
                  <AField label="Name" htmlFor="author_name" error={err.author_name}><AInput id="author_name" name="author_name" defaultValue={post?.author_name ?? author.name} /></AField>
                  <AField label="Title" htmlFor="author_title" error={err.author_title}><AInput id="author_title" name="author_title" defaultValue={post?.author_title ?? author.title} placeholder="Senior Lecturer, iCET" /></AField>
                  <ImageField label="Photo" value={authorPhoto} onChange={(v) => { setAuthorPhoto(v); touch(); }} />
                </FieldGroup>
              </Panel>
            </>
          }>
            <Panel title="Article">
              <FieldGroup>
                <AField label="Title" htmlFor="title" required error={err.title}><AInput id="title" name="title" value={s.title} onChange={(e) => s.setTitle(e.target.value)} required className="font-semibold" placeholder="Why practical training matters in software engineering" /></AField>
                <SlugField value={s.slug} onChange={s.setSlug} locked={s.locked} onToggleLock={() => (s.locked ? s.regenerate() : s.setLocked(true))} error={err.slug} prefix="/blogs/" />
                <AField label="Excerpt" htmlFor="excerpt" error={err.excerpt} hint="Shown on cards and used as the default meta description."><ATextarea id="excerpt" name="excerpt" rows={3} defaultValue={post?.excerpt || ""} /></AField>
                <ImageField label="Cover image" value={cover} onChange={(v) => { setCover(v); touch(); }} hint="16:9 recommended, at least 1200px wide." />
              </FieldGroup>
            </Panel>
            <Panel title="Content">
              <RichText value={content} onChange={onContent} name="content" minHeight={420} placeholder="Start writing your article…" />
            </Panel>
          </EditorGrid>
        </div>
        <div className={tab === "seo" ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : "hidden"}>
          <SeoFields value={seo} onChange={(v) => { setSeo(v); touch(); }} faqGroups={faqGroups} defaultTitle={s.title} defaultDescription={post?.excerpt} />
        </div>
      </div>
    </form>
  );
}
