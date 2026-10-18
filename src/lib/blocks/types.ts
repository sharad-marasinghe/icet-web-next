/**
 * Page block model. A page is an ordered list of blocks; every block carries
 * shared `settings` plus type-specific `data`. The admin editor renders forms
 * from the FieldSpec registry in ./registry.ts, and the public renderer maps
 * `type` to a React component in components/blocks.
 */
export type Tone = "white" | "light" | "navy" | "brand" | "gradient" | "grid";

export type Link = { label: string; href: string; variant?: "primary" | "secondary" | "outline" | "white" | "ghost" | "accent" };
export type ImageRef = { url: string; alt?: string; width?: number; height?: number };

export type BlockSettings = {
  tone?: Tone;
  anchor?: string;
  hidden?: boolean;
  size?: "md" | "sm";
  className?: string;
};

export type BlockBase<T extends string, D> = { id: string; type: T; settings?: BlockSettings; data: D };

export type HeroSlide = { image: ImageRef; title?: string; subtitle?: string; href?: string; label?: string };
export type HeroData = {
  layout: "split" | "centered" | "carousel";
  eyebrow?: string;
  title: string;
  rotating?: string[];        // words that rotate after the title ("Software Engineering", "Applied AI"…)
  subtitle?: string;
  primary_cta?: Link;
  secondary_cta?: Link;
  image?: ImageRef;
  slides?: HeroSlide[];
  badges?: { icon?: string; label: string }[];
  stats?: { value: string; label: string }[];
  trust?: string;             // small line under CTAs, e.g. "TVEC Registered · 15,000+ alumni"
};

export type PageHeroData = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: ImageRef;
  align?: "left" | "center";
  ctas?: Link[];
  breadcrumbs?: boolean;
  compact?: boolean;
};

export type FeatureItem = { icon?: string; title: string; description?: string; href?: string; image?: ImageRef };
export type FeaturesData = { eyebrow?: string; title?: string; description?: string; columns?: 2 | 3 | 4; style?: "cards" | "minimal" | "icon-left" | "numbered"; items: FeatureItem[]; cta?: Link };

export type ProgramsData = { eyebrow?: string; title?: string; description?: string; codes?: string[]; style?: "cards" | "compare" | "detailed"; cta?: Link };

export type SplitData = {
  eyebrow?: string; title: string; body?: string; image?: ImageRef; image_side?: "left" | "right";
  bullets?: { icon?: string; title: string; text?: string }[]; ctas?: Link[]; stats?: { value: string; label: string }[];
  badge?: string; video_url?: string;
};

export type StatsData = { eyebrow?: string; title?: string; description?: string; items: { value: number | string; suffix?: string; prefix?: string; label: string; icon?: string }[]; cta?: Link; style?: "cards" | "inline" };

export type TestimonialsData = { eyebrow?: string; title?: string; description?: string; source?: string; limit?: number; layout?: "carousel" | "grid" | "featured"; cta?: Link };

export type PartnersData = { eyebrow?: string; title?: string; description?: string; category?: string; style?: "marquee" | "grid"; cta?: Link };

export type CtaData = { eyebrow?: string; title: string; description?: string; primary_cta?: Link; secondary_cta?: Link; image?: ImageRef; bullets?: string[]; style?: "banner" | "card" | "split" };

export type CardsData = { eyebrow?: string; title?: string; description?: string; columns?: 2 | 3 | 4; items: { image?: ImageRef; icon?: string; title: string; description?: string; cta?: Link; badge?: string }[]; style?: "image-top" | "overlay" | "compact" };

export type FaqData = { eyebrow?: string; title?: string; description?: string; group_slug: string; limit?: number; layout?: "accordion" | "two-column"; cta?: Link };

export type RichTextData = { html: string; width?: "narrow" | "wide" | "full" };

export type GalleryData = { eyebrow?: string; title?: string; description?: string; albums?: string[]; layout?: "masonry" | "grid" | "carousel" | "albums"; limit?: number; cta?: Link };

export type VideosData = { eyebrow?: string; title?: string; description?: string; collection?: string; limit?: number; layout?: "grid" | "featured" };

export type TrainersData = { eyebrow?: string; title?: string; description?: string; featured_only?: boolean; show_bio?: boolean; limit?: number; cta?: Link; layout?: "grid" | "spotlight" };

export type StepsData = { eyebrow?: string; title?: string; description?: string; items: { title: string; description?: string; icon?: string; bullets?: string[] }[]; layout?: "horizontal" | "vertical" | "timeline"; numbered?: boolean; cta?: Link; note?: string };

export type PricingPlan = {
  name: string; badge?: string; price?: string; original_price?: string; period?: string; description?: string;
  features?: string[]; installments?: { label: string; amount: string }[]; total?: string; cta?: Link; highlight?: boolean; note?: string;
};
export type PricingData = { eyebrow?: string; title?: string; description?: string; groups?: { title: string; subtitle?: string; plans: PricingPlan[] }[]; plans?: PricingPlan[]; note?: string };

export type CurriculumLevel = { title: string; subtitle?: string; duration?: string; modules: string[]; outcome?: string; icon?: string };
export type CurriculumData = { eyebrow?: string; title?: string; description?: string; levels: CurriculumLevel[]; style?: "tabs" | "accordion" | "grid" | "roadmap"; note?: string; cta?: Link };

export type EventsData = { eyebrow?: string; title?: string; description?: string; limit?: number; upcoming_only?: boolean; category?: string; cta?: Link; layout?: "grid" | "list" | "featured" };
export type PostsData = { eyebrow?: string; title?: string; description?: string; limit?: number; cta?: Link };
export type WorkshopsData = { eyebrow?: string; title?: string; description?: string; limit?: number };

export type ContactData = { eyebrow?: string; title?: string; description?: string; show_form?: boolean; show_map?: boolean; show_faq_slug?: string; form_title?: string; form_description?: string };

export type FormKind = "apply" | "contact" | "workshop" | "batch" | "feedback" | "verify" | "inquiry";
export type FormData = {
  kind: FormKind; title?: string; description?: string; eyebrow?: string;
  workshop_slug?: string; batch_slug?: string; feedback_slug?: string; program_code?: string;
  success_message?: string; sidebar?: boolean; show_header?: boolean; image?: ImageRef;
};

export type QuoteData = { eyebrow?: string; title?: string; quote: string; name: string; role?: string; meta?: string; image?: ImageRef; sections?: { title: string; text: string }[]; cta?: Link };

export type EmbedData = { title?: string; html: string; height?: number };

export type AnchorNavData = { items: { label: string; anchor: string }[]; cta?: Link };

export type TabsData = { eyebrow?: string; title?: string; items: { title: string; html: string; icon?: string }[] };

export type BannerData = { image: ImageRef; title?: string; subtitle?: string; cta?: Link; height?: "sm" | "md" | "lg"; overlay?: boolean };

export type Block =
  | BlockBase<"hero", HeroData>
  | BlockBase<"page_hero", PageHeroData>
  | BlockBase<"features", FeaturesData>
  | BlockBase<"programs", ProgramsData>
  | BlockBase<"split", SplitData>
  | BlockBase<"stats", StatsData>
  | BlockBase<"testimonials", TestimonialsData>
  | BlockBase<"partners", PartnersData>
  | BlockBase<"cta", CtaData>
  | BlockBase<"cards", CardsData>
  | BlockBase<"faq", FaqData>
  | BlockBase<"rich_text", RichTextData>
  | BlockBase<"gallery", GalleryData>
  | BlockBase<"videos", VideosData>
  | BlockBase<"trainers", TrainersData>
  | BlockBase<"steps", StepsData>
  | BlockBase<"pricing", PricingData>
  | BlockBase<"curriculum", CurriculumData>
  | BlockBase<"events", EventsData>
  | BlockBase<"posts", PostsData>
  | BlockBase<"workshops", WorkshopsData>
  | BlockBase<"contact", ContactData>
  | BlockBase<"form", FormData>
  | BlockBase<"quote", QuoteData>
  | BlockBase<"embed", EmbedData>
  | BlockBase<"anchor_nav", AnchorNavData>
  | BlockBase<"tabs", TabsData>
  | BlockBase<"banner", BannerData>;

export type BlockType = Block["type"];

export type PageSeo = {
  title?: string;
  description?: string;
  og_image?: string;
  canonical?: string;
  noindex?: boolean;
  keywords?: string[];
  schema?: Record<string, unknown> | Record<string, unknown>[];
  faq_group_slug?: string; // emit FAQPage schema from this group
};

export type PageRecord = {
  id: string;
  slug: string;
  title: string;
  template: string;
  blocks: Block[];
  seo: PageSeo;
  status: "draft" | "published" | "archived";
  show_in_search: boolean;
  published_at: string | null;
  updated_at: string;
};

export function newBlockId() {
  return "b_" + Math.random().toString(36).slice(2, 10);
}
