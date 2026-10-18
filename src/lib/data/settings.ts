import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/lib/db";
import { TAGS } from "@/lib/cache";

export type SiteSettings = {
  site_name: string;
  tagline: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  phone: string;
  phone_display: string;
  whatsapp: string;
  whatsapp_message: string;
  whatsapp_channel_url: string;
  email: string;
  email_academics: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  country: string;
  map_url: string;
  map_embed_url: string;
  opening_hours: string;
  tvec_reg_no: string;
  founded_year: number;
  lms_url: string;
  social: { facebook?: string; youtube?: string; linkedin?: string; instagram?: string; tiktok?: string; whatsapp?: string; x?: string };
  footer_about: string;
  footer_copyright: string;
  announcement: { enabled: boolean; text: string; link_label?: string; link_url?: string; tone?: "brand" | "navy" | "green" };
  seo: { default_title: string; title_template: string; default_description: string; default_og_image: string; keywords: string[]; twitter_handle?: string };
  analytics: { ga4_id?: string; gtm_id?: string; fb_pixel_id?: string; clarity_id?: string; google_site_verification?: string };
  stats: { professionals_trained: number; years_excellence: number; current_students: number; partners: number; placement_rate?: string };
  google_review_url: string;
  bank_details: string;
  apply: { intake_label: string; intake_subtitle: string; success_message: string; notify_emails: string[] };
};

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "iCET - Institute of Computer Engineering Technology",
  tagline: "Institute of Computer Engineering Technology",
  logo_url: "",
  logo_dark_url: "",
  favicon_url: "",
  phone: "+94705805805",
  phone_display: "+94 705 805 805",
  whatsapp: "94705805805",
  whatsapp_message: "Hi, I checked the iCET website and I'm interested in learning more about your programs. Could you please share more details? Thank you.",
  whatsapp_channel_url: "https://www.whatsapp.com/channel/0029Vat41Aq8kyyHNCRS1P3x",
  email: "info@icet.lk",
  email_academics: "academics@icet.lk",
  address_line1: "223 A, Galle Road",
  address_line2: "",
  city: "Panadura",
  postal_code: "12500",
  country: "Sri Lanka",
  map_url: "https://maps.app.goo.gl/7wqxvdvcG9wcUS4A7",
  map_embed_url: "",
  opening_hours: "Mon - Sun: 8:30 AM - 5:30 PM",
  tvec_reg_no: "P03/0177",
  founded_year: 2004,
  lms_url: "https://icetlms.lk/login/index.php",
  social: {
    facebook: "https://www.facebook.com/iCETSriLanka",
    youtube: "https://www.youtube.com/@instituteofcomputerengineering",
    linkedin: "https://www.linkedin.com/company/icetsrilanka",
    instagram: "https://www.instagram.com/icet_srilanka/",
  },
  footer_about: "Empowering the next generation of technology professionals through innovative education and industry-relevant training.",
  footer_copyright: "© {year} Institute of Computer Engineering Technology. All rights reserved.",
  announcement: { enabled: false, text: "", tone: "brand" },
  seo: {
    default_title: "Software Engineering Courses in Sri Lanka | iCET - Institute of Computer Engineering Technology",
    title_template: "%s | iCET - Institute of Computer Engineering Technology",
    default_description: "Enroll in industry-aligned Software Engineering courses in Sri Lanka at iCET. Gain expert guidance, hands-on training, and real-world project experience.",
    default_og_image: "",
    keywords: ["software engineering courses sri lanka", "IT courses sri lanka", "iCET", "diploma in software engineering"],
  },
  analytics: {},
  stats: { professionals_trained: 15000, years_excellence: 21, current_students: 1000, partners: 50 },
  google_review_url: "https://g.page/r/CXAU5HxS42BAEBM/review",
  bank_details: "",
  apply: { intake_label: "2026 SEPTEMBER INTAKE", intake_subtitle: "Advanced Professional Programs in Software Engineering with AI", success_message: "Thank you! Our student counsellor will contact you shortly.", notify_emails: ["info@icet.lk"] },
};

function deepMerge<T>(base: T, patch: Partial<T> | undefined): T {
  if (!patch) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v as never);
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out as T;
}

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  const rows = await sql<{ key: string; value: unknown }[]>`select key, value from public.site_settings where is_public`;
  const stored = rows.find((r) => r.key === "site")?.value as Partial<SiteSettings> | undefined;
  return deepMerge(DEFAULT_SETTINGS, stored);
}

/** Uncached, server-only read for admin screens (includes private keys). */
export async function getSettingRaw<T = unknown>(key: string): Promise<T | null> {
  const rows = await sql<{ value: T }[]>`select value from public.site_settings where key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function getSiteSettingsUncached(): Promise<SiteSettings> {
  const stored = await getSettingRaw<Partial<SiteSettings>>("site");
  return deepMerge(DEFAULT_SETTINGS, stored ?? undefined);
}

export type NavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  icon?: string;
  badge?: string;
  external?: boolean;
  highlight?: boolean;
  children?: NavItem[];
  mega?: "programs" | null;
};

export const DEFAULT_HEADER_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/" },
  {
    id: "programmes", label: "Programmes", href: "/professional-it-courses-in-sri-lanka", mega: "programs",
    children: [
      { id: "all", label: "All Professional Programmes", href: "/professional-it-courses-in-sri-lanka", description: "Compare iCM, iCD and iCP side by side" },
      { id: "icm", label: "iCET Certified Master", href: "/software-development-course-university-students", description: "Certificate in Software Development · 6 months" },
      { id: "icd", label: "iCET Certified Developer", href: "/icet-certified-developer", description: "Diploma in Software Engineering · 1 year" },
      { id: "icp", label: "iCET Certified Professional", href: "/icet-certified-professionals", description: "Higher Diploma in Computer Engineering with Applied AI · 2 years" },
    ],
  },
  {
    id: "about", label: "About", href: "/about",
    children: [
      { id: "about", label: "About iCET", href: "/about", description: "Our legacy since 2004" },
      { id: "trainers", label: "Trainers", href: "/trainers", description: "Panel of expert lecturers" },
      { id: "placement", label: "Industry Placement", href: "/industry-placement", description: "Internships & alumni network" },
      { id: "life", label: "Student Life", href: "/student-life", description: "Campus, clubs & gallery" },
    ],
  },
  { id: "events", label: "Events", href: "/events" },
  { id: "blogs", label: "Blogs", href: "/blogs" },
  { id: "contact", label: "Contact", href: "/contact-us" },
];

export const DEFAULT_FOOTER_NAV: Record<string, NavItem[]> = {
  footer_quick: [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About Us", href: "/about" },
    { id: "programs", label: "Programmes", href: "/professional-it-courses-in-sri-lanka" },
    { id: "apply", label: "Apply Now", href: "/apply" },
    { id: "contact", label: "Contact Us", href: "/contact-us" },
    { id: "verify", label: "Certificate Verification", href: "/verify-certificate" },
    { id: "events", label: "Events & Workshops", href: "/events" },
  ],
  footer_programs: [
    { id: "icm", label: "iCET Certified Master", href: "/software-development-course-university-students" },
    { id: "icd", label: "iCET Certified Developer", href: "/icet-certified-developer" },
    { id: "icp", label: "iCET Certified Professional", href: "/icet-certified-professionals" },
    { id: "placement", label: "Industry Placement", href: "/industry-placement" },
    { id: "workshops", label: "Workshops", href: "/events" },
    { id: "lms", label: "Student Portal (LMS)", href: "https://icetlms.lk/login/index.php", external: true },
  ],
  footer_legal: [
    { id: "privacy", label: "Privacy Policy", href: "/privacy-policy" },
    { id: "terms", label: "Terms & Conditions", href: "/terms-and-conditions" },
    { id: "cookies", label: "Cookie Policy", href: "/cookie-policy" },
    { id: "sitemap", label: "Sitemap", href: "/sitemap.xml", external: true },
  ],
};

export async function getNavigation(): Promise<{ header: NavItem[]; footer: Record<string, NavItem[]> }> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.nav);
  const rows = await sql<{ slug: string; items: NavItem[] }[]>`select slug, items from public.navigation_menus`;
  const map = Object.fromEntries(rows.map((r) => [r.slug, r.items]));
  return {
    header: (map.header?.length ? map.header : DEFAULT_HEADER_NAV) as NavItem[],
    footer: {
      footer_quick: map.footer_quick?.length ? map.footer_quick : DEFAULT_FOOTER_NAV.footer_quick,
      footer_programs: map.footer_programs?.length ? map.footer_programs : DEFAULT_FOOTER_NAV.footer_programs,
      footer_legal: map.footer_legal?.length ? map.footer_legal : DEFAULT_FOOTER_NAV.footer_legal,
    },
  };
}
