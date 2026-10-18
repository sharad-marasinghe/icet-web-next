"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { assertRole, audit } from "@/lib/auth";
import { bust } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache";
import { DEFAULT_FOOTER_NAV, DEFAULT_HEADER_NAV, type NavItem } from "@/lib/data/settings";
import type { ActionState } from "@/components/admin/ui";

import { MENU_SLUGS, MENU_TITLES, type MenuSlug } from "@/components/admin/system/nav-types";

const href = z.string().trim().min(1, "Link is required").max(600).refine((v) => /^(https?:\/\/|\/|mailto:|tel:|#)/i.test(v), "Must be a path starting with / or a full URL");
const leaf = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1, "Label is required").max(80),
  href,
  description: z.string().trim().max(160).optional(),
  icon: z.string().trim().max(60).regex(/^[A-Za-z0-9]*$/, "Use the lucide icon name, e.g. GraduationCap").optional(),
  badge: z.string().trim().max(30).optional(),
  external: z.boolean().optional(),
  highlight: z.boolean().optional(),
  mega: z.enum(["programs"]).nullable().optional(),
});
const item = leaf.extend({ children: z.array(leaf).max(30).optional() });
const itemsSchema = z.array(item).max(40);

function clean(items: z.infer<typeof itemsSchema>): NavItem[] {
  const strip = (n: z.infer<typeof leaf>): NavItem => {
    const out: NavItem = { id: n.id, label: n.label, href: n.href };
    if (n.description) out.description = n.description;
    if (n.icon) out.icon = n.icon;
    if (n.badge) out.badge = n.badge;
    if (n.external) out.external = true;
    if (n.highlight) out.highlight = true;
    if (n.mega) out.mega = n.mega;
    return out;
  };
  return items.map((n) => {
    const out = strip(n);
    if (n.children?.length) out.children = n.children.map(strip);
    return out;
  });
}

export async function saveMenu(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertRole("admin");
  const slug = String(formData.get("slug") || "") as MenuSlug;
  if (!MENU_SLUGS.includes(slug)) return { ok: false, message: "Unknown menu." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    return { ok: false, message: "Could not read the menu data." };
  }
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.join(".")] = i.message;
    return { ok: false, message: "Please fix the highlighted items.", errors };
  }
  if (slug !== "header" && parsed.data.some((n) => n.children?.length)) return { ok: false, message: "Footer menus cannot have sub-items." };
  const ids = new Set<string>();
  for (const n of parsed.data) {
    if (ids.has(n.id)) return { ok: false, message: `Duplicate item id "${n.id}".` };
    ids.add(n.id);
  }
  const items = clean(parsed.data);
  await sql`insert into public.navigation_menus (slug, title, items, updated_at) values (${slug}, ${MENU_TITLES[slug]}, ${sql.json(items as never)}, now())
    on conflict (slug) do update set items = excluded.items, title = excluded.title, updated_at = now()`;
  bust(TAGS.nav);
  await audit(user, "update", "navigation_menu", slug, { count: items.length });
  return { ok: true, message: `${MENU_TITLES[slug]} menu saved.` };
}

export async function resetMenu(slug: MenuSlug): Promise<ActionState> {
  const user = await assertRole("admin");
  if (!MENU_SLUGS.includes(slug)) return { ok: false, message: "Unknown menu." };
  const items = slug === "header" ? DEFAULT_HEADER_NAV : DEFAULT_FOOTER_NAV[slug];
  await sql`insert into public.navigation_menus (slug, title, items, updated_at) values (${slug}, ${MENU_TITLES[slug]}, ${sql.json(items as never)}, now())
    on conflict (slug) do update set items = excluded.items, updated_at = now()`;
  bust(TAGS.nav);
  await audit(user, "reset", "navigation_menu", slug);
  return { ok: true, message: `${MENU_TITLES[slug]} menu reset to defaults.` };
}
