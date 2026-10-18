import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getPage, getProgramBySlug, getPublishedPageSlugs, getPrograms } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { BlockRenderer } from "@/components/blocks/render";
import { ProgramPage } from "@/components/site/program-page";
import { buildMetadata, breadcrumbJsonLd, JsonLd, courseJsonLd } from "@/lib/seo";
import { lookupRedirect } from "@/lib/data/redirects";

// Known slugs are prerendered via generateStaticParams; unknown ones must resolve (and 404) on the server.
export const instant = false;

const RESERVED = new Set(["admin", "api", "events", "blogs", "search", "verify-certificate", "register", "_next"]);

export async function generateStaticParams() {
  const [pages, programs] = await Promise.all([getPublishedPageSlugs(), getPrograms()]);
  return [...pages.filter((p) => p.slug !== "home").map((p) => ({ slug: p.slug })), ...programs.map((p) => ({ slug: p.slug }))];
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getSettings();
  const page = await getPage(slug);
  if (page) return buildMetadata(settings, { title: page.title, path: `/${slug}`, seo: page.seo, modifiedTime: page.updated_at });
  const program = await getProgramBySlug(slug);
  if (program) return buildMetadata(settings, { title: `${program.name} – ${program.qualification}`, description: program.summary, path: `/${slug}`, seo: program.seo, image: program.hero_image || program.logo_url });
  return { title: "Page not found" };
}

export default async function SitePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();
  const page = await getPage(slug);
  if (page) {
    return (
      <>
        <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: page.title, path: `/${slug}` }])} />
        <BlockRenderer blocks={page.blocks} pageTitle={page.title} />
      </>
    );
  }
  const program = await getProgramBySlug(slug);
  if (program) {
    return (
      <>
        <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Programmes", path: "/professional-it-courses-in-sri-lanka" }, { name: program.name, path: `/${slug}` }])} />
        <JsonLd data={courseJsonLd(program)} />
        <ProgramPage program={program} />
      </>
    );
  }
  const target = await lookupRedirect(`/${slug}`);
  if (target) {
    if (target.status_code === 301 || target.status_code === 308) permanentRedirect(target.to_path);
    redirect(target.to_path);
  }
  notFound();
}
