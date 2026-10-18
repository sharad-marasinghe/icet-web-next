import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { getEvents, getEventCategories, getOpenWorkshops } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { EventCard, WorkshopCard } from "@/components/site/cards";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata, breadcrumbJsonLd, JsonLd } from "@/lib/seo";
import { EventsFilter } from "./filter";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata(s, { title: "Events & Workshops – Tech Meetups, Webinars and Hands-on Workshops", description: "Join iCET community events, hands-on workshops, webinars and tech meetups in Sri Lanka to sharpen your skills and grow your professional network.", path: "/events" });
}

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }])} />
      <section className="relative overflow-hidden bg-hero py-16 text-white md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <Container className="relative">
          <p className="eyebrow mb-3 text-brand-200">Community</p>
          <h1 className="h-display text-white">Events & Workshops</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">Join our community events, hands-on workshops, webinars and tech meetups to enhance your skills and expand your professional network.</p>
        </Container>
      </section>
      <Suspense fallback={<Section><Container><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-80" />)}</div></Container></Section>}>
        <EventsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EventsList({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const requested = sp.view === "past" ? "past" : sp.view === "upcoming" ? "upcoming" : null;
  const [cats, upcoming, past, workshops] = await Promise.all([
    getEventCategories(),
    getEvents({ upcoming: true, category, limit: 60 }),
    getEvents({ past: true, category, limit: 60 }),
    getOpenWorkshops(6),
  ]);
  // Default to whichever list has content so visitors never land on an empty page.
  const view: "upcoming" | "past" = requested ?? (upcoming.length ? "upcoming" : "past");
  const list = view === "past" ? past : upcoming;
  return (
    <>
      {workshops.length > 0 && view === "upcoming" && !category && (
        <Section tone="light" size="sm">
          <Container>
            <SectionHeading eyebrow="Register now" title="Open for registration" description="Workshops and short courses currently accepting registrations." align="left" className="mb-8" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{workshops.map((w) => <WorkshopCard key={w.id} w={w} />)}</div>
          </Container>
        </Section>
      )}
      <Section>
        <Container>
          <EventsFilter categories={cats} active={category} view={view} counts={{ upcoming: upcoming.length, past: past.length }} />
          {list.length ? (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{list.map((e) => <EventCard key={e.id} e={e} categories={cats} />)}</div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-surface p-12 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-brand-300" />
              <h2 className="mt-4 font-display text-xl font-bold text-slate-900">No {view} events{category ? " in this category" : ""} yet</h2>
              <p className="mt-2 text-slate-600">Follow us on social media or check back soon. Meanwhile, explore our <Link href="/professional-it-courses-in-sri-lanka" className="text-brand-700 underline">programmes</Link>.</p>
              {view === "upcoming" && past.length > 0 && <Link href={`/events?view=past${category ? `&category=${category}` : ""}`} className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-700"><Sparkles className="h-4 w-4" /> Browse past events</Link>}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
