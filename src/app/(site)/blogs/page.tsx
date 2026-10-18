import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { getPosts, getPostCategories } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { PostCard } from "@/components/site/cards";
import { Container, Section } from "@/components/ui/primitives";
import { buildMetadata, breadcrumbJsonLd, JsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata(s, { title: "Blogs – Software Engineering Insights, Guides and Tech Trends", description: "Explore. Learn. Grow. Articles from iCET lecturers and industry experts on software engineering, AI, blockchain, careers and technology in Sri Lanka.", path: "/blogs" });
}

export default function BlogsPage({ searchParams }: PageProps<"/blogs">) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blogs", path: "/blogs" }])} />
      <section className="relative overflow-hidden bg-hero py-16 text-white md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <Container className="relative">
          <p className="eyebrow mb-3 text-brand-200">Insights</p>
          <h1 className="h-display text-white">Explore. Learn. Grow.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">Guides, tutorials and career insights from iCET lecturers and industry experts.</p>
        </Container>
      </section>
      <Suspense fallback={<Section><Container><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-80" />)}</div></Container></Section>}>
        <PostsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PostsList({ searchParams }: { searchParams: PageProps<"/blogs">["searchParams"] }) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const [cats, posts] = await Promise.all([getPostCategories(), getPosts({ category, tag, limit: 60 })]);
  const [featured, ...rest] = posts;
  return (
    <Section>
      <Container>
        <div className="scrollbar-none -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          <Link href="/blogs" className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", !category && !tag ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-brand-300")}>All</Link>
          {cats.map((c) => <Link key={c.id} href={`/blogs?category=${c.slug}`} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", category === c.slug ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-brand-300")}>{c.name}</Link>)}
        </div>
        {!posts.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-12 text-center">
            <Newspaper className="mx-auto h-12 w-12 text-brand-300" />
            <h2 className="mt-4 font-display text-xl font-bold">No articles yet</h2>
            <p className="mt-2 text-slate-600">New posts are on the way.</p>
          </div>
        ) : (
          <>
            {featured && !category && !tag && <PostCard p={featured} featured />}
            <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", featured && !category && !tag && "mt-8")}>
              {(category || tag ? posts : rest).map((p) => <PostCard key={p.id} p={p} />)}
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
