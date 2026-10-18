export const MENU_SLUGS = ["header", "footer_quick", "footer_programs", "footer_legal"] as const;
export type MenuSlug = (typeof MENU_SLUGS)[number];
export const MENU_TITLES: Record<MenuSlug, string> = { header: "Header", footer_quick: "Footer · Quick links", footer_programs: "Footer · Programmes", footer_legal: "Footer · Legal" };
