import type { MetadataRoute } from "next";
import { getPublishedPageSlugs, getPrograms, getEvents, getPosts, getAlbums } from "@/lib/data/content";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, programs, upcoming, past, posts, albums] = await Promise.all([getPublishedPageSlugs(), getPrograms(), getEvents({ upcoming: true, limit: 500 }), getEvents({ past: true, limit: 500 }), getPosts({ limit: 500 }), getAlbums()]);
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...pages.filter((p) => p.slug !== "home").map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...programs.map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: absoluteUrl("/events"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...[...upcoming, ...past].map((e) => ({ url: absoluteUrl(`/events/${e.slug}`), lastModified: new Date(e.updated_at), changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: absoluteUrl("/blogs"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({ url: absoluteUrl(`/blogs/${p.slug}`), lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...albums.map((a) => ({ url: absoluteUrl(`/student-life/gallery/${a.slug}`), lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
    { url: absoluteUrl("/verify-certificate"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
