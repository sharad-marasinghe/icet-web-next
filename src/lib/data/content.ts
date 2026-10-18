import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import type { Block, PageRecord, PageSeo } from "@/lib/blocks/types";

/* ───────────────────────── Pages ───────────────────────── */
export async function getPage(slug: string): Promise<PageRecord | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.pages, TAGS.page(slug));
  const rows = await sql<PageRecord[]>`
    select id, slug, title, template, blocks, seo, status, show_in_search, published_at::text, updated_at::text
    from public.pages where slug = ${slug} and status = 'published' limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}

export async function getPublishedPageSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.pages);
  const rows = await sql<{ slug: string; updated_at: string }[]>`select slug, updated_at::text from public.pages where status = 'published' and show_in_search`;
  return rows.map((r) => ({ ...r }));
}

/* ───────────────────────── Programs ───────────────────────── */
export type Program = {
  id: string; code: string; slug: string; name: string; qualification: string; tagline: string; summary: string;
  level_label: string; duration: string; training: string; mode: string; logo_url: string | null; hero_image: string | null;
  brochure_url: string | null; fee_from: number | null; accent: string; content: ProgramContent; seo: PageSeo; sort_order: number; is_active: boolean;
};
export type ProgramContent = {
  blocks?: Block[];                   // full page body (editable in admin)
  entry_requirements?: string[];
  audiences?: { title: string; description: string; icon?: string }[];
  highlights?: { label: string; value: string; icon?: string }[];
  compare?: Record<string, string>;   // key → value for the compare table
  faq_group_slug?: string;
  brochure_label?: string;
  intake?: string;
};

export async function getPrograms(): Promise<Program[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.programs);
  const rows = await sql<Program[]>`select * from public.programs where is_active order by sort_order asc, code asc`;
  return rows.map((r) => ({ ...r }));
}

export async function getProgramBySlug(slug: string): Promise<Program | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.programs);
  const rows = await sql<Program[]>`select * from public.programs where slug = ${slug} and is_active limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}

/* ───────────────────────── Trainers ───────────────────────── */
export type Trainer = { id: string; slug: string; name: string; title: string; qualifications: string; bio: string; email: string | null; photo_url: string | null; linkedin_url: string | null; is_featured: boolean; sort_order: number };
export async function getTrainers(): Promise<Trainer[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.trainers);
  const rows = await sql<Trainer[]>`select id, slug, name, title, qualifications, bio, email, photo_url, linkedin_url, is_featured, sort_order from public.trainers where is_active order by sort_order asc, name asc`;
  return rows.map((r) => ({ ...r }));
}

/* ───────────────────────── Testimonials ───────────────────────── */
export type Testimonial = { id: string; name: string; role: string; company: string; quote: string; photo_url: string | null; video_url: string | null; program_code: string | null; rating: number | null };
export async function getTestimonials(programCode?: string, limit = 12): Promise<Testimonial[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.testimonials);
  const rows = programCode
    ? await sql<Testimonial[]>`select id, name, role, company, quote, photo_url, video_url, program_code, rating from public.testimonials where is_active and program_code = ${programCode} order by sort_order asc limit ${limit}`
    : await sql<Testimonial[]>`select id, name, role, company, quote, photo_url, video_url, program_code, rating from public.testimonials where is_active order by sort_order asc limit ${limit}`;
  return rows.map((r) => ({ ...r }));
}

/* ───────────────────────── Partners ───────────────────────── */
export type Partner = { id: string; name: string; logo_url: string; website_url: string | null; category: string };
export async function getPartners(category?: string): Promise<Partner[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.partners);
  const rows = category
    ? await sql<Partner[]>`select id, name, logo_url, website_url, category from public.partners where is_active and category = ${category} order by sort_order asc`
    : await sql<Partner[]>`select id, name, logo_url, website_url, category from public.partners where is_active order by sort_order asc`;
  return rows.map((r) => ({ ...r }));
}

/* ───────────────────────── FAQs ───────────────────────── */
export type Faq = { id: string; question: string; answer: string };
export type FaqGroup = { id: string; slug: string; title: string; description: string; faqs: Faq[] };
export async function getFaqGroup(slug: string): Promise<FaqGroup | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.faqs);
  const g = await sql<{ id: string; slug: string; title: string; description: string }[]>`select id, slug, title, description from public.faq_groups where slug = ${slug} limit 1`;
  if (!g[0]) return null;
  const faqs = await sql<Faq[]>`select id, question, answer from public.faqs where group_id = ${g[0].id} and is_active order by sort_order asc, created_at asc`;
  return { ...g[0], faqs: faqs.map((f) => ({ ...f })) };
}

/* ───────────────────────── Events ───────────────────────── */
export type EventCategory = { id: number; slug: string; name: string; color: string };
export type EventRecord = {
  id: string; slug: string; title: string; excerpt: string; content: string; start_at: string; end_at: string | null; all_day: boolean;
  venue: string; address: string; is_online: boolean; image_url: string | null; cost: string; registration_url: string | null; workshop_id: number | null;
  category_ids: number[]; speakers: { name: string; title?: string; photo_url?: string }[]; is_featured: boolean; seo: PageSeo; updated_at: string;
  is_past: boolean; // computed inside the cached read so prerendering never touches Date.now()
};
export async function getEventCategories(): Promise<EventCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.events);
  const rows = await sql<EventCategory[]>`select id, slug, name, color from public.event_categories order by name`;
  return rows.map((r) => ({ ...r }));
}
export async function getEvents(opts: { upcoming?: boolean; past?: boolean; limit?: number; category?: string; offset?: number } = {}): Promise<EventRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.events);
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = await sql<EventRecord[]>`
    select e.id, e.slug, e.title, e.excerpt, e.content, e.start_at::text, e.end_at::text, e.all_day, e.venue, e.address, e.is_online, e.image_url, e.cost,
           e.registration_url, e.workshop_id, e.category_ids, e.speakers, e.is_featured, e.seo, e.updated_at::text
    from public.events e
    where e.status = 'published'
      ${opts.upcoming ? sql`and coalesce(e.end_at, e.start_at) >= now() - interval '6 hours'` : sql``}
      ${opts.past ? sql`and coalesce(e.end_at, e.start_at) < now() - interval '6 hours'` : sql``}
      ${opts.category ? sql`and exists (select 1 from public.event_categories c where c.slug = ${opts.category} and c.id = any(e.category_ids))` : sql``}
    order by ${opts.past ? sql`e.start_at desc` : sql`e.start_at asc`}
    limit ${limit} offset ${offset}`;
  const now = Date.now();
  return rows.map((r) => ({ ...r, is_past: new Date(r.end_at || r.start_at).getTime() < now - 6 * 3600e3 }));
}
export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.events);
  const rows = await sql<EventRecord[]>`
    select id, slug, title, excerpt, content, start_at::text, end_at::text, all_day, venue, address, is_online, image_url, cost, registration_url,
           workshop_id, category_ids, speakers, is_featured, seo, updated_at::text
    from public.events where slug = ${slug} and status = 'published' limit 1`;
  if (!rows[0]) return null;
  return { ...rows[0], is_past: new Date(rows[0].end_at || rows[0].start_at).getTime() < Date.now() - 6 * 3600e3 };
}

/* ───────────────────────── Posts ───────────────────────── */
export type PostCategory = { id: number; slug: string; name: string };
export type PostRecord = {
  id: string; slug: string; title: string; excerpt: string; content: string; cover_image: string | null; author_name: string; author_title: string; author_photo: string | null;
  category_ids: number[]; tags: string[]; reading_minutes: number; is_featured: boolean; published_at: string | null; seo: PageSeo; updated_at: string;
};
export async function getPostCategories(): Promise<PostCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts);
  const rows = await sql<PostCategory[]>`select id, slug, name from public.post_categories order by name`;
  return rows.map((r) => ({ ...r }));
}
export async function getPosts(opts: { limit?: number; offset?: number; category?: string; tag?: string } = {}): Promise<PostRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts);
  const rows = await sql<PostRecord[]>`
    select p.id, p.slug, p.title, p.excerpt, p.content, p.cover_image, p.author_name, p.author_title, p.author_photo, p.category_ids, p.tags, p.reading_minutes,
           p.is_featured, p.published_at::text, p.seo, p.updated_at::text
    from public.posts p where p.status = 'published' and (p.published_at is null or p.published_at <= now())
      ${opts.category ? sql`and exists (select 1 from public.post_categories c where c.slug = ${opts.category} and c.id = any(p.category_ids))` : sql``}
      ${opts.tag ? sql`and ${opts.tag} = any(p.tags)` : sql``}
    order by p.published_at desc nulls last limit ${opts.limit ?? 50} offset ${opts.offset ?? 0}`;
  return rows.map((r) => ({ ...r }));
}
export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts);
  const rows = await sql<PostRecord[]>`
    select id, slug, title, excerpt, content, cover_image, author_name, author_title, author_photo, category_ids, tags, reading_minutes, is_featured, published_at::text, seo, updated_at::text
    from public.posts where slug = ${slug} and status = 'published' limit 1`;
  return rows[0] ? { ...rows[0] } : null;
}

/* ───────────────────────── Gallery & videos ───────────────────────── */
export type GalleryImage = { id: string; url: string; alt: string; caption: string; width: number | null; height: number | null; album_id: string };
export type GalleryAlbum = { id: string; slug: string; title: string; description: string; cover_url: string | null; event_date: string | null; image_count: number };
export async function getAlbums(): Promise<GalleryAlbum[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gallery);
  const rows = await sql<GalleryAlbum[]>`
    select a.id, a.slug, a.title, a.description, coalesce(a.cover_url, (select url from public.gallery_images i where i.album_id = a.id order by sort_order limit 1)) as cover_url,
           a.event_date::text, (select count(*) from public.gallery_images i where i.album_id = a.id)::int as image_count
    from public.gallery_albums a where a.is_active order by a.sort_order asc, a.event_date desc nulls last`;
  return rows.map((r) => ({ ...r }));
}
export async function getGalleryImages(albumSlugs?: string[], limit = 60): Promise<(GalleryImage & { album_title: string; album_slug: string })[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gallery);
  const rows = albumSlugs && albumSlugs.length
    ? await sql<(GalleryImage & { album_title: string; album_slug: string })[]>`
        select i.id, i.url, i.alt, i.caption, i.width, i.height, i.album_id, a.title as album_title, a.slug as album_slug
        from public.gallery_images i join public.gallery_albums a on a.id = i.album_id
        where a.is_active and a.slug = any(${albumSlugs}) order by a.sort_order, i.sort_order limit ${limit}`
    : await sql<(GalleryImage & { album_title: string; album_slug: string })[]>`
        select i.id, i.url, i.alt, i.caption, i.width, i.height, i.album_id, a.title as album_title, a.slug as album_slug
        from public.gallery_images i join public.gallery_albums a on a.id = i.album_id
        where a.is_active order by a.sort_order, i.sort_order limit ${limit}`;
  return rows.map((r) => ({ ...r }));
}
export type Video = { id: string; title: string; youtube_id: string; thumbnail_url: string | null; collection: string };
export async function getVideos(collection?: string, limit = 12): Promise<Video[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.videos);
  const rows = collection
    ? await sql<Video[]>`select id, title, youtube_id, thumbnail_url, collection from public.videos where is_active and collection = ${collection} order by sort_order limit ${limit}`
    : await sql<Video[]>`select id, title, youtube_id, thumbnail_url, collection from public.videos where is_active order by sort_order limit ${limit}`;
  return rows.map((r) => ({ ...r }));
}

/* ───────────────────────── Workshops (public) ───────────────────────── */
export type PublicWorkshop = { id: number; slug: string; title: string; description: string; hero_image: string | null; status: string; starts_at: string | null; seats: number | null; registration_count: number };
export async function getOpenWorkshops(limit = 6): Promise<PublicWorkshop[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.workshops);
  const rows = await sql<PublicWorkshop[]>`
    select w.id, w.slug, w.title, w.description, w.hero_image, w.status::text, w.starts_at::text, w.seats,
           (select count(*) from public.reg_enrollments e where e.workshop_id = w.id)::int as registration_count
    from public.reg_workshops w where w.status = 'active' order by w.starts_at asc nulls last, w.id desc limit ${limit}`;
  return rows.map((r) => ({ ...r }));
}
