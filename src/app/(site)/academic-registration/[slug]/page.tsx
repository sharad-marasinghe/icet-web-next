import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicBatch } from "@/lib/data/registry";
import { sql } from "@/lib/db";

// Blocking route: unknown slugs must resolve (and 404) on the server.
export const instant = false;

export async function generateStaticParams() {
  const rows = await sql<{ slug: string }[]>`select slug from public.reg_batches`;
  return rows.map((r) => ({ slug: r.slug }));
}
import { Container, Section } from "@/components/ui/primitives";
import { FormBlock } from "@/components/forms/form-block";

export async function generateMetadata({ params }: PageProps<"/academic-registration/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBatch(slug);
  return { title: b ? `${b.batch_name} – Academic Registration` : "Batch not found", robots: { index: false } };
}

export default async function BatchRegistrationPage({ params }: PageProps<"/academic-registration/[slug]">) {
  const { slug } = await params;
  const b = await getPublicBatch(slug);
  if (!b) notFound();
  return (
    <>
      <section className="bg-hero py-14 text-white">
        <Container className="max-w-3xl text-center">
          <p className="eyebrow text-brand-200">Academic registration · {b.course_code}</p>
          <h1 className="h-section mt-2 text-white">{b.intro_title || b.batch_name}</h1>
        </Container>
      </section>
      <Section tone="light">
        <Container className="max-w-4xl">
          <Suspense fallback={<div className="skeleton h-96" />}>
            <FormBlock data={{ kind: "batch", batch_slug: b.slug, sidebar: false, show_header: false }} />
          </Suspense>
        </Container>
      </Section>
    </>
  );
}
