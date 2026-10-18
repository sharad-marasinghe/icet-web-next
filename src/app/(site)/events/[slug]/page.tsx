import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Video, Ticket, ArrowLeft, ArrowRight, Share2, Users } from "lucide-react";
import { getEventBySlug, getEvents, getEventCategories } from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatDate } from "@/lib/utils";
import { Container, Section, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/cards";
import { buildMetadata, breadcrumbJsonLd, eventJsonLd, JsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  // Prerender upcoming + the most recent past events; older ones render on demand and are cached.
  const [a, b] = await Promise.all([getEvents({ upcoming: true, limit: 50 }), getEvents({ past: true, limit: 12 })]);
  return [...a, ...b].map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [s, e] = await Promise.all([getSettings(), getEventBySlug(slug)]);
  if (!e) return { title: "Event not found" };
  return buildMetadata(s, { title: e.title, description: e.excerpt || e.content.replace(/<[^>]+>/g, " ").slice(0, 160), path: `/events/${slug}`, seo: e.seo, image: e.image_url, type: "article", modifiedTime: e.updated_at });
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) notFound();
  const [cats, more] = await Promise.all([getEventCategories(), getEvents({ upcoming: true, limit: 4 })]);
  const related = more.filter((x) => x.id !== e.id).slice(0, 3);
  const start = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : null;
  const isPast = e.is_past;
  const myCats = cats.filter((c) => e.category_ids.includes(c.id));
  const time = e.all_day ? "All day" : `${start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" })}${end ? " – " + end.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" }) : ""}`;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${start.toISOString().replace(/[-:]|\.\d{3}/g, "")}/${(end || new Date(start.getTime() + 2 * 3600e3)).toISOString().replace(/[-:]|\.\d{3}/g, "")}&details=${encodeURIComponent(e.excerpt)}&location=${encodeURIComponent(e.is_online ? "Online" : `${e.venue} ${e.address}`.trim())}`;

  return (
    <>
      <JsonLd data={eventJsonLd(e)} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: e.title, path: `/events/${slug}` }])} />
      <section className="relative overflow-hidden bg-navy text-white">
        {e.image_url && <Image src={e.image_url} alt="" fill sizes="100vw" className="object-cover opacity-25 blur-sm" aria-hidden />}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/70 to-navy" />
        <Container className="relative py-14 md:py-20">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> All events</Link>
          <div className="mt-6 flex flex-wrap gap-2">
            {myCats.map((c) => <span key={c.id} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: c.color, color: "#fff" }}>{c.name}</span>)}
            {isPast ? <Badge tone="white">Past event</Badge> : <Badge tone="green">Upcoming</Badge>}
          </div>
          <h1 className="h-display mt-4 max-w-4xl text-white text-balance">{e.title}</h1>
          {e.excerpt && <p className="mt-4 max-w-2xl text-lg text-slate-200">{e.excerpt}</p>}
        </Container>
      </section>
      <Section>
        <Container className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <article>
            {e.image_url && <Image src={e.image_url} alt={e.title} width={1200} height={675} priority sizes="(min-width:1024px) 800px, 100vw" className="mb-8 w-full rounded-2xl object-cover shadow-card" />}
            <div className="prose-icet" dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.content) }} />
            {!!e.speakers?.length && (
              <div className="mt-10">
                <h2 className="font-display text-xl font-bold text-slate-900">Speakers</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {e.speakers.map((sp, i) => (
                    <li key={i} className="card flex items-center gap-4 p-4">
                      {sp.photo_url ? <Image src={sp.photo_url} alt={sp.name} width={56} height={56} className="h-14 w-14 rounded-full object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 font-bold text-white"><Users className="h-6 w-6" /></span>}
                      <div><p className="font-semibold text-slate-900">{sp.name}</p>{sp.title && <p className="text-sm text-slate-500">{sp.title}</p>}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
          <aside className="space-y-5 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
            <div className="card p-6">
              <dl className="space-y-4 text-[15px]">
                <div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 text-brand-600" /><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</dt><dd className="font-semibold text-slate-900">{formatDate(e.start_at, { weekday: "long" })}{end && end.toDateString() !== start.toDateString() ? ` – ${formatDate(e.end_at)}` : ""}</dd></div></div>
                <div className="flex gap-3"><Clock className="mt-0.5 h-5 w-5 text-brand-600" /><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Time</dt><dd className="font-semibold text-slate-900">{time}</dd></div></div>
                <div className="flex gap-3">{e.is_online ? <Video className="mt-0.5 h-5 w-5 text-brand-600" /> : <MapPin className="mt-0.5 h-5 w-5 text-brand-600" />}<div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{e.is_online ? "Format" : "Venue"}</dt><dd className="font-semibold text-slate-900">{e.is_online ? "Online (link shared after registration)" : e.venue || "iCET Institute, Panadura"}</dd>{e.address && <dd className="text-sm text-slate-500">{e.address}</dd>}</div></div>
                {e.cost && <div className="flex gap-3"><Ticket className="mt-0.5 h-5 w-5 text-brand-600" /><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Cost</dt><dd className="font-semibold text-slate-900">{e.cost}</dd></div></div>}
              </dl>
              <div className="mt-6 grid gap-2">
                {!isPast && e.registration_url && <Button href={e.registration_url} size="lg">Register now <ArrowRight className="h-4 w-4" /></Button>}
                {!isPast && <Button href={gcal} variant="outline" size="md">Add to Google Calendar</Button>}
                <Button href="/apply" variant={isPast ? "primary" : "ghost"} size="md">Explore our programmes</Button>
              </div>
            </div>
            <div className="card p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Share2 className="h-4 w-4 text-brand-600" /> Share this event</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-brand-300" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://icet.lk/events/${slug}`)}`}>Facebook</a>
                <a className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-brand-300" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://icet.lk/events/${slug}`)}`}>LinkedIn</a>
                <a className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-brand-300" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${e.title} – https://icet.lk/events/${slug}`)}`}>WhatsApp</a>
              </div>
            </div>
          </aside>
        </Container>
      </Section>
      {related.length > 0 && (
        <Section tone="light">
          <Container>
            <h2 className="h-section mb-8">More upcoming events</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{related.map((x) => <EventCard key={x.id} e={x} categories={cats} />)}</div>
          </Container>
        </Section>
      )}
    </>
  );
}
