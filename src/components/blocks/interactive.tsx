"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Play, Quote, Star, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ───────────── Counter ───────────── */
export function Counter({ value, prefix, suffix, className }: { value: number | string; prefix?: string; suffix?: string; className?: string }) {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.]/g, ""));
  const isNum = Number.isFinite(n) && String(value).trim() !== "";
  const [v, setV] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!isNum) return;
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started) {
        started = true;
        const start = performance.now();
        const dur = 1600;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          setV(Math.round(n * e));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [n, isNum]);
  return (
    <span ref={ref} className={className}>
      {prefix}{isNum ? v.toLocaleString("en-US") : value}{suffix}
    </span>
  );
}

/* ───────────── Accordion (FAQ) ───────────── */
export function Accordion({ items, defaultOpen = 0, invert }: { items: { id: string; title: string; html: string }[]; defaultOpen?: number | null; invert?: boolean }) {
  const [open, setOpen] = React.useState<string | null>(defaultOpen != null ? items[defaultOpen]?.id ?? null : null);
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className="px-5 sm:px-6">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : it.id)}
                aria-expanded={isOpen}
                aria-controls={`acc-${it.id}`}
                className="flex w-full items-center justify-between gap-4 py-4 text-left font-display text-[16px] font-semibold text-slate-900 hover:text-brand-700 sm:text-[17px]"
              >
                {it.title}
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition", isOpen && "rotate-180 bg-brand-600 text-white")}>
                  <ChevronDown className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div id={`acc-${it.id}`} className={cn("grid transition-[grid-template-rows] duration-300", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <div className={cn("prose-icet pb-5 text-[15px] text-slate-600", invert && "prose-invert")} dangerouslySetInnerHTML={{ __html: it.html }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── Testimonial carousel ───────────── */
export type TestimonialItem = { id: string; name: string; role: string; company: string; quote: string; photo_url: string | null; video_url: string | null; rating: number | null };
export function TestimonialCarousel({ items }: { items: TestimonialItem[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [idx, setIdx] = React.useState(0);
  const scrollTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
    setIdx(i);
  };
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const cards = Array.from(el.children) as HTMLElement[];
      const pos = el.scrollLeft + 24;
      let best = 0;
      cards.forEach((c, i) => { if (c.offsetLeft <= pos) best = i; });
      setIdx(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="relative">
      <div ref={ref} className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0">
        {items.map((t) => (
          <TestimonialCard key={t.id} t={t} className="w-[86%] shrink-0 snap-start sm:w-[420px]" />
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button key={i} type="button" onClick={() => scrollTo(i)} aria-label={`Show testimonial ${i + 1}`} className={cn("h-2 rounded-full transition-all", i === idx ? "w-7 bg-brand-600" : "w-2 bg-slate-300 hover:bg-slate-400")} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => scrollTo(Math.max(0, idx - 1))} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700" aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => scrollTo(Math.min(items.length - 1, idx + 1))} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700" aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TestimonialCard({ t, className }: { t: TestimonialItem; className?: string }) {
  return (
    <figure className={cn("card flex flex-col p-6 sm:p-7", className)}>
      <Quote className="h-8 w-8 text-brand-200" aria-hidden />
      {t.rating ? (
        <div className="mt-3 flex gap-0.5 text-amber-400" aria-label={`${t.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-4 w-4", i < (t.rating || 0) ? "fill-current" : "text-slate-200")} />)}
        </div>
      ) : null}
      <blockquote className="mt-3 flex-1 text-[15.5px] leading-relaxed text-slate-700">“{t.quote}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
        {t.photo_url ? (
          <Image src={t.photo_url} alt={t.name} width={52} height={52} className="h-13 w-13 rounded-full object-cover ring-2 ring-brand-100" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 font-display text-lg font-bold text-white">{t.name.charAt(0)}</span>
        )}
        <div className="min-w-0">
          <p className="font-display font-bold text-slate-900">{t.name}</p>
          <p className="truncate text-sm text-slate-500">{[t.role, t.company].filter(Boolean).join(" @ ")}</p>
        </div>
        {t.video_url && (
          <a href={t.video_url} target="_blank" rel="noopener noreferrer" className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white" aria-label="Watch video">
            <Play className="h-4 w-4" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/* ───────────── Lightbox gallery ───────────── */
export type GalleryItem = { id: string; url: string; alt: string; caption?: string; width?: number | null; height?: number | null; album_title?: string };
export function Lightbox({ images, layout = "masonry" }: { images: GalleryItem[]; layout?: "masonry" | "grid" | "carousel" }) {
  const [open, setOpen] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((v) => (v === null ? v : (v + 1) % images.length));
      if (e.key === "ArrowLeft") setOpen((v) => (v === null ? v : (v - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, images.length]);

  return (
    <>
      {layout === "carousel" ? (
        <div className="scrollbar-none -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setOpen(i)} className="group relative aspect-[4/3] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[360px]">
              <Image src={img.url} alt={img.alt} fill sizes="(min-width:640px) 360px, 80vw" className="object-cover transition duration-500 group-hover:scale-105" />
            </button>
          ))}
        </div>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setOpen(i)} className="group relative aspect-square overflow-hidden rounded-xl">
              <Image src={img.url} alt={img.alt} fill sizes="(min-width:1024px) 300px, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
            </button>
          ))}
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden rounded-xl bg-slate-100">
              <Image src={img.url} alt={img.alt} width={img.width || 800} height={img.height || 600} sizes="(min-width:1024px) 300px, 50vw" className="h-auto w-full object-cover transition duration-500 group-hover:scale-105" />
              {img.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left text-xs text-white opacity-0 transition group-hover:opacity-100">{img.caption}</span>}
            </button>
          ))}
        </div>
      )}
      {open !== null && images[open] && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <button type="button" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close" onClick={() => setOpen(null)}><X className="h-6 w-6" /></button>
          <button type="button" className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:grid" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + images.length) % images.length); }}><ChevronLeft className="h-7 w-7" /></button>
          <button type="button" className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:grid" aria-label="Next" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % images.length); }}><ChevronRight className="h-7 w-7" /></button>
          <figure className="max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <Image src={images[open].url} alt={images[open].alt} width={images[open].width || 1600} height={images[open].height || 1066} sizes="100vw" className="max-h-[82vh] w-auto rounded-lg object-contain" />
            {(images[open].caption || images[open].album_title) && <figcaption className="mt-3 text-center text-sm text-slate-300">{images[open].caption || images[open].album_title} · {open + 1}/{images.length}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}

/* ───────────── YouTube lite embed ───────────── */
export function YouTube({ id, title, thumbnail, className, autoplayOnClick = true }: { id: string; title: string; thumbnail?: string | null; className?: string; autoplayOnClick?: boolean }) {
  const [play, setPlay] = React.useState(false);
  const thumb = thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return (
    <div className={cn("group relative aspect-video overflow-hidden rounded-2xl bg-slate-900", className)}>
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplayOnClick ? 1 : 0}&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="absolute inset-0 h-full w-full" aria-label={`Play ${title}`}>
          <Image src={thumb} alt={title} fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" unoptimized={thumb.includes("ytimg.com")} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-brand-700 shadow-elev transition group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
          <span className="absolute inset-x-0 bottom-0 p-4 text-left font-display text-[15px] font-semibold text-white">{title}</span>
        </button>
      )}
    </div>
  );
}

/* ───────────── Tabs ───────────── */
export function Tabs({ items, variant = "pills" }: { items: { id: string; title: string; icon?: React.ReactNode; content: React.ReactNode }[]; variant?: "pills" | "underline" }) {
  const [active, setActive] = React.useState(items[0]?.id);
  const current = items.find((i) => i.id === active) ?? items[0];
  return (
    <div>
      <div role="tablist" className={cn("scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0", variant === "underline" && "border-b border-slate-200")}>
        {items.map((it) => (
          <button
            key={it.id}
            role="tab"
            type="button"
            aria-selected={active === it.id}
            onClick={() => setActive(it.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 text-sm font-semibold transition",
              variant === "pills"
                ? cn("rounded-full px-4 py-2.5", active === it.id ? "bg-brand-600 text-white shadow-card" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-300")
                : cn("-mb-px border-b-2 px-4 py-3", active === it.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"),
            )}
          >
            {it.icon}{it.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6 animate-fade-up" key={current?.id} style={{ animationDuration: ".35s" }}>
        {current?.content}
      </div>
    </div>
  );
}

/* ───────────── Sticky anchor nav ───────────── */
export function AnchorNav({ items, cta }: { items: { label: string; anchor: string }[]; cta?: { label: string; href: string } }) {
  const [active, setActive] = React.useState<string>("");
  React.useEffect(() => {
    const els = items.map((i) => document.getElementById(i.anchor)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-40% 0px -50% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <div className="sticky top-[var(--header-h)] z-30 border-y border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-x flex items-center gap-4">
        <nav className="scrollbar-none -mx-1 flex flex-1 gap-1 overflow-x-auto py-2" aria-label="On this page">
          {items.map((i) => (
            <a key={i.anchor} href={`#${i.anchor}`} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", active === i.anchor ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
              {i.label}
            </a>
          ))}
        </nav>
        {cta?.href && (
          <Button href={cta.href} size="sm" className="hidden sm:inline-flex">{cta.label} <ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Marquee ───────────── */
export function Marquee({ children, speed = 40 }: { children: React.ReactNode; speed?: number }) {
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]" style={{ animationDuration: `${speed}s` }}>
        <div className="flex shrink-0 items-center gap-10">{children}</div>
        <div className="flex shrink-0 items-center gap-10" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

export function ProgramCardLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <Link href={href} className={className}>{children}</Link>;
}
