import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, Clock, Briefcase, MonitorSmartphone, ShieldCheck, Home, ChevronRight } from "lucide-react";
import type { Program } from "@/lib/data/content";
import { BlockRenderer } from "@/components/blocks/render";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { Block } from "@/lib/blocks/types";

/** Programme detail template: auto hero from the programme record + editable blocks. */
export async function ProgramPage({ program: p }: { program: Program }) {
  const blocks = (p.content?.blocks || []) as Block[];
  const highlights = p.content?.highlights?.length
    ? p.content.highlights
    : [
        p.duration && { icon: "Clock", label: "Duration", value: p.duration },
        p.training && { icon: "Briefcase", label: "Industry training", value: p.training },
        p.mode && { icon: "MonitorSmartphone", label: "Mode", value: p.mode },
        { icon: "ShieldCheck", label: "Recognition", value: "TVEC Registered P03/0177" },
      ].filter(Boolean) as { icon?: string; label: string; value: string }[];

  return (
    <>
      <section className="relative overflow-hidden bg-hero text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-32 top-10 h-[480px] w-[480px] rounded-full blur-3xl" style={{ background: `${p.accent}55` }} aria-hidden />
        <Container className="relative grid items-center gap-12 py-16 md:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="animate-fade-up">
            <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-slate-300">
              <Link href="/" className="inline-flex items-center gap-1 hover:text-white"><Home className="h-3.5 w-3.5" /> Home</Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <Link href="/professional-it-courses-in-sri-lanka" className="hover:text-white">Programmes</Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span className="text-white">{p.code}</span>
            </nav>
            {p.level_label && <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-100 backdrop-blur">{p.level_label}</p>}
            <h1 className="h-display text-white text-balance">{p.name}</h1>
            <p className="mt-3 font-display text-xl font-semibold text-brand-100 md:text-2xl">{p.qualification}</p>
            {(p.tagline || p.summary) && <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-200 text-pretty">{p.tagline || p.summary}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={`/apply?program=${p.code}`} size="xl">Begin your application <ArrowRight className="h-5 w-5" /></Button>
              {p.brochure_url && (
                <Button href={p.brochure_url} size="xl" variant="white" className="bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20">
                  <Download className="h-5 w-5" /> {p.content?.brochure_label || "Programme brochure"}
                </Button>
              )}
            </div>
            {p.content?.intake && <p className="mt-5 text-sm text-slate-300">Next intake: <strong className="text-white">{p.content.intake}</strong></p>}
          </div>
          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="relative overflow-hidden rounded-[24px] bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur">
              <div className="flex items-center gap-4">
                {p.logo_url && <Image src={p.logo_url} alt={`${p.code} logo`} width={84} height={84} className="h-20 w-20 rounded-2xl bg-white object-contain p-2" priority />}
                <div>
                  <p className="font-display text-3xl font-extrabold">{p.code}</p>
                  <p className="text-sm text-slate-200">iCET Certified Programme</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                {highlights.map((h, i) => (
                  <div key={i} className="rounded-xl bg-white/10 p-4">
                    <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
                      <Icon name={h.icon || ["Clock", "Briefcase", "MonitorSmartphone", "ShieldCheck"][i % 4]} className="h-4 w-4" /> {h.label}
                    </dt>
                    <dd className="mt-1 font-semibold text-white">{h.value}</dd>
                  </div>
                ))}
              </dl>
              {p.hero_image && (
                <Image src={p.hero_image} alt="" width={800} height={500} className="mt-5 aspect-[16/9] w-full rounded-xl object-cover" />
              )}
            </div>
          </div>
        </Container>
      </section>
      <BlockRenderer blocks={blocks} pageTitle={p.name} />
    </>
  );
}

export { Clock, Briefcase, MonitorSmartphone, ShieldCheck };
