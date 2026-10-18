import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Mail, MapPin, Phone, MessageCircle, Download, Quote as QuoteIcon, Home } from "lucide-react";
import { Linkedin } from "@/components/ui/brand-icons";
import { cn, youtubeId } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { Section, SectionHeading, Container, Badge, IconBox, type Tone } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CtaButton, CtaRow, TextLink } from "./shared";
import { HeroBlock } from "./hero";
import { Accordion, AnchorNav, Counter, Lightbox, Marquee, Tabs, TestimonialCard, TestimonialCarousel, YouTube } from "./interactive";
import { EventCard, PostCard, ProgramCard, WorkshopCard } from "@/components/site/cards";
import type * as B from "@/lib/blocks/types";
import {
  getAlbums, getEventCategories, getEvents, getFaqGroup, getGalleryImages, getOpenWorkshops, getPartners, getPosts, getPrograms, getTestimonials, getTrainers, getVideos,
} from "@/lib/data/content";
import { getSettings } from "@/lib/data/settings";
import { FormBlock } from "@/components/forms/form-block";

const invertTones: Tone[] = ["navy", "brand", "gradient"];

export async function BlockRenderer({ blocks, pageTitle }: { blocks: B.Block[]; pageTitle?: string }) {
  return (
    <>
      {blocks.filter((b) => !b.settings?.hidden).map((b, i) => (
        <BlockSwitch key={b.id || i} block={b} pageTitle={pageTitle} />
      ))}
    </>
  );
}

async function BlockSwitch({ block, pageTitle }: { block: B.Block; pageTitle?: string }) {
  const s = block.settings || {};
  const tone = (s.tone || "white") as Tone;
  const invert = invertTones.includes(tone);
  const wrap = (children: React.ReactNode, extra?: string) => (
    <Section tone={tone} id={s.anchor} size={s.size} className={cn(s.className, extra)}>
      <Container>{children}</Container>
    </Section>
  );

  switch (block.type) {
    case "hero": {
      const d = block.data;
      return <div id={s.anchor}><HeroBlock data={d} badgeIcons={d.badges?.map((b, i) => <Icon key={i} name={b.icon} className="h-4 w-4 text-accent-500" />)} /></div>;
    }
    case "page_hero":
      return <PageHero data={block.data} id={s.anchor} pageTitle={pageTitle} />;
    case "banner":
      return <Banner data={block.data} id={s.anchor} />;
    case "anchor_nav":
      return <AnchorNav items={block.data.items || []} cta={block.data.cta} />;
    case "features":
      return wrap(<Features data={block.data} invert={invert} />);
    case "programs":
      return wrap(<Programs data={block.data} invert={invert} />);
    case "split":
      return wrap(<Split data={block.data} invert={invert} />);
    case "stats":
      return wrap(<Stats data={block.data} invert={invert} />);
    case "testimonials":
      return wrap(<Testimonials data={block.data} invert={invert} />);
    case "partners":
      return wrap(<Partners data={block.data} invert={invert} />);
    case "cta":
      return <Cta data={block.data} id={s.anchor} tone={tone} />;
    case "cards":
      return wrap(<Cards data={block.data} invert={invert} />);
    case "faq":
      return wrap(<Faq data={block.data} invert={invert} />);
    case "rich_text":
      return wrap(<RichText data={block.data} invert={invert} />);
    case "gallery":
      return wrap(<Gallery data={block.data} invert={invert} />);
    case "videos":
      return wrap(<Videos data={block.data} invert={invert} />);
    case "trainers":
      return wrap(<Trainers data={block.data} invert={invert} />);
    case "steps":
      return wrap(<Steps data={block.data} invert={invert} />);
    case "pricing":
      return wrap(<Pricing data={block.data} invert={invert} />);
    case "curriculum":
      return wrap(<Curriculum data={block.data} invert={invert} />);
    case "events":
      return wrap(<Events data={block.data} invert={invert} />);
    case "posts":
      return wrap(<Posts data={block.data} invert={invert} />);
    case "workshops":
      return wrap(<Workshops data={block.data} invert={invert} />);
    case "contact":
      return wrap(<Contact data={block.data} invert={invert} />);
    case "form":
      return wrap(<FormBlock data={block.data} invert={invert} />);
    case "quote":
      return wrap(<QuoteBlock data={block.data} invert={invert} />);
    case "embed":
      return wrap(<Embed data={block.data} />);
    case "tabs":
      return wrap(<TabsBlock data={block.data} invert={invert} />);
    default:
      return null;
  }
}

/* ───────────────────────── Heading helper ───────────────────────── */
function Heading({ d, invert, align = "center", as }: { d: { eyebrow?: string; title?: string; description?: string }; invert?: boolean; align?: "center" | "left"; as?: "h1" | "h2" | "h3" }) {
  if (!d.title && !d.eyebrow && !d.description) return null;
  return <SectionHeading eyebrow={d.eyebrow} title={d.title || ""} description={d.description} invert={invert} align={align} className="mb-12" as={as} />;
}

/* ───────────────────────── Page hero ───────────────────────── */
function PageHero({ data: d, id, pageTitle }: { data: B.PageHeroData; id?: string; pageTitle?: string }) {
  const center = d.align === "center";
  return (
    <section id={id} className={cn("relative overflow-hidden bg-hero text-white", d.compact ? "py-14 md:py-16" : "py-16 md:py-24")}>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <Container className={cn("relative grid items-center gap-10", d.image?.url && !center ? "lg:grid-cols-[1.1fr_0.9fr]" : "")}>
        <div className={cn(center && "mx-auto max-w-3xl text-center")}>
          {d.breadcrumbs !== false && (
            <nav aria-label="Breadcrumb" className={cn("mb-5 flex items-center gap-1.5 text-sm text-slate-300", center && "justify-center")}>
              <Link href="/" className="inline-flex items-center gap-1 hover:text-white"><Home className="h-3.5 w-3.5" /> Home</Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span className="text-white">{pageTitle || d.title}</span>
            </nav>
          )}
          {d.eyebrow && <p className="eyebrow mb-3 text-brand-200">{d.eyebrow}</p>}
          <h1 className="h-display text-white text-balance">{d.title}</h1>
          {d.subtitle && <p className={cn("mt-5 max-w-2xl text-lg text-slate-200 text-pretty", center && "mx-auto")}>{d.subtitle}</p>}
          <CtaRow links={d.ctas} className={cn("mt-8", center && "justify-center")} invert />
        </div>
        {d.image?.url && !center && (
          <div className="relative">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-tr from-brand-400/40 to-accent-500/30 blur-2xl" aria-hidden />
            <Image src={d.image.url} alt={d.image.alt || ""} width={d.image.width || 1000} height={d.image.height || 700} priority sizes="(min-width:1024px) 520px, 100vw" className="relative aspect-[4/3] w-full rounded-[22px] object-cover shadow-elev ring-1 ring-white/20" />
          </div>
        )}
      </Container>
    </section>
  );
}

function Banner({ data: d, id }: { data: B.BannerData; id?: string }) {
  const h = { sm: "min-h-[220px]", md: "min-h-[340px]", lg: "min-h-[480px]" }[d.height || "md"];
  return (
    <section id={id} className={cn("relative overflow-hidden", h)}>
      {d.image?.url && <Image src={d.image.url} alt={d.image.alt || d.title || ""} fill sizes="100vw" className="object-cover" />}
      {d.overlay !== false && <div className="absolute inset-0 bg-gradient-to-r from-navy/80 to-navy/30" />}
      {(d.title || d.subtitle) && (
        <Container className="relative flex h-full flex-col justify-center py-16 text-white">
          {d.title && <h2 className="h-section text-white">{d.title}</h2>}
          {d.subtitle && <p className="mt-3 max-w-xl text-lg text-slate-200">{d.subtitle}</p>}
          <CtaRow links={[d.cta]} className="mt-6" invert />
        </Container>
      )}
    </section>
  );
}

/* ───────────────────────── Features ───────────────────────── */
function Features({ data: d, invert }: { data: B.FeaturesData; invert: boolean }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[Number(d.columns) as 2 | 3 | 4] || "md:grid-cols-2 lg:grid-cols-4";
  const style = d.style || "cards";
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className={cn("grid gap-5", cols)}>
        {(d.items || []).map((it, i) => {
          const inner = (
            <>
              {it.image?.url ? (
                <Image src={it.image.url} alt={it.image.alt || ""} width={400} height={260} className="mb-4 aspect-[3/2] w-full rounded-xl object-cover" />
              ) : style === "numbered" ? (
                <span className={cn("mb-4 font-display text-4xl font-extrabold", invert ? "text-brand-300" : "text-brand-200")}>{String(i + 1).padStart(2, "0")}</span>
              ) : (
                <IconBox tone={invert ? "white" : "brand"} className={cn("mb-4", style === "icon-left" && "mb-0 shrink-0")}><Icon name={it.icon} className="h-6 w-6" /></IconBox>
              )}
              <div>
                <h3 className={cn("h-card", invert && "text-white")}>{it.title}</h3>
                {it.description && <p className={cn("mt-2 text-[15px] leading-relaxed", invert ? "text-slate-300" : "text-slate-600")}>{it.description}</p>}
                {it.href && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Learn more <ArrowRight className="h-4 w-4" /></span>}
              </div>
            </>
          );
          const cls = cn(
            style === "cards" && (invert ? "rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10" : "card card-hover p-6"),
            style === "minimal" && "p-2",
            style === "numbered" && (invert ? "rounded-2xl border border-white/10 p-6" : "rounded-2xl border border-slate-200 p-6 bg-white"),
            style === "icon-left" && "flex gap-4 p-2",
            "h-full",
          );
          return it.href ? (
            <Link key={i} href={it.href} className={cls}>{inner}</Link>
          ) : (
            <div key={i} className={cls}>{inner}</div>
          );
        })}
      </div>
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} /></div>}
    </>
  );
}

/* ───────────────────────── Programs ───────────────────────── */
async function Programs({ data: d, invert }: { data: B.ProgramsData; invert: boolean }) {
  const all = await getPrograms();
  const list = d.codes?.length ? all.filter((p) => d.codes!.map((c) => c.toLowerCase()).includes(p.code.toLowerCase())) : all;
  if (d.style === "compare") {
    const rows: [string, (p: typeof list[number]) => string][] = [
      ["Qualification", (p) => p.qualification],
      ["Duration", (p) => p.duration],
      ["Industry training", (p) => p.training],
      ["Mode", (p) => p.mode],
      ["Entry", (p) => p.content?.compare?.entry || (p.content?.entry_requirements || []).join(", ")],
      ["Ideal for", (p) => p.content?.compare?.ideal_for || (p.content?.audiences || []).map((a) => a.title).join(", ")],
      ["Key technologies", (p) => p.content?.compare?.technologies || ""],
      ["Course fee", (p) => p.content?.compare?.fee || (p.fee_from ? `From LKR ${Number(p.fee_from).toLocaleString()}` : "")],
    ];
    return (
      <>
        <Heading d={d} invert={invert} />
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-slate-200 bg-surface">
                <th className="p-5 font-semibold text-slate-500">Programme</th>
                {list.map((p) => (
                  <th key={p.id} className="p-5 align-top">
                    <div className="flex items-center gap-3">
                      {p.logo_url && <Image src={p.logo_url} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-contain" />}
                      <div>
                        <p className="font-display text-lg font-bold text-slate-900">{p.code}</p>
                        <p className="text-xs font-medium text-slate-500">{p.name}</p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <th scope="row" className="p-5 font-semibold text-slate-700">{label}</th>
                  {list.map((p) => <td key={p.id} className="p-5 text-slate-700">{fn(p) || "—"}</td>)}
                </tr>
              ))}
              <tr className="bg-surface/60">
                <td className="p-5" />
                {list.map((p) => <td key={p.id} className="p-5"><Button href={`/${p.slug}`} size="sm" variant="outline">View {p.code} <ArrowRight className="h-4 w-4" /></Button></td>)}
              </tr>
            </tbody>
          </table>
        </div>
        {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} /></div>}
      </>
    );
  }
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className={cn("grid gap-6", list.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : "md:grid-cols-2")}>
        {list.map((p) => <ProgramCard key={p.id} p={p} detailed={d.style === "detailed"} />)}
      </div>
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} /></div>}
    </>
  );
}

/* ───────────────────────── Split ───────────────────────── */
function Split({ data: d, invert }: { data: B.SplitData; invert: boolean }) {
  const yt = d.video_url ? youtubeId(d.video_url) : null;
  const media = yt ? (
    <YouTube id={yt} title={d.title} />
  ) : d.image?.url ? (
    <div className="relative">
      <div className="absolute -inset-3 -z-10 rounded-[28px] bg-gradient-to-tr from-brand-100 to-accent-500/10 blur-xl" aria-hidden />
      <Image src={d.image.url} alt={d.image.alt || d.title} width={d.image.width || 1000} height={d.image.height || 760} sizes="(min-width:1024px) 560px, 100vw" className="w-full rounded-[22px] object-cover shadow-card ring-1 ring-slate-200/60" />
      {d.badge && <span className="absolute left-5 top-5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-card">{d.badge}</span>}
      {!!d.stats?.length && (
        <div className="absolute -bottom-6 right-6 hidden gap-6 rounded-2xl bg-white px-6 py-4 shadow-elev md:flex">
          {d.stats.map((st, i) => (
            <div key={i}><p className="font-display text-2xl font-extrabold text-brand-700">{st.value}</p><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{st.label}</p></div>
          ))}
        </div>
      )}
    </div>
  ) : null;
  return (
    <div className={cn("grid items-center gap-12 lg:grid-cols-2", d.image_side === "right" && "lg:[&>*:first-child]:order-2")}>
      {media && <div>{media}</div>}
      <div className={cn(!media && "lg:col-span-2 mx-auto max-w-3xl")}>
        {d.eyebrow && <p className={cn("eyebrow mb-3", invert && "text-brand-300")}>{d.eyebrow}</p>}
        <h2 className={cn("h-section text-balance", invert && "text-white")}>{d.title}</h2>
        {d.body && <div className={cn("prose-icet mt-5", invert && "prose-invert")} dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.body) }} />}
        {!!d.bullets?.length && (
          <ul className="mt-7 grid gap-4 sm:grid-cols-2">
            {d.bullets.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg", invert ? "bg-white/10 text-white" : "bg-brand-50 text-brand-600")}><Icon name={b.icon || "Check"} className="h-4.5 w-4.5" /></span>
                <div>
                  <p className={cn("font-semibold", invert ? "text-white" : "text-slate-900")}>{b.title}</p>
                  {b.text && <p className={cn("text-sm", invert ? "text-slate-300" : "text-slate-600")}>{b.text}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <CtaRow links={d.ctas} className="mt-8" invert={invert} />
      </div>
    </div>
  );
}

/* ───────────────────────── Stats ───────────────────────── */
function Stats({ data: d, invert }: { data: B.StatsData; invert: boolean }) {
  const inline = d.style === "inline";
  return (
    <>
      <Heading d={d} invert={invert} />
      <dl className={cn("grid gap-5", inline ? "grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200/50" : "grid-cols-2 lg:grid-cols-4")}>
        {(d.items || []).map((it, i) => (
          <div key={i} className={cn(inline ? "px-4 text-center" : invert ? "rounded-2xl border border-white/10 bg-white/5 p-6 text-center" : "card p-6 text-center")}>
            {it.icon && !inline && <IconBox tone={invert ? "white" : "brand"} className="mb-4"><Icon name={it.icon} className="h-6 w-6" /></IconBox>}
            <dt className={cn("font-display text-4xl font-extrabold tracking-tight lg:text-5xl", invert ? "text-white" : "text-brand-700")}>
              <Counter value={it.value} prefix={it.prefix} suffix={it.suffix} />
            </dt>
            <dd className={cn("mt-2 text-sm font-semibold uppercase tracking-wider", invert ? "text-slate-300" : "text-slate-500")}>{it.label}</dd>
          </div>
        ))}
      </dl>
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant={invert ? "white" : "primary"} /></div>}
    </>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */
async function Testimonials({ data: d, invert }: { data: B.TestimonialsData; invert: boolean }) {
  const items = await getTestimonials(d.source || undefined, d.limit || 10);
  if (!items.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      {d.layout === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{items.map((t) => <TestimonialCard key={t.id} t={t} />)}</div>
      ) : d.layout === "featured" ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <TestimonialCard t={items[0]} className="lg:row-span-2 lg:text-lg" />
          {items.slice(1, 3).map((t) => <TestimonialCard key={t.id} t={t} />)}
        </div>
      ) : (
        <TestimonialCarousel items={items} />
      )}
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant="outline" /></div>}
    </>
  );
}

/* ───────────────────────── Partners ───────────────────────── */
async function Partners({ data: d, invert }: { data: B.PartnersData; invert: boolean }) {
  const items = await getPartners(d.category || undefined);
  if (!items.length) return null;
  const logo = (p: typeof items[number]) => (
    <div key={p.id} className={cn("flex h-20 w-44 shrink-0 items-center justify-center rounded-xl px-5 grayscale transition hover:grayscale-0", invert ? "bg-white/90" : "bg-white ring-1 ring-slate-200")} title={p.name}>
      <Image src={p.logo_url} alt={p.name} width={160} height={64} className="max-h-12 w-auto object-contain" />
    </div>
  );
  const content = d.style === "grid" ? (
    <div className="flex flex-wrap justify-center gap-4">{items.map((p) => (p.website_url ? <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer">{logo(p)}</a> : logo(p)))}</div>
  ) : (
    <Marquee speed={Math.max(20, items.length * 4)}>{items.map(logo)}</Marquee>
  );
  return (
    <>
      <Heading d={d} invert={invert} />
      {content}
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant="outline" /></div>}
    </>
  );
}

/* ───────────────────────── CTA ───────────────────────── */
function Cta({ data: d, id, tone }: { data: B.CtaData; id?: string; tone: Tone }) {
  const dark = tone === "white" || tone === "light" || tone === "grid" ? "navy" : tone;
  if (d.style === "card" || d.style === "split") {
    return (
      <Section tone={tone === "navy" || tone === "brand" || tone === "gradient" ? "white" : tone} id={id}>
        <Container>
          <div className={cn("relative overflow-hidden rounded-[28px] p-8 text-white shadow-elev md:p-12", dark === "brand" ? "bg-brand-600" : "bg-navy-grad", d.style === "split" && "grid items-center gap-10 lg:grid-cols-2")}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="relative">
              {d.eyebrow && <p className="eyebrow mb-3 text-brand-200">{d.eyebrow}</p>}
              <h2 className="h-section text-white text-balance">{d.title}</h2>
              {d.description && <p className="mt-4 max-w-xl text-lg text-slate-200">{d.description}</p>}
              {!!d.bullets?.length && <ul className="mt-5 grid gap-2 sm:grid-cols-2">{d.bullets.map((b, i) => <li key={i} className="flex items-center gap-2 text-sm text-white"><Check className="h-4 w-4 text-accent-500" />{b}</li>)}</ul>}
              <CtaRow links={[d.primary_cta, d.secondary_cta]} className="mt-8" invert />
            </div>
            {d.style === "split" && d.image?.url && <Image src={d.image.url} alt={d.image.alt || ""} width={800} height={600} className="relative aspect-[4/3] w-full rounded-2xl object-cover" />}
          </div>
        </Container>
      </Section>
    );
  }
  return (
    <section id={id} className={cn("relative overflow-hidden py-16 text-white md:py-20", dark === "brand" ? "bg-brand-600" : "bg-navy-grad")}>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" aria-hidden />
      <Container className="relative flex flex-col items-center gap-8 text-center lg:flex-row lg:text-left lg:justify-between">
        <div className="max-w-2xl">
          {d.eyebrow && <p className="eyebrow mb-3 text-brand-200">{d.eyebrow}</p>}
          <h2 className="h-section text-white text-balance">{d.title}</h2>
          {d.description && <p className="mt-4 text-lg text-slate-200">{d.description}</p>}
          {!!d.bullets?.length && <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">{d.bullets.map((b, i) => <li key={i} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-accent-500" />{b}</li>)}</ul>}
        </div>
        <CtaRow links={[d.primary_cta, d.secondary_cta]} className="shrink-0 justify-center" invert />
      </Container>
    </section>
  );
}

/* ───────────────────────── Cards ───────────────────────── */
function Cards({ data: d, invert }: { data: B.CardsData; invert: boolean }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[Number(d.columns) as 2 | 3 | 4] || "md:grid-cols-3";
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className={cn("grid gap-6", cols)}>
        {(d.items || []).map((c, i) =>
          d.style === "overlay" ? (
            <article key={i} className="group relative aspect-[4/5] overflow-hidden rounded-2xl">
              {c.image?.url && <Image src={c.image.url} alt={c.image.alt || c.title} fill sizes="(min-width:1024px) 400px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                {c.badge && <Badge tone="white" className="mb-3">{c.badge}</Badge>}
                <h3 className="font-display text-xl font-bold">{c.title}</h3>
                {c.description && <p className="mt-2 text-sm text-slate-200">{c.description}</p>}
                {c.cta?.href && <Link href={c.cta.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline">{c.cta.label} <ArrowRight className="h-4 w-4" /></Link>}
              </div>
            </article>
          ) : (
            <article key={i} className={cn("card card-hover group flex flex-col overflow-hidden", d.style === "compact" && "flex-row items-start gap-4 p-5")}>
              {c.image?.url ? (
                <div className={cn("relative overflow-hidden", d.style === "compact" ? "h-20 w-20 shrink-0 rounded-xl" : "aspect-[16/10]")}>
                  <Image src={c.image.url} alt={c.image.alt || c.title} fill sizes="(min-width:1024px) 400px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  {c.badge && <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-card">{c.badge}</span>}
                </div>
              ) : c.icon ? (
                <div className={cn(d.style !== "compact" && "px-6 pt-6")}><IconBox><Icon name={c.icon} className="h-6 w-6" /></IconBox></div>
              ) : null}
              <div className={cn("flex flex-1 flex-col", d.style !== "compact" && "p-6")}>
                <h3 className="h-card">{c.title}</h3>
                {c.description && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{c.description}</p>}
                {c.cta?.href && (
                  <div className="mt-auto pt-5">
                    <Button href={c.cta.href} variant={c.cta.variant || "outline"} size="md" className="w-full sm:w-auto">{c.cta.label} <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </article>
          ),
        )}
      </div>
    </>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */
async function Faq({ data: d, invert }: { data: B.FaqData; invert: boolean }) {
  const g = await getFaqGroup(d.group_slug);
  if (!g || !g.faqs.length) return null;
  const faqs = d.limit ? g.faqs.slice(0, d.limit) : g.faqs;
  const items = faqs.map((f) => ({ id: f.id, title: f.question, html: sanitizeHtml(f.answer) }));
  const jsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer.replace(/<[^>]+>/g, " ").trim() } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {d.layout === "two-column" ? (
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Heading d={{ eyebrow: d.eyebrow || "FAQ", title: d.title || g.title, description: d.description || g.description }} invert={invert} align="left" />
            {d.cta?.href && <CtaButton link={d.cta} fallbackVariant="outline" />}
          </div>
          <Accordion items={items} />
        </div>
      ) : (
        <>
          <Heading d={{ eyebrow: d.eyebrow || "FAQ", title: d.title || g.title, description: d.description || g.description }} invert={invert} />
          <div className="mx-auto max-w-3xl"><Accordion items={items} /></div>
          {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant="outline" /></div>}
        </>
      )}
    </>
  );
}

/* ───────────────────────── Rich text ───────────────────────── */
function RichText({ data: d, invert }: { data: B.RichTextData; invert: boolean }) {
  const w = { narrow: "max-w-3xl mx-auto", wide: "max-w-5xl mx-auto", full: "" }[d.width || "narrow"];
  return <div className={cn("prose-icet", w, invert && "prose-invert")} dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.html) }} />;
}

/* ───────────────────────── Gallery ───────────────────────── */
async function Gallery({ data: d, invert }: { data: B.GalleryData; invert: boolean }) {
  if (d.layout === "albums") {
    const albums = await getAlbums();
    return (
      <>
        <Heading d={d} invert={invert} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => (
            <Link key={a.id} href={`/student-life/gallery/${a.slug}`} className="card card-hover group overflow-hidden">
              <div className="relative aspect-[4/3] bg-slate-100">{a.cover_url && <Image src={a.cover_url} alt={a.title} fill sizes="(min-width:1024px) 400px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}</div>
              <div className="p-5"><h3 className="h-card">{a.title}</h3><p className="mt-1 text-sm text-slate-500">{a.image_count} photos{a.event_date ? ` · ${new Date(a.event_date).getFullYear()}` : ""}</p></div>
            </Link>
          ))}
        </div>
      </>
    );
  }
  const imgs = await getGalleryImages(d.albums?.length ? d.albums : undefined, d.limit || 24);
  if (!imgs.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      <Lightbox images={imgs.map((i) => ({ id: i.id, url: i.url, alt: i.alt || i.album_title, caption: i.caption, width: i.width, height: i.height, album_title: i.album_title }))} layout={(d.layout as "masonry" | "grid" | "carousel") || "masonry"} />
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant="outline" /></div>}
    </>
  );
}

/* ───────────────────────── Videos ───────────────────────── */
async function Videos({ data: d, invert }: { data: B.VideosData; invert: boolean }) {
  const vids = await getVideos(d.collection || undefined, d.limit || 6);
  if (!vids.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      {d.layout === "featured" ? (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <YouTube id={vids[0].youtube_id} title={vids[0].title} thumbnail={vids[0].thumbnail_url} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{vids.slice(1, 4).map((v) => <YouTube key={v.id} id={v.youtube_id} title={v.title} thumbnail={v.thumbnail_url} />)}</div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{vids.map((v) => <YouTube key={v.id} id={v.youtube_id} title={v.title} thumbnail={v.thumbnail_url} />)}</div>
      )}
    </>
  );
}

/* ───────────────────────── Trainers ───────────────────────── */
async function Trainers({ data: d, invert }: { data: B.TrainersData; invert: boolean }) {
  let list = await getTrainers();
  if (d.featured_only) list = list.filter((t) => t.is_featured);
  if (d.limit) list = list.slice(0, d.limit);
  if (!list.length) return null;
  const spotlight = d.layout === "spotlight" ? list.find((t) => t.is_featured) || list[0] : null;
  const grid = spotlight ? list.filter((t) => t.id !== spotlight.id) : list;
  return (
    <>
      <Heading d={d} invert={invert} />
      {spotlight && (
        <div id={spotlight.slug} className="card mb-10 grid items-center gap-8 overflow-hidden p-6 md:grid-cols-[320px_1fr] md:p-10">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-2xl bg-surface">
            {spotlight.photo_url && <Image src={spotlight.photo_url} alt={spotlight.name} fill sizes="320px" className="object-cover object-top" />}
          </div>
          <div>
            <Badge tone="brand">Founder</Badge>
            <h3 className="mt-3 font-display text-2xl font-bold text-slate-900 md:text-3xl">{spotlight.name}</h3>
            <p className="mt-1 font-semibold text-brand-700">{spotlight.title}</p>
            {spotlight.qualifications && <p className="text-sm text-slate-500">{spotlight.qualifications}</p>}
            {spotlight.bio && <p className="prose-icet mt-5 text-[16px]">{spotlight.bio}</p>}
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {spotlight.email && <a href={`mailto:${spotlight.email}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><Mail className="h-4 w-4" />{spotlight.email}</a>}
              {spotlight.linkedin_url && <a href={spotlight.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><Linkedin className="h-4 w-4" />LinkedIn</a>}
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {grid.map((t) => (
          <article key={t.id} id={t.slug} className={cn("group overflow-hidden rounded-2xl", invert ? "border border-white/10 bg-white/5" : "card card-hover")}>
            <div className="relative aspect-[4/4.6] overflow-hidden bg-gradient-to-b from-surface to-brand-50">
              {t.photo_url ? <Image src={t.photo_url} alt={t.name} fill sizes="(min-width:1024px) 300px, 50vw" className="object-cover object-top transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center font-display text-5xl font-extrabold text-brand-200">{t.name.charAt(0)}</div>}
              {t.linkedin_url && <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label={`${t.name} on LinkedIn`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#0A66C2] shadow-card opacity-0 transition group-hover:opacity-100"><Linkedin className="h-4 w-4" /></a>}
            </div>
            <div className="p-5">
              <h3 className={cn("font-display text-[17px] font-bold", invert ? "text-white" : "text-slate-900")}>{t.name}</h3>
              {t.title && <p className={cn("mt-1 text-sm font-medium", invert ? "text-brand-200" : "text-brand-700")}>{t.title}</p>}
              {t.qualifications && <p className={cn("mt-1 text-xs", invert ? "text-slate-400" : "text-slate-500")}>{t.qualifications}</p>}
              {d.show_bio && t.bio && <p className={cn("mt-3 line-clamp-4 text-sm", invert ? "text-slate-300" : "text-slate-600")}>{t.bio}</p>}
              {t.email && <a href={`mailto:${t.email}`} className={cn("mt-3 inline-flex items-center gap-1.5 text-xs font-semibold", invert ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-brand-700")}><Mail className="h-3.5 w-3.5" />{t.email}</a>}
            </div>
          </article>
        ))}
      </div>
      {d.cta?.href && <div className="mt-10 text-center"><CtaButton link={d.cta} fallbackVariant="outline" /></div>}
    </>
  );
}

/* ───────────────────────── Steps ───────────────────────── */
function Steps({ data: d, invert }: { data: B.StepsData; invert: boolean }) {
  const items = d.items || [];
  const vertical = d.layout === "vertical" || d.layout === "timeline";
  return (
    <>
      <Heading d={d} invert={invert} />
      <ol className={cn("relative grid gap-6", !vertical && "md:grid-cols-2 lg:grid-cols-4", vertical && "mx-auto max-w-3xl")}>
        {!vertical && items.length > 1 && <div className="absolute left-[12%] right-[12%] top-7 hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 lg:block" aria-hidden />}
        {items.map((st, i) => (
          <li key={i} className={cn("relative", vertical && "flex gap-5")}>
            <div className={cn("relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold shadow-card", invert ? "bg-white text-brand-700" : "bg-brand-600 text-white")}>
              {d.numbered === false && st.icon ? <Icon name={st.icon} className="h-6 w-6" /> : String(i + 1).padStart(2, "0")}
            </div>
            {vertical && i < items.length - 1 && <span className="absolute left-7 top-14 h-[calc(100%-1rem)] w-0.5 bg-brand-100" aria-hidden />}
            <div className={cn(!vertical && "mt-5", vertical && "pb-6")}>
              <h3 className={cn("h-card", invert && "text-white")}>{st.title}</h3>
              {st.description && <p className={cn("mt-2 text-[15px] leading-relaxed", invert ? "text-slate-300" : "text-slate-600")}>{st.description}</p>}
              {!!st.bullets?.length && <ul className="mt-3 space-y-1.5">{st.bullets.map((b, k) => <li key={k} className={cn("flex items-start gap-2 text-sm", invert ? "text-slate-300" : "text-slate-600")}><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />{b}</li>)}</ul>}
            </div>
          </li>
        ))}
      </ol>
      {d.note && <p className={cn("mt-8 text-center text-sm", invert ? "text-slate-300" : "text-slate-500")}>{d.note}</p>}
      {d.cta?.href && <div className="mt-8 text-center"><CtaButton link={d.cta} fallbackVariant={invert ? "white" : "primary"} /></div>}
    </>
  );
}

/* ───────────────────────── Pricing ───────────────────────── */
function PlanCard({ p }: { p: B.PricingPlan }) {
  return (
    <div className={cn("relative flex flex-col rounded-2xl border p-6", p.highlight ? "border-brand-600 bg-white shadow-[0_20px_50px_-20px_rgb(4,107,210,0.45)] ring-1 ring-brand-600" : "border-slate-200 bg-white")}>
      {p.badge && <span className={cn("absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold text-white", p.highlight ? "bg-brand-600" : "bg-navy")}>{p.badge}</span>}
      <h3 className="font-display text-lg font-bold text-slate-900">{p.name}</h3>
      {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
      {(p.price || p.original_price) && (
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          {p.original_price && <span className="text-base text-slate-400 line-through">{p.original_price}</span>}
          {p.price && <span className="font-display text-3xl font-extrabold text-brand-700">{p.price}</span>}
          {p.period && <span className="text-sm text-slate-500">{p.period}</span>}
        </div>
      )}
      {!!p.installments?.length && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl bg-surface px-4 text-sm">
          {p.installments.map((ins, i) => <li key={i} className="flex justify-between gap-3 py-2.5"><span className="text-slate-600">{ins.label}</span><span className="font-semibold text-slate-900">{ins.amount}</span></li>)}
          {p.total && <li className="flex justify-between gap-3 py-2.5 font-bold text-slate-900"><span>Total</span><span>{p.total}</span></li>}
        </ul>
      )}
      {!!p.features?.length && <ul className="mt-4 space-y-2 text-sm text-slate-700">{p.features.map((f, i) => <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />{f}</li>)}</ul>}
      {p.note && <p className="mt-3 text-xs text-slate-500">{p.note}</p>}
      <div className="mt-auto pt-6">
        {p.cta?.href ? <Button href={p.cta.href} variant={p.highlight ? "primary" : "outline"} className="w-full">{p.cta.label}</Button> : <Button href="/apply" variant={p.highlight ? "primary" : "outline"} className="w-full">Enroll with this plan</Button>}
      </div>
    </div>
  );
}
function Pricing({ data: d, invert }: { data: B.PricingData; invert: boolean }) {
  const groups = d.groups?.length ? d.groups : d.plans?.length ? [{ title: "", plans: d.plans }] : [];
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className="space-y-12">
        {groups.map((g, i) => (
          <div key={i}>
            {(g.title || g.subtitle) && (
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
                {g.title && <h3 className={cn("font-display text-xl font-bold", invert ? "text-white" : "text-slate-900")}>{g.title}</h3>}
                {g.subtitle && <p className={cn("font-semibold", invert ? "text-brand-200" : "text-brand-700")}>{g.subtitle}</p>}
              </div>
            )}
            <div className={cn("grid gap-6", g.plans.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : "md:grid-cols-2")}>{g.plans.map((p, k) => <PlanCard key={k} p={p} />)}</div>
          </div>
        ))}
      </div>
      {d.note && <p className={cn("mt-8 text-center text-sm", invert ? "text-slate-300" : "text-slate-500")}>{d.note}</p>}
    </>
  );
}

/* ───────────────────────── Curriculum ───────────────────────── */
function Curriculum({ data: d, invert }: { data: B.CurriculumData; invert: boolean }) {
  const levels = d.levels || [];
  const style = d.style || "roadmap";
  const levelCard = (lv: B.CurriculumLevel, i: number) => (
    <div key={i} className={cn("flex h-full flex-col rounded-2xl p-6", invert ? "border border-white/10 bg-white/5" : "card")}>
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl font-display text-base font-extrabold", invert ? "bg-white text-brand-700" : "bg-brand-600 text-white")}>{lv.icon ? <Icon name={lv.icon} className="h-5 w-5" /> : `L${i + 1}`}</span>
        <div>
          <h3 className={cn("font-display text-[17px] font-bold", invert ? "text-white" : "text-slate-900")}>{lv.title}</h3>
          {(lv.subtitle || lv.duration) && <p className={cn("text-xs font-semibold uppercase tracking-wider", invert ? "text-brand-200" : "text-brand-700")}>{[lv.duration, lv.subtitle].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
      <ol className="mt-5 space-y-2">
        {(lv.modules || []).map((m, k) => (
          <li key={k} className={cn("flex items-start gap-3 text-[14.5px]", invert ? "text-slate-200" : "text-slate-700")}>
            <span className={cn("mt-0.5 shrink-0 font-mono text-xs font-bold", invert ? "text-brand-300" : "text-brand-600")}>{String(k + 1).padStart(2, "0")}</span>
            {m}
          </li>
        ))}
      </ol>
      {lv.outcome && <p className={cn("mt-5 rounded-xl p-3 text-sm", invert ? "bg-white/10 text-slate-200" : "bg-surface text-slate-600")}><strong className={invert ? "text-white" : "text-slate-900"}>Outcome:</strong> {lv.outcome}</p>}
    </div>
  );
  return (
    <>
      <Heading d={d} invert={invert} />
      {style === "tabs" ? (
        <Tabs items={levels.map((lv, i) => ({ id: `lv${i}`, title: lv.title, content: <div className="mx-auto max-w-3xl">{levelCard(lv, i)}</div> }))} />
      ) : style === "accordion" ? (
        <div className="mx-auto max-w-3xl"><Accordion items={levels.map((lv, i) => ({ id: `lv${i}`, title: `${lv.title}${lv.duration ? ` · ${lv.duration}` : ""}`, html: `<ol>${(lv.modules || []).map((m) => `<li>${m}</li>`).join("")}</ol>${lv.outcome ? `<p><strong>Outcome:</strong> ${lv.outcome}</p>` : ""}` }))} /></div>
      ) : style === "roadmap" ? (
        <div className="relative">
          <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-gradient-to-r from-brand-100 via-brand-500 to-brand-100 lg:block" aria-hidden />
          <div className={cn("grid gap-6", levels.length <= 3 ? "lg:grid-cols-3 md:grid-cols-2" : levels.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3")}>
            {levels.map((lv, i) => (
              <div key={i} className="relative pt-2 lg:pt-10">
                <span className={cn("absolute left-6 top-3 hidden h-6 w-6 rounded-full border-4 lg:block", invert ? "border-navy bg-brand-300" : "border-white bg-brand-600 shadow-card")} aria-hidden />
                {levelCard(lv, i)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-6", levels.length <= 3 ? "lg:grid-cols-3 md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4")}>{levels.map(levelCard)}</div>
      )}
      {d.note && <p className={cn("mx-auto mt-8 max-w-3xl text-center text-sm", invert ? "text-slate-300" : "text-slate-600")}>{d.note}</p>}
      {d.cta?.href && <div className="mt-8 text-center"><CtaButton link={d.cta} fallbackVariant={invert ? "white" : "primary"} /></div>}
    </>
  );
}

/* ───────────────────────── Events / posts / workshops ───────────────────────── */
async function Events({ data: d, invert }: { data: B.EventsData; invert: boolean }) {
  const [cats, upcoming] = await Promise.all([getEventCategories(), getEvents({ upcoming: true, limit: d.limit || 3, category: d.category || undefined })]);
  let list = upcoming;
  if (!d.upcoming_only && list.length < (d.limit || 3)) {
    const past = await getEvents({ past: true, limit: (d.limit || 3) - list.length, category: d.category || undefined });
    list = [...list, ...past];
  }
  if (!list.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className={cn("grid gap-6", d.layout === "list" ? "" : "md:grid-cols-2 lg:grid-cols-3")}>{list.map((e) => <EventCard key={e.id} e={e} categories={cats} compact={d.layout === "list"} />)}</div>
      <div className="mt-10 text-center"><CtaButton link={d.cta || { label: "View all events", href: "/events" }} fallbackVariant={invert ? "white" : "outline"} /></div>
    </>
  );
}
async function Posts({ data: d, invert }: { data: B.PostsData; invert: boolean }) {
  const posts = await getPosts({ limit: d.limit || 3 });
  if (!posts.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{posts.map((p) => <PostCard key={p.id} p={p} />)}</div>
      <div className="mt-10 text-center"><CtaButton link={d.cta || { label: "Read all articles", href: "/blogs" }} fallbackVariant={invert ? "white" : "outline"} /></div>
    </>
  );
}
async function Workshops({ data: d, invert }: { data: B.WorkshopsData; invert: boolean }) {
  const ws = await getOpenWorkshops(d.limit || 4);
  if (!ws.length) return null;
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{ws.map((w) => <WorkshopCard key={w.id} w={w} />)}</div>
    </>
  );
}

/* ───────────────────────── Contact ───────────────────────── */
async function Contact({ data: d, invert }: { data: B.ContactData; invert: boolean }) {
  const s = await getSettings();
  const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(s.whatsapp_message)}`;
  const cards = [
    { icon: Phone, title: "Call us", lines: [s.phone_display, s.opening_hours], href: `tel:${s.phone}`, cta: "Call now" },
    { icon: Mail, title: "Email us", lines: [s.email, s.email_academics].filter(Boolean), href: `mailto:${s.email}`, cta: "Send email" },
    { icon: MessageCircle, title: "WhatsApp", lines: ["Chat with a student counsellor", "Join our official channel for updates"], href: wa, cta: "Chat on WhatsApp", secondary: s.whatsapp_channel_url ? { label: "Join channel", href: s.whatsapp_channel_url } : undefined },
    { icon: MapPin, title: "Visit us", lines: [`${s.address_line1}${s.address_line2 ? ", " + s.address_line2 : ""}`, `${s.city} ${s.postal_code}, ${s.country}`], href: s.map_url, cta: "Get directions" },
  ];
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className={cn("flex flex-col p-6", invert ? "rounded-2xl border border-white/10 bg-white/5" : "card")}>
            <IconBox tone={invert ? "white" : "brand"}><c.icon className="h-6 w-6" /></IconBox>
            <h3 className={cn("mt-4 h-card", invert && "text-white")}>{c.title}</h3>
            <div className={cn("mt-2 space-y-0.5 text-[15px]", invert ? "text-slate-300" : "text-slate-600")}>{c.lines.map((l) => <p key={l}>{l}</p>)}</div>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">{c.cta} <ArrowRight className="h-4 w-4" /></a>
              {c.secondary && <a href={c.secondary.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:underline">{c.secondary.label}</a>}
            </div>
          </div>
        ))}
      </div>
      {(d.show_form !== false || d.show_map !== false) && (
        <div className={cn("mt-12 grid gap-8", d.show_form !== false && d.show_map !== false && "lg:grid-cols-[1.1fr_0.9fr]")}>
          {d.show_form !== false && (
            <div className="card p-6 md:p-8">
              <h3 className="font-display text-2xl font-bold text-slate-900">{d.form_title || "Send us a message"}</h3>
              <p className="mt-1 text-slate-600">{d.form_description || "We reply within one working day."}</p>
              <div className="mt-6"><FormBlock data={{ kind: "contact", sidebar: false }} invert={false} bare /></div>
            </div>
          )}
          {d.show_map !== false && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card">
              <iframe
                title="iCET location map"
                src={s.map_embed_url || `https://www.google.com/maps?q=${encodeURIComponent(`${s.address_line1}, ${s.city}, ${s.country}`)}&output=embed`}
                className="h-full min-h-[420px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ───────────────────────── Quote ───────────────────────── */
function QuoteBlock({ data: d, invert }: { data: B.QuoteData; invert: boolean }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="relative mx-auto w-full max-w-md">
        <div className="absolute -inset-4 -z-10 rounded-[32px] bg-gradient-to-tr from-brand-100 to-accent-500/10" aria-hidden />
        {d.image?.url && <Image src={d.image.url} alt={d.name} width={720} height={900} sizes="(min-width:1024px) 420px, 100vw" className="aspect-[4/5] w-full rounded-[24px] object-cover object-top shadow-elev" />}
        <div className="mt-5 text-center lg:text-left">
          <p className={cn("font-display text-xl font-bold", invert ? "text-white" : "text-slate-900")}>{d.name}</p>
          {d.role && <p className={cn("font-medium", invert ? "text-brand-200" : "text-brand-700")}>{d.role}</p>}
          {d.meta && <p className={cn("text-sm", invert ? "text-slate-300" : "text-slate-500")}>{d.meta}</p>}
        </div>
      </div>
      <div>
        {d.eyebrow && <p className={cn("eyebrow mb-3", invert && "text-brand-300")}>{d.eyebrow}</p>}
        {d.title && <h2 className={cn("h-section mb-6", invert && "text-white")}>{d.title}</h2>}
        <blockquote className={cn("relative rounded-2xl p-7 text-lg font-medium leading-relaxed", invert ? "bg-white/10 text-white" : "bg-surface text-slate-800")}>
          <QuoteIcon className={cn("absolute -top-4 left-6 h-9 w-9", invert ? "text-brand-300" : "text-brand-600")} aria-hidden />
          “{d.quote}”
        </blockquote>
        {!!d.sections?.length && (
          <div className="mt-8 space-y-6">
            {d.sections.map((sct, i) => (
              <div key={i}>
                <h3 className={cn("font-display text-lg font-bold", invert ? "text-white" : "text-slate-900")}>{sct.title}</h3>
                <p className={cn("mt-2 leading-relaxed", invert ? "text-slate-300" : "text-slate-600")}>{sct.text}</p>
              </div>
            ))}
          </div>
        )}
        {d.cta?.href && <div className="mt-8"><CtaButton link={d.cta} fallbackVariant={invert ? "white" : "primary"} /></div>}
      </div>
    </div>
  );
}

/* ───────────────────────── Embed / tabs ───────────────────────── */
function Embed({ data: d }: { data: B.EmbedData }) {
  return (
    <div className="mx-auto max-w-5xl">
      {d.title && <h2 className="h-section mb-6 text-center">{d.title}</h2>}
      <div className="overflow-hidden rounded-2xl [&_iframe]:w-full" style={d.height ? ({ ["--embed-h" as string]: `${d.height}px` } as React.CSSProperties) : undefined} dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.html) }} />
    </div>
  );
}
function TabsBlock({ data: d, invert }: { data: B.TabsData; invert: boolean }) {
  return (
    <>
      <Heading d={d} invert={invert} />
      <div className="mx-auto max-w-4xl">
        <Tabs items={(d.items || []).map((t, i) => ({ id: `t${i}`, title: t.title, content: <div className="prose-icet card p-6 md:p-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.html) }} /> }))} />
      </div>
    </>
  );
}

export { TextLink, Download };
