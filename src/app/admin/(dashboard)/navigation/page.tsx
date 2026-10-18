import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DEFAULT_FOOTER_NAV, DEFAULT_HEADER_NAV, type NavItem } from "@/lib/data/settings";
import { PageHeader } from "@/components/admin/ui";
import { NavEditor, type SlugOption } from "@/components/admin/system/nav-editor";

export const metadata: Metadata = { title: "Navigation" };

const STATIC_ROUTES: SlugOption[] = [
  { label: "Home", href: "/", group: "Static" },
  { label: "Events", href: "/events", group: "Static" },
  { label: "Blogs", href: "/blogs", group: "Static" },
  { label: "Apply", href: "/apply", group: "Static" },
  { label: "Verify certificate", href: "/verify-certificate", group: "Static" },
  { label: "Contact us", href: "/contact-us", group: "Static" },
];

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NavigationPage() {
  await connection();
  await requireUser("admin");
  const [menus, pages, programs] = await Promise.all([
    sql<{ slug: string; items: NavItem[]; updated_at: string }[]>`select slug, items, updated_at::text from public.navigation_menus`,
    sql<{ slug: string; title: string }[]>`select slug, title from public.pages where status <> 'archived' order by title`,
    sql<{ slug: string; name: string; code: string }[]>`select slug, name, code from public.programs where is_active order by sort_order, code`,
  ]);
  const stored = Object.fromEntries(menus.map((m) => [m.slug, m]));
  const defaults: Record<string, NavItem[]> = { header: DEFAULT_HEADER_NAV, ...DEFAULT_FOOTER_NAV };
  const initial: Record<string, NavItem[]> = {};
  const updated: Record<string, string | null> = {};
  for (const slug of ["header", "footer_quick", "footer_programs", "footer_legal"]) {
    initial[slug] = stored[slug]?.items?.length ? stored[slug].items : defaults[slug];
    updated[slug] = stored[slug]?.updated_at ?? null;
  }
  const options: SlugOption[] = [
    ...STATIC_ROUTES,
    ...pages.filter((p) => !STATIC_ROUTES.some((s) => s.href === (p.slug === "home" ? "/" : `/${p.slug}`))).map((p) => ({ label: p.title, href: p.slug === "home" ? "/" : `/${p.slug}`, group: "Pages" })),
    ...programs.map((p) => ({ label: `${p.name} (${p.code})`, href: `/${p.slug}`, group: "Programmes" })),
  ];
  return (
    <>
      <PageHeader title="Navigation" description="Edit the header menu and the three footer link lists. Drag to reorder; changes go live when you save." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Navigation" }]} />
      <NavEditor initial={initial} defaults={defaults} updated={updated} options={options} />
    </>
  );
}
