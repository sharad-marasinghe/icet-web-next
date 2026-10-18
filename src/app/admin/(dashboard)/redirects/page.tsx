import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ExternalLink, FileText, GraduationCap, Newspaper, CalendarDays, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader, Panel, Pagination, SearchBox, EmptyState } from "@/components/admin/ui";
import { RedirectsPanel, type RedirectRow } from "@/components/admin/system/redirects-panel";

export const metadata: Metadata = { title: "Redirects & SEO" };
const PER = 25;

type SeoIssue = { id: string; title: string; slug: string; missing: string[] };

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await requireUser("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const like = `%${q}%`;
  const where = q ? sql`where from_path ilike ${like} or to_path ilike ${like}` : sql``;
  const [rows, [{ count }], pages, programs, posts, events] = await Promise.all([
    sql<RedirectRow[]>`select id, from_path, to_path, status_code, is_active, hits, created_at::text from public.redirects ${where} order by created_at desc limit ${PER} offset ${(page - 1) * PER}`,
    sql<{ count: number }[]>`select count(*)::int from public.redirects ${where}`,
    sql<SeoIssue[]>`select id, title, slug, array_remove(array[case when coalesce(seo->>'description','') = '' then 'description' end, case when coalesce(seo->>'og_image','') = '' then 'image' end], null) as missing from public.pages where status = 'published' and (coalesce(seo->>'description','') = '' or coalesce(seo->>'og_image','') = '') order by title`,
    sql<SeoIssue[]>`select id, name as title, slug, array_remove(array[case when coalesce(seo->>'description','') = '' then 'description' end, case when coalesce(seo->>'og_image','') = '' and coalesce(hero_image,'') = '' then 'image' end], null) as missing from public.programs where is_active and (coalesce(seo->>'description','') = '' or (coalesce(seo->>'og_image','') = '' and coalesce(hero_image,'') = '')) order by sort_order`,
    sql<SeoIssue[]>`select id, title, slug, array_remove(array[case when coalesce(seo->>'description','') = '' and excerpt = '' then 'description' end, case when coalesce(seo->>'og_image','') = '' and coalesce(cover_image,'') = '' then 'image' end], null) as missing from public.posts where status = 'published' and ((coalesce(seo->>'description','') = '' and excerpt = '') or (coalesce(seo->>'og_image','') = '' and coalesce(cover_image,'') = '')) order by published_at desc nulls last limit 50`,
    sql<SeoIssue[]>`select id, title, slug, array_remove(array[case when coalesce(seo->>'description','') = '' and excerpt = '' then 'description' end, case when coalesce(seo->>'og_image','') = '' and coalesce(image_url,'') = '' then 'image' end], null) as missing from public.events where status = 'published' and ((coalesce(seo->>'description','') = '' and excerpt = '') or (coalesce(seo->>'og_image','') = '' and coalesce(image_url,'') = '')) order by start_at desc limit 50`,
  ]);
  const totalPages = Math.max(1, Math.ceil(count / PER));
  const groups = [
    { key: "pages", label: "Pages", icon: FileText, href: (id: string) => `/admin/pages/${id}`, items: pages, prefix: "/" },
    { key: "programs", label: "Programmes", icon: GraduationCap, href: (id: string) => `/admin/programs/${id}`, items: programs, prefix: "/" },
    { key: "posts", label: "Blog posts", icon: Newspaper, href: (id: string) => `/admin/posts/${id}`, items: posts, prefix: "/blogs/" },
    { key: "events", label: "Events", icon: CalendarDays, href: (id: string) => `/admin/events/${id}`, items: events, prefix: "/events/" },
  ];
  const issueCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader title="Redirects & SEO" description="Send old URLs to their new homes and keep every public page ready for search engines." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Redirects & SEO" }]}
        actions={<>
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-500">sitemap.xml <ExternalLink className="h-3.5 w-3.5" /></a>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-500">robots.txt <ExternalLink className="h-3.5 w-3.5" /></a>
        </>} />

      <Panel title={`Redirects (${count})`} description="Matched before any page renders. Paths are compared exactly (with or without a trailing slash)." actions={<form className="flex items-center gap-2"><SearchBox defaultValue={q} placeholder="Search paths…" /></form>}>
        <RedirectsPanel rows={rows} />
        <Pagination page={page} pages={totalPages} baseHref={`/admin/redirects?q=${encodeURIComponent(q)}&page=__PAGE__`} />
      </Panel>

      <Panel className="mt-6" title="SEO health" description={issueCount ? `${issueCount} published item${issueCount === 1 ? "" : "s"} missing a meta description or social image.` : "Every published page, programme, post and event has a description and an image."}>
        {issueCount === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-600" />} title="All clear" description="Nothing to fix right now. New content will appear here when it is published without SEO metadata." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {groups.filter((g) => g.items.length).map((g) => (
              <div key={g.key} className="rounded-xl border border-slate-200">
                <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500"><g.icon className="h-4 w-4" /> {g.label} <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-inset ring-amber-200">{g.items.length}</span></p>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link href={g.href(it.id)} className="block truncate font-semibold text-slate-900 hover:text-brand-700">{it.title}</Link>
                        <p className="truncate font-mono text-[11px] text-slate-400">{g.prefix}{it.slug === "home" ? "" : it.slug}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {it.missing.map((m) => <span key={m} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">No {m}</span>)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
