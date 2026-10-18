import type { Block, BlockType } from "./types";

/** Declarative form schema used by the admin block editor. */
export type FieldSpec =
  | { key: string; label: string; type: "text" | "textarea" | "richtext" | "url" | "number" | "color" | "icon" | "boolean" | "tags" | "image" | "link"; help?: string; placeholder?: string; required?: boolean; width?: "full" | "half" }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string; width?: "full" | "half" }
  | { key: string; label: string; type: "ref"; entity: "faq_group" | "gallery_album" | "workshop" | "batch" | "feedback_form" | "program" | "event_category" | "video_collection" | "partner_category"; help?: string; multiple?: boolean; width?: "full" | "half" }
  | { key: string; label: string; type: "list"; help?: string; itemLabel?: string; fields: FieldSpec[]; max?: number };

export type BlockDef = {
  type: BlockType;
  label: string;
  group: "Hero" | "Content" | "Collections" | "Conversion" | "Programme" | "Media" | "Forms";
  description: string;
  icon: string; // lucide icon name
  fields: FieldSpec[];
  defaults: Record<string, unknown>;
};

const H = (extra: FieldSpec[] = []): FieldSpec[] => [
  { key: "eyebrow", label: "Eyebrow", type: "text", width: "half", placeholder: "SMALL LABEL ABOVE TITLE" },
  { key: "title", label: "Title", type: "text" },
  { key: "description", label: "Description", type: "textarea" },
  ...extra,
];
const CTA = (key = "cta", label = "Button"): FieldSpec => ({ key, label, type: "link" });
const LINK_FIELDS: FieldSpec[] = [
  { key: "label", label: "Label", type: "text", width: "half" },
  { key: "href", label: "Link", type: "url", width: "half" },
  { key: "variant", label: "Style", type: "select", options: ["primary", "secondary", "outline", "white", "ghost", "accent"].map((v) => ({ value: v, label: v })), width: "half" },
];
const IMAGE: FieldSpec = { key: "image", label: "Image", type: "image" };

export const BLOCK_REGISTRY: Record<BlockType, BlockDef> = {
  hero: {
    type: "hero", label: "Home Hero", group: "Hero", icon: "Sparkles",
    description: "Large landing hero with rotating words, CTAs, badges and optional slides.",
    fields: [
      { key: "layout", label: "Layout", type: "select", options: [{ value: "split", label: "Split (text + image)" }, { value: "centered", label: "Centered" }, { value: "carousel", label: "Image carousel" }], width: "half" },
      { key: "eyebrow", label: "Eyebrow", type: "text", width: "half" },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "rotating", label: "Rotating words", type: "tags", help: "Shown after the title and animated one by one." },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      CTA("primary_cta", "Primary button"), CTA("secondary_cta", "Secondary button"),
      IMAGE,
      { key: "slides", label: "Slides (carousel layout)", type: "list", itemLabel: "Slide", fields: [IMAGE, { key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }, { key: "href", label: "Link", type: "url" }, { key: "label", label: "Button label", type: "text" }] },
      { key: "badges", label: "Badges", type: "list", itemLabel: "Badge", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "label", label: "Label", type: "text", width: "half" }] },
      { key: "stats", label: "Inline stats", type: "list", itemLabel: "Stat", fields: [{ key: "value", label: "Value", type: "text", width: "half" }, { key: "label", label: "Label", type: "text", width: "half" }] },
      { key: "trust", label: "Trust line", type: "text" },
    ],
    defaults: { layout: "split", title: "Forge Your Career in", rotating: ["Software Engineering", "Applied AI", "Cloud Architecture"], primary_cta: { label: "Apply Now", href: "/apply" }, secondary_cta: { label: "Explore Programmes", href: "/professional-it-courses-in-sri-lanka", variant: "white" } },
  },
  page_hero: {
    type: "page_hero", label: "Page Header", group: "Hero", icon: "Heading1",
    description: "Compact page title band with breadcrumbs and optional image.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", width: "half" },
      { key: "align", label: "Alignment", type: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }], width: "half" },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      IMAGE,
      { key: "ctas", label: "Buttons", type: "list", itemLabel: "Button", fields: LINK_FIELDS, max: 3 },
      { key: "breadcrumbs", label: "Show breadcrumbs", type: "boolean", width: "half" },
      { key: "compact", label: "Compact height", type: "boolean", width: "half" },
    ],
    defaults: { title: "Page title", breadcrumbs: true, align: "left" },
  },
  features: {
    type: "features", label: "Feature Grid", group: "Content", icon: "LayoutGrid",
    description: "Icon + title + text cards in 2–4 columns.",
    fields: H([
      { key: "columns", label: "Columns", type: "select", options: [2, 3, 4].map((n) => ({ value: String(n), label: `${n} columns` })), width: "half" },
      { key: "style", label: "Style", type: "select", options: [{ value: "cards", label: "Cards" }, { value: "minimal", label: "Minimal" }, { value: "icon-left", label: "Icon left" }, { value: "numbered", label: "Numbered" }], width: "half" },
      { key: "items", label: "Items", type: "list", itemLabel: "Feature", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "description", label: "Description", type: "textarea" }, { key: "href", label: "Link (optional)", type: "url" }, IMAGE] },
      CTA(),
    ]),
    defaults: { columns: 4, style: "cards", items: [] },
  },
  programs: {
    type: "programs", label: "Programme Cards", group: "Programme", icon: "GraduationCap",
    description: "Cards or comparison table generated from the Programmes module.",
    fields: H([
      { key: "style", label: "Style", type: "select", options: [{ value: "cards", label: "Cards" }, { value: "detailed", label: "Detailed cards" }, { value: "compare", label: "Comparison table" }], width: "half" },
      { key: "codes", label: "Limit to programme codes", type: "tags", help: "Leave empty for all active programmes (e.g. iCM, iCD, iCP)." },
      CTA(),
    ]),
    defaults: { style: "cards", eyebrow: "Learning paths", title: "Transformative Learning Paths" },
  },
  split: {
    type: "split", label: "Image + Text", group: "Content", icon: "Columns2",
    description: "Two-column section with image, rich text, bullets and buttons.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", width: "half" },
      { key: "badge", label: "Badge on image", type: "text", width: "half" },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Body", type: "richtext" },
      IMAGE,
      { key: "video_url", label: "YouTube URL (replaces image)", type: "url" },
      { key: "image_side", label: "Image side", type: "select", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }], width: "half" },
      { key: "bullets", label: "Bullets", type: "list", itemLabel: "Bullet", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "text", label: "Text", type: "textarea" }] },
      { key: "stats", label: "Stats", type: "list", itemLabel: "Stat", fields: [{ key: "value", label: "Value", type: "text", width: "half" }, { key: "label", label: "Label", type: "text", width: "half" }] },
      { key: "ctas", label: "Buttons", type: "list", itemLabel: "Button", fields: LINK_FIELDS, max: 3 },
    ],
    defaults: { title: "Section title", image_side: "left", bullets: [], ctas: [] },
  },
  stats: {
    type: "stats", label: "Statistics", group: "Content", icon: "BarChart3",
    description: "Animated counters (15,000+ professionals, 20+ years…).",
    fields: H([
      { key: "style", label: "Style", type: "select", options: [{ value: "cards", label: "Cards" }, { value: "inline", label: "Inline" }], width: "half" },
      { key: "items", label: "Stats", type: "list", itemLabel: "Stat", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "value", label: "Value (number)", type: "text", width: "half" }, { key: "prefix", label: "Prefix", type: "text", width: "half" }, { key: "suffix", label: "Suffix", type: "text", width: "half" }, { key: "label", label: "Label", type: "text" }] },
      CTA(),
    ]),
    defaults: { style: "cards", items: [{ value: 15000, suffix: "+", label: "IT Professionals Trained" }, { value: 20, suffix: "+", label: "Years of Excellence" }, { value: 1000, suffix: "+", label: "Current Students" }] },
  },
  testimonials: {
    type: "testimonials", label: "Testimonials", group: "Collections", icon: "Quote",
    description: "Alumni success stories from the Testimonials module.",
    fields: H([
      { key: "layout", label: "Layout", type: "select", options: [{ value: "carousel", label: "Carousel" }, { value: "grid", label: "Grid" }, { value: "featured", label: "Featured" }], width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
      { key: "source", label: "Filter by programme code", type: "text", help: "Leave empty for all." },
      CTA(),
    ]),
    defaults: { layout: "carousel", limit: 8, eyebrow: "Alumni testimonials", title: "iCET Student Success Stories" },
  },
  partners: {
    type: "partners", label: "Partner Logos", group: "Collections", icon: "Handshake",
    description: "Industry partner logos as marquee or grid.",
    fields: H([
      { key: "style", label: "Style", type: "select", options: [{ value: "marquee", label: "Marquee" }, { value: "grid", label: "Grid" }], width: "half" },
      { key: "category", label: "Category", type: "ref", entity: "partner_category", width: "half" },
      CTA(),
    ]),
    defaults: { style: "marquee", eyebrow: "Trusted by industry", title: "Our Official Industry Partners" },
  },
  cta: {
    type: "cta", label: "Call to Action", group: "Conversion", icon: "Megaphone",
    description: "Prominent banner driving to Apply / Contact.",
    fields: H([
      { key: "style", label: "Style", type: "select", options: [{ value: "banner", label: "Banner" }, { value: "card", label: "Card" }, { value: "split", label: "Split with image" }], width: "half" },
      CTA("primary_cta", "Primary button"), CTA("secondary_cta", "Secondary button"), IMAGE,
      { key: "bullets", label: "Bullets", type: "tags" },
    ]),
    defaults: { style: "banner", title: "Empowering the Next Generation of Software Engineers", primary_cta: { label: "Apply Now", href: "/apply", variant: "white" } },
  },
  cards: {
    type: "cards", label: "Image Cards", group: "Content", icon: "Images",
    description: "Cards with image/icon, text and a button (e.g. enrollment pathways).",
    fields: H([
      { key: "columns", label: "Columns", type: "select", options: [2, 3, 4].map((n) => ({ value: String(n), label: `${n} columns` })), width: "half" },
      { key: "style", label: "Style", type: "select", options: [{ value: "image-top", label: "Image top" }, { value: "overlay", label: "Image overlay" }, { value: "compact", label: "Compact" }], width: "half" },
      { key: "items", label: "Cards", type: "list", itemLabel: "Card", fields: [IMAGE, { key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "badge", label: "Badge", type: "text", width: "half" }, { key: "title", label: "Title", type: "text" }, { key: "description", label: "Description", type: "textarea" }, CTA()] },
    ]),
    defaults: { columns: 3, style: "image-top", items: [] },
  },
  faq: {
    type: "faq", label: "FAQ", group: "Collections", icon: "CircleHelp",
    description: "Accordion from an FAQ group. Emits FAQPage structured data.",
    fields: H([
      { key: "group_slug", label: "FAQ group", type: "ref", entity: "faq_group", width: "half" },
      { key: "layout", label: "Layout", type: "select", options: [{ value: "accordion", label: "Accordion" }, { value: "two-column", label: "Two columns" }], width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
      CTA(),
    ]),
    defaults: { group_slug: "general", layout: "accordion", eyebrow: "FAQ", title: "Frequently Asked Questions" },
  },
  rich_text: {
    type: "rich_text", label: "Rich Text", group: "Content", icon: "Type",
    description: "Free-form formatted content.",
    fields: [
      { key: "width", label: "Width", type: "select", options: [{ value: "narrow", label: "Narrow (reading width)" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }], width: "half" },
      { key: "html", label: "Content", type: "richtext" },
    ],
    defaults: { width: "narrow", html: "<p>Start writing…</p>" },
  },
  gallery: {
    type: "gallery", label: "Photo Gallery", group: "Media", icon: "Image",
    description: "Images from one or more gallery albums with lightbox.",
    fields: H([
      { key: "albums", label: "Albums", type: "ref", entity: "gallery_album", multiple: true, help: "Leave empty for all albums." },
      { key: "layout", label: "Layout", type: "select", options: [{ value: "masonry", label: "Masonry" }, { value: "grid", label: "Grid" }, { value: "carousel", label: "Carousel" }, { value: "albums", label: "Album cards" }], width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
      CTA(),
    ]),
    defaults: { layout: "masonry", limit: 24 },
  },
  videos: {
    type: "videos", label: "Video Gallery", group: "Media", icon: "PlayCircle",
    description: "YouTube videos from a collection.",
    fields: H([
      { key: "collection", label: "Collection", type: "ref", entity: "video_collection", width: "half" },
      { key: "layout", label: "Layout", type: "select", options: [{ value: "grid", label: "Grid" }, { value: "featured", label: "Featured + list" }], width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
    ]),
    defaults: { collection: "student_life", layout: "grid", limit: 6 },
  },
  trainers: {
    type: "trainers", label: "Trainers", group: "Collections", icon: "Users",
    description: "Panel of lecturers from the Trainers module.",
    fields: H([
      { key: "layout", label: "Layout", type: "select", options: [{ value: "grid", label: "Grid" }, { value: "spotlight", label: "Founder spotlight + grid" }], width: "half" },
      { key: "featured_only", label: "Featured only", type: "boolean", width: "half" },
      { key: "show_bio", label: "Show bios", type: "boolean", width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
      CTA(),
    ]),
    defaults: { layout: "spotlight", show_bio: true, eyebrow: "Faculty", title: "Panel of Expert Trainers" },
  },
  steps: {
    type: "steps", label: "Steps / Timeline", group: "Content", icon: "ListOrdered",
    description: "Numbered process (admissions, registration, journey).",
    fields: H([
      { key: "layout", label: "Layout", type: "select", options: [{ value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }, { value: "timeline", label: "Timeline" }], width: "half" },
      { key: "numbered", label: "Numbered", type: "boolean", width: "half" },
      { key: "items", label: "Steps", type: "list", itemLabel: "Step", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "description", label: "Description", type: "textarea" }, { key: "bullets", label: "Bullets", type: "tags" }] },
      { key: "note", label: "Note under steps", type: "text" },
      CTA(),
    ]),
    defaults: { layout: "horizontal", numbered: true, items: [] },
  },
  pricing: {
    type: "pricing", label: "Payment Plans", group: "Programme", icon: "BadgeDollarSign",
    description: "Fee cards with discounts and installment schedules.",
    fields: H([
      { key: "groups", label: "Plan groups", type: "list", itemLabel: "Group", fields: [
        { key: "title", label: "Group title", type: "text", width: "half" }, { key: "subtitle", label: "Subtitle (e.g. full fee)", type: "text", width: "half" },
        { key: "plans", label: "Plans", type: "list", itemLabel: "Plan", fields: [
          { key: "name", label: "Name", type: "text", width: "half" }, { key: "badge", label: "Badge", type: "text", width: "half" },
          { key: "price", label: "Price", type: "text", width: "half" }, { key: "original_price", label: "Original price", type: "text", width: "half" },
          { key: "period", label: "Period / terms", type: "text", width: "half" }, { key: "total", label: "Total", type: "text", width: "half" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "features", label: "Features", type: "tags" },
          { key: "installments", label: "Installments", type: "list", itemLabel: "Installment", fields: [{ key: "label", label: "Label", type: "text", width: "half" }, { key: "amount", label: "Amount", type: "text", width: "half" }] },
          { key: "highlight", label: "Highlight", type: "boolean", width: "half" }, { key: "note", label: "Note", type: "text", width: "half" }, CTA(),
        ] },
      ] },
      { key: "note", label: "Footnote", type: "textarea" },
    ]),
    defaults: { eyebrow: "Payment plans", title: "One programme, flexible payment", groups: [] },
  },
  curriculum: {
    type: "curriculum", label: "Curriculum Levels", group: "Programme", icon: "BookOpen",
    description: "Programme levels with module lists.",
    fields: H([
      { key: "style", label: "Style", type: "select", options: [{ value: "tabs", label: "Tabs" }, { value: "accordion", label: "Accordion" }, { value: "grid", label: "Grid" }, { value: "roadmap", label: "Roadmap" }], width: "half" },
      { key: "levels", label: "Levels", type: "list", itemLabel: "Level", fields: [{ key: "title", label: "Title", type: "text", width: "half" }, { key: "duration", label: "Duration", type: "text", width: "half" }, { key: "subtitle", label: "Subtitle", type: "text" }, { key: "modules", label: "Modules", type: "tags" }, { key: "outcome", label: "Outcome", type: "textarea" }, { key: "icon", label: "Icon", type: "icon", width: "half" }] },
      { key: "note", label: "Note", type: "textarea" },
      CTA(),
    ]),
    defaults: { style: "roadmap", levels: [] },
  },
  events: {
    type: "events", label: "Events", group: "Collections", icon: "CalendarDays",
    description: "Upcoming or recent events from the Events module.",
    fields: H([
      { key: "layout", label: "Layout", type: "select", options: [{ value: "grid", label: "Grid" }, { value: "list", label: "List" }, { value: "featured", label: "Featured" }], width: "half" },
      { key: "limit", label: "Limit", type: "number", width: "half" },
      { key: "upcoming_only", label: "Upcoming only", type: "boolean", width: "half" },
      { key: "category", label: "Category", type: "ref", entity: "event_category", width: "half" },
      CTA(),
    ]),
    defaults: { layout: "grid", limit: 3, upcoming_only: false, eyebrow: "Events & workshops", title: "Join Our Community" },
  },
  posts: {
    type: "posts", label: "Blog Posts", group: "Collections", icon: "Newspaper",
    description: "Latest articles.",
    fields: H([{ key: "limit", label: "Limit", type: "number", width: "half" }, CTA()]),
    defaults: { limit: 3, eyebrow: "Insights", title: "Explore. Learn. Grow." },
  },
  workshops: {
    type: "workshops", label: "Open Workshops", group: "Collections", icon: "Ticket",
    description: "Workshops currently accepting registrations.",
    fields: H([{ key: "limit", label: "Limit", type: "number", width: "half" }]),
    defaults: { limit: 4, eyebrow: "Register now", title: "Upcoming Workshops & Short Courses" },
  },
  contact: {
    type: "contact", label: "Contact Section", group: "Forms", icon: "Phone",
    description: "Contact channels, message form and map.",
    fields: H([
      { key: "show_form", label: "Show message form", type: "boolean", width: "half" },
      { key: "show_map", label: "Show map", type: "boolean", width: "half" },
      { key: "form_title", label: "Form title", type: "text", width: "half" },
      { key: "form_description", label: "Form description", type: "text", width: "half" },
    ]),
    defaults: { show_form: true, show_map: true, eyebrow: "Get in touch", title: "We'd love to hear from you" },
  },
  form: {
    type: "form", label: "Form", group: "Forms", icon: "ClipboardList",
    description: "Apply form, workshop/batch registration, feedback or certificate verifier.",
    fields: [
      { key: "kind", label: "Form type", type: "select", options: [
        { value: "apply", label: "Apply Now (inquiry)" }, { value: "contact", label: "Contact message" }, { value: "workshop", label: "Workshop registration" },
        { value: "batch", label: "Academic batch application" }, { value: "feedback", label: "Feedback (Google review redirect)" }, { value: "verify", label: "Certificate verifier" },
      ] },
      { key: "workshop_slug", label: "Workshop", type: "ref", entity: "workshop", width: "half" },
      { key: "batch_slug", label: "Batch", type: "ref", entity: "batch", width: "half" },
      { key: "feedback_slug", label: "Feedback form", type: "ref", entity: "feedback_form", width: "half" },
      { key: "program_code", label: "Preselect programme", type: "ref", entity: "program", width: "half" },
      { key: "eyebrow", label: "Eyebrow", type: "text", width: "half" },
      { key: "title", label: "Title", type: "text", width: "half" },
      { key: "description", label: "Description", type: "richtext" },
      IMAGE,
      { key: "sidebar", label: "Show contact sidebar", type: "boolean", width: "half" },
      { key: "show_header", label: "Show branded header", type: "boolean", width: "half" },
      { key: "success_message", label: "Success message", type: "textarea" },
    ],
    defaults: { kind: "apply", sidebar: true },
  },
  quote: {
    type: "quote", label: "Founder's Message", group: "Content", icon: "MessageSquareQuote",
    description: "Portrait with quote and supporting paragraphs.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" },
      { key: "quote", label: "Quote", type: "textarea", required: true },
      { key: "name", label: "Name", type: "text", width: "half" }, { key: "role", label: "Role", type: "text", width: "half" }, { key: "meta", label: "Meta line (experience)", type: "text" },
      IMAGE,
      { key: "sections", label: "Supporting sections", type: "list", itemLabel: "Section", fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }] },
      CTA(),
    ],
    defaults: { quote: "", name: "Dr. Niroth Samarawickrama", role: "Founder, iCET", sections: [] },
  },
  embed: {
    type: "embed", label: "Embed / HTML", group: "Media", icon: "Code2",
    description: "Sanitised HTML or iframe (Google Maps, YouTube, Forms).",
    fields: [{ key: "title", label: "Title", type: "text" }, { key: "html", label: "HTML", type: "textarea" }, { key: "height", label: "Height (px)", type: "number", width: "half" }],
    defaults: { html: "" },
  },
  anchor_nav: {
    type: "anchor_nav", label: "In-page Navigation", group: "Programme", icon: "Link2",
    description: "Sticky bar of jump links for long programme pages.",
    fields: [{ key: "items", label: "Links", type: "list", itemLabel: "Link", fields: [{ key: "label", label: "Label", type: "text", width: "half" }, { key: "anchor", label: "Anchor id", type: "text", width: "half" }] }, CTA()],
    defaults: { items: [], cta: { label: "Apply Now", href: "/apply" } },
  },
  tabs: {
    type: "tabs", label: "Tabs", group: "Content", icon: "PanelTop",
    description: "Tabbed rich-text panels.",
    fields: [{ key: "eyebrow", label: "Eyebrow", type: "text", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "items", label: "Tabs", type: "list", itemLabel: "Tab", fields: [{ key: "icon", label: "Icon", type: "icon", width: "half" }, { key: "title", label: "Title", type: "text", width: "half" }, { key: "html", label: "Content", type: "richtext" }] }],
    defaults: { items: [] },
  },
  banner: {
    type: "banner", label: "Image Banner", group: "Media", icon: "RectangleHorizontal",
    description: "Full-width image with optional overlay text.",
    fields: [IMAGE, { key: "title", label: "Title", type: "text", width: "half" }, { key: "subtitle", label: "Subtitle", type: "text", width: "half" }, CTA(), { key: "height", label: "Height", type: "select", options: [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }], width: "half" }, { key: "overlay", label: "Dark overlay", type: "boolean", width: "half" }],
    defaults: { image: { url: "" }, height: "md", overlay: true },
  },
};

export const BLOCK_GROUPS = ["Hero", "Programme", "Content", "Collections", "Conversion", "Media", "Forms"] as const;

export function createBlock(type: BlockType): Block {
  const def = BLOCK_REGISTRY[type];
  return { id: "b_" + Math.random().toString(36).slice(2, 10), type, settings: { tone: "white" }, data: structuredClone(def.defaults) } as Block;
}

export const ICON_NAMES = [
  "Sparkles","GraduationCap","Code2","Cpu","BrainCircuit","Cloud","Rocket","Target","Users","UserRound","Building2","Briefcase","Globe2","Award","BadgeCheck","ShieldCheck","Lightbulb","FlaskConical","Layers","Database","Server","Smartphone","Monitor","Laptop","Network","GitBranch","Workflow","TrendingUp","LineChart","BarChart3","PieChart","Clock","CalendarDays","MapPin","Phone","Mail","MessageCircle","Video","Headphones","BookOpen","Library","Compass","Map","Flag","Heart","HandHeart","Handshake","Trophy","Medal","Star","Zap","Flame","Infinity","Puzzle","Wrench","Hammer","Settings","Search","Filter","CheckCircle2","Check","ArrowRight","ArrowUpRight","ChevronRight","Play","PlayCircle","Download","FileText","ClipboardList","ClipboardCheck","PenLine","Pencil","Megaphone","Bell","Gift","Percent","Banknote","Wallet","CreditCard","Coins","Home","School","Landmark","Factory","Store","Coffee","Sun","Moon","Leaf","TreePine","Mountain","Waves","Palette","Camera","Image","Mic","Music","Gamepad2","Bot","Brain","Atom","Dna","Microscope","Telescope","Binary","Terminal","Bug","Lock","KeyRound","Fingerprint","Eye","EyeOff","Timer","Hourglass","Repeat","RefreshCw","Shuffle","Share2","Link2","ExternalLink","Send","Inbox","MailOpen","Users2","UserPlus","UserCheck","Smile","ThumbsUp","Quote","MessageSquareQuote","Languages","Globe","Plane","Car","Bus","Train","Bike","Footprints","Accessibility","HeartHandshake","Baby","Shirt","Utensils","Pizza","Apple",
];
