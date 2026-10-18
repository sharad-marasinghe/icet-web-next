/** Cache tags shared by the data layer ("use cache") and admin mutations. */
export const TAGS = {
  settings: "settings",
  nav: "nav",
  pages: "pages",
  page: (slug: string) => `page:${slug}`,
  programs: "programs",
  trainers: "trainers",
  testimonials: "testimonials",
  partners: "partners",
  faqs: "faqs",
  events: "events",
  posts: "posts",
  gallery: "gallery",
  videos: "videos",
  workshops: "workshops",
  batches: "batches",
  feedback: "feedback",
  redirects: "redirects",
} as const;

export const ALL_CONTENT_TAGS = [
  TAGS.settings, TAGS.nav, TAGS.pages, TAGS.programs, TAGS.trainers, TAGS.testimonials, TAGS.partners,
  TAGS.faqs, TAGS.events, TAGS.posts, TAGS.gallery, TAGS.videos, TAGS.workshops, TAGS.batches, TAGS.feedback, TAGS.redirects,
];
