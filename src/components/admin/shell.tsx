"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, GraduationCap, Users, Quote, Handshake, CircleHelp, CalendarDays, Newspaper, Image as ImageIcon, PlayCircle, FolderOpen,
  Inbox, Ticket, Layers, UserRound, ClipboardList, Award, Mail, MessageSquareHeart, Settings, Menu as MenuIcon, X, LogOut, ExternalLink, Shield, Route, ScrollText, ChevronDown, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AdminUser } from "@/lib/auth";
import { startTopLoader } from "@/components/ui/top-loader";

type Item = { label: string; href: string; icon: React.ElementType; min?: AdminUser["role"]; badge?: number };
type Group = { title: string; items: Item[] };

const RANK = { viewer: 0, editor: 1, admin: 2, super_admin: 3 } as const;

export function buildNav(counts: Record<string, number> = {}): Group[] {
  return [
    { title: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }, { label: "Inquiries", href: "/admin/inquiries", icon: Inbox, badge: counts.inquiries }] },
    {
      title: "Website content",
      items: [
        { label: "Pages", href: "/admin/pages", icon: FileText },
        { label: "Programmes", href: "/admin/programs", icon: GraduationCap },
        { label: "Trainers", href: "/admin/trainers", icon: Users },
        { label: "Testimonials", href: "/admin/testimonials", icon: Quote },
        { label: "Partners", href: "/admin/partners", icon: Handshake },
        { label: "FAQs", href: "/admin/faqs", icon: CircleHelp },
        { label: "Events", href: "/admin/events", icon: CalendarDays },
        { label: "Blog posts", href: "/admin/posts", icon: Newspaper },
        { label: "Gallery", href: "/admin/gallery", icon: ImageIcon },
        { label: "Videos", href: "/admin/videos", icon: PlayCircle },
        { label: "Media library", href: "/admin/media", icon: FolderOpen },
      ],
    },
    {
      title: "Registry",
      items: [
        { label: "Workshops", href: "/admin/registry/workshops", icon: Ticket },
        { label: "Academic batches", href: "/admin/registry/batches", icon: Layers },
        { label: "Students", href: "/admin/registry/students", icon: UserRound },
        { label: "Applications", href: "/admin/registry/applications", icon: ClipboardList, badge: counts.applications },
        { label: "Certificates", href: "/admin/registry/certificates", icon: Award },
        { label: "Email settings", href: "/admin/registry/email", icon: Mail, min: "admin" },
      ],
    },
    { title: "Feedback", items: [{ label: "Feedback forms", href: "/admin/feedback", icon: MessageSquareHeart }] },
    {
      title: "System",
      items: [
        { label: "Navigation", href: "/admin/navigation", icon: Route, min: "admin" },
        { label: "Site settings", href: "/admin/settings", icon: Settings, min: "admin" },
        { label: "Redirects & SEO", href: "/admin/redirects", icon: ExternalLink, min: "admin" },
        { label: "Users & roles", href: "/admin/users", icon: Shield, min: "admin" },
        { label: "Activity log", href: "/admin/audit", icon: ScrollText, min: "admin" },
      ],
    },
  ];
}

export function AdminShell({ user, counts, children }: { user: AdminUser; counts?: Record<string, number>; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [userMenu, setUserMenu] = React.useState(false);
  const nav = buildNav(counts);
  const lastPath = React.useRef(pathname);
  React.useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const signOut = async () => {
    await createClient().auth.signOut();
    startTopLoader();
    router.replace("/admin/login");
    router.refresh();
  };

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Admin">
      <div className="flex h-16 items-center gap-3 px-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap className="h-5 w-5" /></span>
          <span className="font-display text-base font-extrabold text-white">iCET <span className="font-semibold text-slate-400">Admin</span></span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
        {nav.map((g) => {
          const items = g.items.filter((i) => !i.min || RANK[user.role] >= RANK[i.min]);
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.title}</p>
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <li key={it.href}>
                      <Link href={it.href} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition", active ? "bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgb(4,107,210,0.8)]" : "text-slate-300 hover:bg-white/8 hover:text-white")}>
                        <it.icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
                        <span className="truncate">{it.label}</span>
                        {it.badge ? <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-bold", active ? "bg-white/20" : "bg-brand-600 text-white")}>{it.badge}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-slate-300 hover:bg-white/8 hover:text-white"><ExternalLink className="h-4.5 w-4.5 text-slate-400" /> View live site</a>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-navy lg:block">{sidebar}</aside>
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-navy/60 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cn("absolute inset-y-0 left-0 w-72 bg-navy transition-transform", open ? "translate-x-0" : "-translate-x-full")}>{sidebar}</aside>
      </div>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><MenuIcon className="h-5 w-5" /></button>
          <form action="/admin/search" className="relative hidden flex-1 max-w-md md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" placeholder="Search students, applications, pages…" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" aria-haspopup="menu" aria-expanded={userMenu}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{(user.full_name || user.email).charAt(0).toUpperCase()}</span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-900">{user.full_name || user.email}</span>
                  <span className="block text-[11px] capitalize leading-tight text-slate-500">{user.role.replace("_", " ")}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-elev" role="menu" onMouseLeave={() => setUserMenu(false)}>
                  <Link href="/admin/profile" className="block px-4 py-2 text-sm hover:bg-slate-50" role="menuitem">My profile & password</Link>
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" role="menuitem"><LogOut className="h-4 w-4" /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
