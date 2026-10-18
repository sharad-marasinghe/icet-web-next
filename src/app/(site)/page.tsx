import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { BlockRenderer } from "@/components/blocks/render";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPage("home")]);
  return buildMetadata(settings, { title: page?.seo?.title || settings.seo.default_title, path: "/", seo: page?.seo });
}

export default async function HomePage() {
  const page = await getPage("home");
  if (!page) notFound();
  return <BlockRenderer blocks={page.blocks} pageTitle={page.title} />;
}
