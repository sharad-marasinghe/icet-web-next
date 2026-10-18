import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicFeedbackForm } from "@/lib/data/registry";
import { sql } from "@/lib/db";

// Blocking route: unknown slugs must resolve (and 404) on the server.
export const instant = false;

export async function generateStaticParams() {
  const rows = await sql<{ slug: string }[]>`select slug from public.feedback_forms where is_active`;
  return rows.map((r) => ({ slug: r.slug }));
}
import { Container, Section } from "@/components/ui/primitives";
import { FormBlock } from "@/components/forms/form-block";

export async function generateMetadata({ params }: PageProps<"/feedback/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const f = await getPublicFeedbackForm(slug);
  return { title: f ? f.name : "Form not found", robots: { index: false } };
}

export default async function FeedbackPage({ params }: PageProps<"/feedback/[slug]">) {
  const { slug } = await params;
  const f = await getPublicFeedbackForm(slug);
  if (!f) notFound();
  return (
    <>
      <section className="bg-hero py-14 text-white">
        <Container className="max-w-3xl text-center">
          <p className="eyebrow text-brand-200">Feedback</p>
          <h1 className="h-section mt-2 text-white">{f.name}</h1>
        </Container>
      </section>
      <Section tone="light">
        <Container className="max-w-3xl">
          <Suspense fallback={<div className="skeleton h-96" />}>
            <FormBlock data={{ kind: "feedback", feedback_slug: f.slug, sidebar: false }} />
          </Suspense>
        </Container>
      </Section>
    </>
  );
}
