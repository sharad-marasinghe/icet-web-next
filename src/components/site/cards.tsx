import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Clock, ArrowRight, Video, Tag } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { EventRecord, PostRecord, Program, EventCategory, PublicWorkshop } from "@/lib/data/content";
import { Badge } from "@/components/ui/primitives";

export function EventCard({ e, categories, compact }: { e: EventRecord; categories?: EventCategory[]; compact?: boolean }) {
  const start = new Date(e.start_at);
  const isPast = e.is_past;
  const cats = (categories || []).filter((c) => e.category_ids?.includes(c.id));
  const time = e.all_day ? "All day" : `${start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" })}${e.end_at ? " – " + new Date(e.end_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" }) : ""}`;
  return (
    <article className={cn("card card-hover group flex flex-col overflow-hidden", compact && "flex-row")}>
      <Link href={`/events/${e.slug}`} className={cn("relative block overflow-hidden bg-slate-100", compact ? "w-40 shrink-0" : "aspect-[16/10]")}>
        {e.image_url ? (
          <Image src={e.image_url} alt={e.title} fill sizes="(min-width:1024px) 400px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-navy-grad text-white"><CalendarDays className="h-10 w-10 opacity-60" /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-xl bg-white px-3 py-1.5 text-center shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">{start.toLocaleString("en-GB", { month: "short", timeZone: "Asia/Colombo" })}</span>
          <span className="font-display text-xl font-extrabold leading-none text-slate-900">{start.toLocaleString("en-GB", { day: "2-digit", timeZone: "Asia/Colombo" })}</span>
        </div>
        {isPast && <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white">Past event</span>}
        {!isPast && e.registration_url && <span className="absolute right-3 top-3 rounded-full bg-accent-600 px-2.5 py-1 text-[11px] font-bold text-white">Registrations open</span>}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {!!cats.length && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {cats.slice(0, 2).map((c) => <span key={c.id} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: c.color + "1a", color: c.color }}>{c.name}</span>)}
          </div>
        )}
        <h3 className="h-card line-clamp-2">
          <Link href={`/events/${e.slug}`} className="hover:text-brand-700">{e.title}</Link>
        </h3>
        {!compact && e.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{e.excerpt}</p>}
        <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" /> <span>{formatDate(e.start_at, { weekday: "short" })} · {time}</span></div>
          {(e.venue || e.is_online) && <div className="flex items-center gap-2">{e.is_online ? <Video className="h-4 w-4 text-brand-600" /> : <MapPin className="h-4 w-4 text-brand-600" />} <span className="truncate">{e.is_online ? "Online" : e.venue}</span></div>}
        </dl>
        <div className="mt-auto flex items-center justify-between pt-5">
          <Link href={`/events/${e.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 group-hover:gap-2.5 transition-all">Event details <ArrowRight className="h-4 w-4" /></Link>
          {e.cost && <span className="text-xs font-bold uppercase tracking-wide text-accent-600">{e.cost}</span>}
        </div>
      </div>
    </article>
  );
}

export function PostCard({ p, featured }: { p: PostRecord; featured?: boolean }) {
  return (
    <article className={cn("card card-hover group flex flex-col overflow-hidden", featured && "lg:flex-row")}>
      <Link href={`/blogs/${p.slug}`} className={cn("relative block overflow-hidden bg-slate-100", featured ? "aspect-[16/10] lg:aspect-auto lg:w-1/2" : "aspect-[16/10]")}>
        {p.cover_image ? (
          <Image src={p.cover_image} alt={p.title} fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-navy-grad" />
        )}
      </Link>
      <div className={cn("flex flex-1 flex-col p-6", featured && "lg:p-10")}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {p.published_at && <time dateTime={p.published_at}>{formatDate(p.published_at)}</time>}
          <span aria-hidden>·</span>
          <span>{p.reading_minutes} min read</span>
          {p.tags?.slice(0, 2).map((t) => <Badge key={t} tone="slate" className="font-semibold"><Tag className="h-3 w-3" />{t}</Badge>)}
        </div>
        <h3 className={cn("mt-3 line-clamp-3", featured ? "font-display text-2xl font-bold leading-snug lg:text-3xl" : "h-card")}>
          <Link href={`/blogs/${p.slug}`} className="hover:text-brand-700">{p.title}</Link>
        </h3>
        {p.excerpt && <p className={cn("mt-3 text-slate-600", featured ? "line-clamp-4" : "line-clamp-3 text-sm")}>{p.excerpt}</p>}
        <div className="mt-auto flex items-center gap-3 pt-6">
          {p.author_photo ? (
            <Image src={p.author_photo} alt={p.author_name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-bold text-white">{p.author_name?.charAt(0) || "i"}</span>
          )}
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900">{p.author_name || "iCET"}</p>
            {p.author_title && <p className="truncate text-slate-500">{p.author_title}</p>}
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-brand-600 transition group-hover:translate-x-1" />
        </div>
      </div>
    </article>
  );
}

export function ProgramCard({ p, detailed }: { p: Program; detailed?: boolean }) {
  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: p.accent }} />
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          {p.logo_url ? (
            <Image src={p.logo_url} alt={`${p.code} logo`} width={72} height={72} className="h-16 w-16 rounded-xl object-contain" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-xl font-display text-xl font-extrabold text-white" style={{ background: p.accent }}>{p.code}</span>
          )}
          <Badge tone="slate">{p.code}</Badge>
        </div>
        {p.level_label && <p className="eyebrow mt-5 text-[11px]" style={{ color: p.accent }}>{p.level_label}</p>}
        <h3 className="mt-2 font-display text-xl font-bold text-slate-900 group-hover:text-brand-700">
          <Link href={`/${p.slug}`}>{p.name}</Link>
        </h3>
        <p className="mt-1 font-semibold text-slate-700">{p.qualification}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{p.summary || p.tagline}</p>
        {detailed && (
          <ul className="mt-5 grid gap-2 text-sm text-slate-700">
            {[p.duration && ["Duration", p.duration], p.training && ["Training", p.training], p.mode && ["Mode", p.mode]].filter(Boolean).map((row) => (
              <li key={(row as string[])[0]} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-2"><span className="text-slate-500">{(row as string[])[0]}</span><span className="font-semibold text-right">{(row as string[])[1]}</span></li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between pt-6">
          <Link href={`/${p.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-all group-hover:gap-2.5">Explore programme <ArrowRight className="h-4 w-4" /></Link>
          {p.duration && <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.duration}</span>}
        </div>
      </div>
    </article>
  );
}

export function WorkshopCard({ w }: { w: PublicWorkshop }) {
  const spotsLeft = w.seats ? Math.max(0, w.seats - w.registration_count) : null;
  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link href={`/register/${w.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-navy-grad">
        {w.hero_image && <Image src={w.hero_image} alt={w.title} fill sizes="(min-width:1024px) 400px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}
        <span className="absolute left-3 top-3 rounded-full bg-accent-600 px-2.5 py-1 text-[11px] font-bold text-white">Registration open</span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="h-card line-clamp-2"><Link href={`/register/${w.slug}`} className="hover:text-brand-700">{w.title}</Link></h3>
        {w.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{w.description.replace(/<[^>]+>/g, "")}</p>}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          {w.starts_at ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand-600" />{formatDate(w.starts_at)}</span> : <span />}
          {spotsLeft !== null && <span className="font-semibold text-amber-700">{spotsLeft} seats left</span>}
        </div>
        <Link href={`/register/${w.slug}`} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">Register now <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </article>
  );
}
