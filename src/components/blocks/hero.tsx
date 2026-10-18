"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { HeroData } from "@/lib/blocks/types";

export function RotatingWords({ words, className }: { words: string[]; className?: string }) {
  const [i, setI] = React.useState(0);
  const [show, setShow] = React.useState(true);
  React.useEffect(() => {
    if (words.length < 2) return;
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI((v) => (v + 1) % words.length);
        setShow(true);
      }, 260);
    }, 2800);
    return () => clearInterval(t);
  }, [words.length]);
  if (!words.length) return null;
  return (
    <span className={cn("inline-block transition-all duration-300", show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0", className)} aria-live="polite">
      {words[i]}
    </span>
  );
}

export function HeroBlock({ data, badgeIcons }: { data: HeroData; badgeIcons?: React.ReactNode[] }) {
  const layout = data.layout || "split";
  if (layout === "carousel" && data.slides?.length) return <HeroCarousel data={data} badgeIcons={badgeIcons} />;

  const centered = layout === "centered";
  return (
    <section className="relative overflow-hidden bg-hero text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-48 -left-24 h-[460px] w-[460px] rounded-full bg-accent-500/20 blur-3xl" aria-hidden />
      <div className={cn("container-x relative grid items-center gap-12 py-16 md:py-20 lg:py-24", centered ? "text-center" : "lg:grid-cols-[1.05fr_0.95fr]")}>
        <div className={cn("animate-fade-up", centered && "mx-auto max-w-3xl")}>
          {data.eyebrow && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> {data.eyebrow}
            </p>
          )}
          <h1 className="h-display text-white text-balance">
            {data.title}{" "}
            {data.rotating?.length ? (
              <>
                <br className="hidden sm:block" />
                <span className="text-brand-300">
                  <RotatingWords words={data.rotating} />
                </span>
              </>
            ) : null}
          </h1>
          {data.subtitle && <p className={cn("mt-6 max-w-xl text-lg leading-relaxed text-slate-200 text-pretty", centered && "mx-auto")}>{data.subtitle}</p>}
          <div className={cn("mt-8 flex flex-wrap items-center gap-3", centered && "justify-center")}>
            {data.primary_cta?.href && (
              <Button href={data.primary_cta.href} size="xl" variant="primary" className="shadow-[0_12px_32px_-10px_rgb(4,107,210,0.9)]">
                {data.primary_cta.label} <ArrowRight className="h-5 w-5" />
              </Button>
            )}
            {data.secondary_cta?.href && (
              <Button href={data.secondary_cta.href} size="xl" variant="white" className="bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20">
                {data.secondary_cta.label}
              </Button>
            )}
          </div>
          {data.trust && <p className="mt-5 text-sm text-slate-300">{data.trust}</p>}
          {!!data.badges?.length && (
            <ul className={cn("mt-8 flex flex-wrap gap-2.5", centered && "justify-center")}>
              {data.badges.map((b, i) => (
                <li key={i} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur">
                  {badgeIcons?.[i]} {b.label}
                </li>
              ))}
            </ul>
          )}
          {!!data.stats?.length && (
            <dl className={cn("mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 sm:max-w-lg", centered && "mx-auto")}>
              {data.stats.map((s, i) => (
                <div key={i}>
                  <dt className="font-display text-2xl font-extrabold text-white sm:text-3xl">{s.value}</dt>
                  <dd className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-300">{s.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {!centered && (
          <div className="relative animate-fade-up [animation-delay:150ms]">
            {data.image?.url ? (
              <div className="relative">
                <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-tr from-brand-500/40 to-accent-500/30 blur-2xl" aria-hidden />
                <Image
                  src={data.image.url}
                  alt={data.image.alt || ""}
                  width={data.image.width || 1200}
                  height={data.image.height || 800}
                  priority
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="relative aspect-[4/3] w-full rounded-[24px] object-cover shadow-elev ring-1 ring-white/20"
                />
                <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-white p-4 text-slate-900 shadow-elev md:block animate-float">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Since 2004</p>
                  <p className="font-display text-2xl font-extrabold text-brand-700">15,000+ <span className="text-base font-semibold text-slate-700">alumni</span></p>
                </div>
              </div>
            ) : (
              <div className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[24px] bg-white/5 ring-1 ring-white/15">
                <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
                <div className="relative text-center">
                  <p className="font-display text-6xl font-extrabold text-white/90">15,000+</p>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">graduates since 2004</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function HeroCarousel({ data, badgeIcons }: { data: HeroData; badgeIcons?: React.ReactNode[] }) {
  const slides = data.slides!.filter((s) => s.image?.url);
  const [i, setI] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  React.useEffect(() => {
    if (!playing || slides.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [playing, slides.length]);
  const go = (d: number) => setI((v) => (v + d + slides.length) % slides.length);
  const s = slides[i];
  return (
    <section className="relative overflow-hidden bg-navy text-white" aria-roledescription="carousel">
      <div className="relative aspect-[16/7] min-h-[420px] w-full">
        {slides.map((sl, idx) => (
          <Image
            key={idx}
            src={sl.image.url}
            alt={sl.image.alt || sl.title || ""}
            fill
            priority={idx === 0}
            sizes="100vw"
            className={cn("object-cover transition-opacity duration-700", idx === i ? "opacity-100" : "opacity-0")}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/85 via-navy/50 to-transparent" />
        <div className="container-x absolute inset-0 flex flex-col justify-center">
          <div className="max-w-2xl animate-fade-up" key={i}>
            {data.eyebrow && <p className="eyebrow mb-4 text-brand-200">{data.eyebrow}</p>}
            <h1 className="h-display text-white text-balance">{s.title || data.title}</h1>
            {(s.subtitle || data.subtitle) && <p className="mt-5 max-w-xl text-lg text-slate-200">{s.subtitle || data.subtitle}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {s.href && s.label ? (
                <Button href={s.href} size="xl">{s.label} <ArrowRight className="h-5 w-5" /></Button>
              ) : (
                data.primary_cta?.href && <Button href={data.primary_cta.href} size="xl">{data.primary_cta.label} <ArrowRight className="h-5 w-5" /></Button>
              )}
              {data.secondary_cta?.href && (
                <Button href={data.secondary_cta.href} size="xl" variant="white" className="bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">{data.secondary_cta.label}</Button>
              )}
            </div>
            {!!data.badges?.length && (
              <ul className="mt-8 flex flex-wrap gap-2.5">
                {data.badges.map((b, k) => (
                  <li key={k} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium backdrop-blur">{badgeIcons?.[k]} {b.label}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {slides.length > 1 && (
          <div className="container-x absolute inset-x-0 bottom-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {slides.map((_, k) => (
                <button key={k} type="button" onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`} className={cn("h-2 rounded-full transition-all", k === i ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80")} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 hover:bg-white/25" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => go(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 hover:bg-white/25" aria-label="Previous slide"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => go(1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 hover:bg-white/25" aria-label="Next slide"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
        )}
      </div>
      {slides.some((x) => x.href) && (
        <div className="hidden border-t border-white/10 bg-navy/80 lg:block">
          <div className="container-x grid grid-cols-3 divide-x divide-white/10">
            {slides.slice(0, 3).map((sl, k) => (
              <Link key={k} href={sl.href || "#"} className={cn("group flex items-center gap-3 px-6 py-4 text-sm", k === i ? "text-white" : "text-slate-400 hover:text-white")}>
                <span className={cn("h-8 w-1 rounded-full", k === i ? "bg-brand-500" : "bg-white/15")} />
                <span className="truncate font-semibold">{sl.title}</span>
                <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
