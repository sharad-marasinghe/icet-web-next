import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAlbums, getGalleryImages } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { Container, Section } from "@/components/ui/primitives";
import { Lightbox } from "@/components/blocks/interactive";
import { buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  return (await getAlbums()).map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({ params }: PageProps<"/student-life/gallery/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [s, albums] = await Promise.all([getSettings(), getAlbums()]);
  const a = albums.find((x) => x.slug === slug);
  if (!a) return { title: "Album not found" };
  return buildMetadata(s, { title: `${a.title} – Photo Gallery`, description: a.description || `Photos from ${a.title} at iCET.`, path: `/student-life/gallery/${slug}`, image: a.cover_url });
}
export default async function AlbumPage({ params }: PageProps<"/student-life/gallery/[slug]">) {
  const { slug } = await params;
  const albums = await getAlbums();
  const a = albums.find((x) => x.slug === slug);
  if (!a) notFound();
  const images = await getGalleryImages([slug], 200);
  return (
    <Section>
      <Container>
        <Link href="/student-life" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Student life</Link>
        <h1 className="h-section mt-4">{a.title}</h1>
        {a.description && <p className="mt-2 max-w-2xl text-slate-600">{a.description}</p>}
        <div className="mt-8"><Lightbox images={images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || a.title, caption: i.caption, width: i.width, height: i.height }))} layout="masonry" /></div>
      </Container>
    </Section>
  );
}
