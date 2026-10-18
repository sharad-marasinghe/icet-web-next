import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Users, Sparkles } from "lucide-react";
import { getPublicWorkshop } from "@/lib/data/registry";
import { sql } from "@/lib/db";

// Blocking route: unknown slugs must resolve (and 404) on the server.
export const instant = false;

export async function generateStaticParams() {
  const rows = await sql<{ slug: string }[]>`select slug from public.reg_workshops where status <> 'draft'`;
  return rows.map((r) => ({ slug: r.slug }));
}
import { getSettings } from "@/lib/data/settings";
import { Container, Section, Badge } from "@/components/ui/primitives";
import { FormBlock } from "@/components/forms/form-block";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatDate } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/register/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [s, w] = await Promise.all([getSettings(), getPublicWorkshop(slug)]);
  if (!w) return { title: "Workshop not found" };
  return buildMetadata(s, { title: `${w.title} – Registration`, description: w.description.replace(/<[^>]+>/g, " ").slice(0, 160) || `Register for ${w.title} at iCET.`, path: `/register/${slug}`, image: w.hero_image });
}

export default async function RegisterPage({ params }: PageProps<"/register/[slug]">) {
  const { slug } = await params;
  const w = await getPublicWorkshop(slug);
  if (!w || w.status === "draft") notFound();
  return (
    <>
      <section className="relative overflow-hidden bg-hero text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <Container className="relative grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge tone={w.status === "active" ? "green" : "white"}>{w.status === "active" ? "Registrations open" : "Registrations closed"}</Badge>
            <h1 className="h-display mt-4 text-white text-balance">{w.title}</h1>
            {w.description && <div className="prose-icet prose-invert mt-5 max-w-xl text-slate-200" dangerouslySetInnerHTML={{ __html: sanitizeHtml(w.description) }} />}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-200">
              {w.starts_at && <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-300" />{formatDate(w.starts_at, { weekday: "long", hour: "numeric", minute: "2-digit" })}</span>}
              {w.seats && <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-brand-300" />Limited to {w.seats} seats</span>}
              <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-300" />Certificate on completion</span>
            </div>
          </div>
          {w.hero_image && <Image src={w.hero_image} alt={w.title} width={900} height={600} priority sizes="(min-width:1024px) 480px, 100vw" className="w-full rounded-2xl object-cover shadow-elev ring-1 ring-white/20" />}
        </Container>
      </section>
      <Section tone="light">
        <Container className="max-w-5xl">
          <Suspense fallback={<div className="skeleton h-96" />}>
            <FormBlock data={{ kind: "workshop", workshop_slug: w.slug, sidebar: true, show_header: false, title: "Reserve your seat", eyebrow: "Registration form" }} />
          </Suspense>
        </Container>
      </Section>
    </>
  );
}
