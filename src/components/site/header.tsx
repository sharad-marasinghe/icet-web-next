"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, Search, Phone, ExternalLink, ArrowRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { NavItem, SiteSettings } from "@/lib/data/settings";
import { SearchDialog } from "./search-dialog";

export type HeaderProgram = { code: string; slug: string; name: string; qualification: string; duration: string; logo_url: string | null; accent: string };

export function SiteHeader({ nav, settings, programs }: { nav: NavItem[]; settings: SiteSettings; programs: HeaderProgram[] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const lastPath = React.useRef(pathname);
  React.useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const t = setTimeout(() => {
      setMobileOpen(false);
      setOpenId(null);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setOpenId(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 120);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled ? "glass border-b border-slate-200/70 shadow-[0_6px_24px_-12px_rgb(11,31,58,0.25)]" : "bg-white/95 border-b border-transparent",
        )}
        style={{ height: "var(--header-h)" }}
      >
        <div className="container-x flex h-full items-center justify-between gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="iCET home">
            {settings.logo_url ? (
              <Image src={settings.logo_url} alt="iCET - Institute of Computer Engineering Technology" width={160} height={48} priority className="h-11 w-auto" />
            ) : (
              <span className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <span className="font-display text-xl font-extrabold tracking-tight text-navy">iCET</span>
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary" onMouseLeave={scheduleClose}>
            {nav.map((item) => {
              const hasChildren = !!item.children?.length;
              const active = isActive(item.href);
              return (
                <div key={item.id} className="relative" onMouseEnter={() => (hasChildren ? open(item.id) : setOpenId(null))}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3.5 py-2 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-brand-700",
                      active && "text-brand-700",
                    )}
                    aria-haspopup={hasChildren ? "menu" : undefined}
                    aria-expanded={hasChildren ? openId === item.id : undefined}
                    onClick={() => setOpenId(null)}
                    onFocus={() => hasChildren && open(item.id)}
                  >
                    {item.label}
                    {hasChildren && <ChevronDown className={cn("h-4 w-4 transition-transform", openId === item.id && "rotate-180")} />}
                  </Link>
                  {active && <span className="absolute inset-x-3.5 -bottom-[calc((var(--header-h)-40px)/2)] h-0.5 rounded-full bg-brand-600" aria-hidden />}

                  {hasChildren && openId === item.id && (
                    <div
                      role="menu"
                      className={cn(
                        "absolute left-0 top-full pt-3 animate-fade-up",
                        item.mega === "programs" ? "w-[760px]" : "w-80",
                      )}
                      style={{ animationDuration: "0.25s" }}
                      onMouseEnter={() => open(item.id)}
                    >
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elev">
                        {item.mega === "programs" ? (
                          <MegaPrograms programs={programs} links={item.children!} />
                        ) : (
                          <ul className="p-2">
                            {item.children!.map((c) => (
                              <li key={c.id}>
                                <Link href={c.href} role="menuitem" className="group flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-50" target={c.external ? "_blank" : undefined}>
                                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition">
                                    <ArrowRight className="h-4 w-4" />
                                  </span>
                                  <span>
                                    <span className="block text-[15px] font-semibold text-slate-900">{c.label}</span>
                                    {c.description && <span className="block text-sm text-slate-500">{c.description}</span>}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-700"
              aria-label="Search the site"
            >
              <Search className="h-4 w-4" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-500 xl:inline">⌘K</kbd>
            </button>
            {settings.lms_url && (
              <Button href={settings.lms_url} variant="ghost" size="sm" className="text-slate-700">
                Student Portal <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button href="/apply" size="md" className="px-5">
              Apply Now
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-800 hover:bg-slate-100"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!mobileOpen}>
        <div className={cn("absolute inset-0 bg-navy/40 backdrop-blur-sm transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white shadow-elev transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
          style={{ paddingTop: "var(--header-h)" }}
        >
          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Mobile">
            <ul className="space-y-1">
              {nav.map((item) => (
                <MobileItem key={item.id} item={item} active={isActive(item.href)} />
              ))}
            </ul>
            <div className="mt-6 grid gap-2">
              <Button href="/apply" size="lg">Apply Now <ArrowRight className="h-4 w-4" /></Button>
              <Button href="/verify-certificate" variant="outline" size="lg">Verify a Certificate</Button>
              {settings.lms_url && (
                <Button href={settings.lms_url} variant="ghost" size="lg">Student Portal (LMS) <ExternalLink className="h-4 w-4" /></Button>
              )}
            </div>
          </nav>
          <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
            <a href={`tel:${settings.phone}`} className="flex items-center gap-2 font-semibold text-slate-900">
              <Phone className="h-4 w-4 text-brand-600" /> {settings.phone_display}
            </a>
            <p className="mt-1">{settings.opening_hours}</p>
          </div>
        </div>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function MegaPrograms({ programs, links }: { programs: HeaderProgram[]; links: NavItem[] }) {
  const all = links.find((l) => l.id === "all") ?? links[0];
  return (
    <div className="grid grid-cols-[1fr_260px]">
      <div className="grid grid-cols-3 gap-3 p-4">
        {programs.map((p) => (
          <Link key={p.code} href={`/${p.slug}`} className="group relative flex flex-col rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:shadow-card">
            <div className="mb-3 flex items-center gap-3">
              {p.logo_url ? (
                <Image src={p.logo_url} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-contain" />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-lg text-white font-display font-bold" style={{ background: p.accent }}>{p.code}</span>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-600">{p.code}</span>
            </div>
            <span className="font-display text-[15px] font-bold text-slate-900 group-hover:text-brand-700">{p.name}</span>
            <span className="mt-1 text-xs leading-snug text-slate-500">{p.qualification}</span>
            <span className="mt-3 text-xs font-semibold text-brand-600">{p.duration}</span>
          </Link>
        ))}
      </div>
      <div className="flex flex-col justify-between bg-surface p-5">
        <div>
          <p className="eyebrow">Not sure where to start?</p>
          <p className="mt-2 text-sm text-slate-600">Compare all three programmes and find the right path from O/L to Higher Diploma.</p>
          <Link href={all.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Compare programmes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Link href="/apply" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Start your application <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function MobileItem({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = React.useState(active);
  const hasChildren = !!item.children?.length;
  return (
    <li>
      <div className="flex items-center">
        <Link href={item.href} className={cn("flex-1 rounded-lg px-3 py-3 text-base font-semibold text-slate-800", active && "text-brand-700")}>
          {item.label}
        </Link>
        {hasChildren && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500" aria-label={`Toggle ${item.label}`} aria-expanded={open}>
            <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="mb-2 ml-3 space-y-0.5 border-l-2 border-brand-100 pl-3">
          {item.children!.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="block rounded-lg px-3 py-2 text-[15px] text-slate-700 hover:bg-brand-50" target={c.external ? "_blank" : undefined}>
                {c.label}
                {c.description && <span className="block text-xs text-slate-500">{c.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
