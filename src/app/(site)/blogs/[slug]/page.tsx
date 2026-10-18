import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CalendarDays, Tag } from "lucide-react";
import { getPostBySlug, getPosts, getPostCategories } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatDate } from "@/lib/utils";
import { Container, Section, Badge } from "@/components/ui/primitives";
import { PostCard } from "@/components/site/cards";
import { buildMetadata, breadcrumbJsonLd, articleJsonLd, JsonLd } from "@/lib/seo";
import { Button } from "@/components/ui/button";

export async function generateStaticParams() {
  const posts = await getPosts({ limit: 200 });
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blogs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [s, p] = await Promise.all([getSettings(), getPostBySlug(slug)]);
  if (!p) return { title: "Article not found" };
  return buildMetadata(s, { title: p.title, description: p.excerpt, path: `/blogs/${slug}`, seo: p.seo, image: p.cover_image, type: "article", publishedTime: p.published_at, modifiedTime: p.updated_at });
}

export default async function PostPage({ params }: PageProps<"/blogs/[slug]">) {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p) notFound();
  const [cats, more] = await Promise.all([getPostCategories(), getPosts({ limit: 4 })]);
  const myCats = cats.filter((c) => p.category_ids.includes(c.id));
  const related = more.filter((x) => x.id !== p.id).slice(0, 3);
  return (
    <>
      <JsonLd data={articleJsonLd(p)} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blogs", path: "/blogs" }, { name: p.title, path: `/blogs/${slug}` }])} />
      <article>
        <header className="bg-surface">
          <Container className="max-w-4xl py-12 md:py-16">
            <Link href="/blogs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> All articles</Link>
            <div className="mt-5 flex flex-wrap gap-2">{myCats.map((c) => <Link key={c.id} href={`/blogs?category=${c.slug}`}><Badge>{c.name}</Badge></Link>)}</div>
            <h1 className="h-display mt-4 text-balance">{p.title}</h1>
            {p.excerpt && <p className="mt-4 text-lg text-slate-600">{p.excerpt}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-3">
                {p.author_photo ? <Image src={p.author_photo} alt={p.author_name} width={44} height={44} className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 font-bold text-white">{p.author_name.charAt(0) || "i"}</span>}
                <div><p className="font-semibold text-slate-900">{p.author_name || "iCET"}</p>{p.author_title && <p className="text-xs text-slate-500">{p.author_title}</p>}</div>
              </div>
              {p.published_at && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand-600" />{formatDate(p.published_at)}</span>}
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-600" />{p.reading_minutes} min read</span>
            </div>
          </Container>
        </header>
        <Container className="max-w-4xl">
          {p.cover_image && <Image src={p.cover_image} alt={p.title} width={1400} height={788} priority sizes="(min-width:1024px) 900px, 100vw" className="-mt-8 w-full rounded-2xl object-cover shadow-elev" />}
          <div className="prose-icet mx-auto mt-10 max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.content) }} />
          {!!p.tags?.length && (
            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center gap-2 border-t border-slate-200 pt-6">
              <Tag className="h-4 w-4 text-slate-400" />
              {p.tags.map((t) => <Link key={t} href={`/blogs?tag=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700">{t}</Link>)}
            </div>
          )}
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl bg-navy-grad p-8 text-white">
            <p className="eyebrow text-brand-200">Start your journey</p>
            <h2 className="mt-2 font-display text-2xl font-bold">Turn curiosity into a software engineering career</h2>
            <p className="mt-2 text-slate-200">Industry-aligned programmes with real internships, taught by practising engineers.</p>
            <div className="mt-5 flex flex-wrap gap-3"><Button href="/professional-it-courses-in-sri-lanka" variant="white">Explore programmes</Button><Button href="/apply" variant="ghost" className="text-white hover:bg-white/10">Apply now</Button></div>
          </div>
        </Container>
      </article>
      {related.length > 0 && (
        <Section tone="light">
          <Container>
            <h2 className="h-section mb-8">Keep reading</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{related.map((x) => <PostCard key={x.id} p={x} />)}</div>
          </Container>
        </Section>
      )}
    </>
  );
}
