import type { Metadata } from "next";
import type { PageSeo } from "@/lib/blocks/types";
import type { SiteSettings } from "@/lib/data/settings";
import { absoluteUrl } from "@/lib/utils";

export function buildMetadata(settings: SiteSettings, opts: { title?: string; description?: string; path: string; seo?: PageSeo; image?: string | null; type?: "website" | "article"; publishedTime?: string | null; modifiedTime?: string | null; noindex?: boolean }): Metadata {
  const seo = opts.seo || {};
  const title = seo.title || opts.title || settings.seo.default_title;
  const description = seo.description || opts.description || settings.seo.default_description;
  const image = seo.og_image || opts.image || settings.seo.default_og_image || undefined;
  const canonical = seo.canonical || absoluteUrl(opts.path);
  const noindex = seo.noindex || opts.noindex;
  return {
    title: { absolute: title.includes("iCET") ? title : `${title} | iCET - Institute of Computer Engineering Technology` },
    description,
    keywords: seo.keywords?.length ? seo.keywords : settings.seo.keywords,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: {
      type: opts.type || "website",
      url: canonical,
      siteName: "iCET - Institute of Computer Engineering Technology",
      title,
      description,
      locale: "en_LK",
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
      publishedTime: opts.publishedTime || undefined,
      modifiedTime: opts.modifiedTime || undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined, site: settings.seo.twitter_handle },
    verification: settings.analytics.google_site_verification ? { google: settings.analytics.google_site_verification } : undefined,
  };
}

export function organizationJsonLd(s: SiteSettings) {
  const base = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "Organization"],
        "@id": `${base}#organization`,
        name: "Institute of Computer Engineering Technology (iCET)",
        alternateName: "iCET",
        url: base,
        logo: s.logo_url ? { "@type": "ImageObject", url: s.logo_url } : undefined,
        foundingDate: String(s.founded_year),
        founder: { "@type": "Person", name: "Dr. Niroth Samarawickrama" },
        telephone: s.phone,
        email: s.email,
        address: { "@type": "PostalAddress", streetAddress: s.address_line1, addressLocality: s.city, postalCode: s.postal_code, addressCountry: "LK" },
        sameAs: Object.values(s.social || {}).filter(Boolean),
        contactPoint: [{ "@type": "ContactPoint", telephone: s.phone, contactType: "admissions", areaServed: "LK", availableLanguage: ["en", "si"] }],
        hasCredential: { "@type": "EducationalOccupationalCredential", name: `TVEC Registration ${s.tvec_reg_no}` },
      },
      {
        "@type": "WebSite",
        "@id": `${base}#website`,
        url: base,
        name: "iCET",
        publisher: { "@id": `${base}#organization` },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${base}#localbusiness`,
        name: "iCET - Institute of Computer Engineering Technology",
        image: s.logo_url || undefined,
        url: base,
        telephone: s.phone,
        priceRange: "LKR",
        address: { "@type": "PostalAddress", streetAddress: s.address_line1, addressLocality: s.city, postalCode: s.postal_code, addressCountry: "LK" },
        geo: { "@type": "GeoCoordinates", latitude: 6.7132, longitude: 79.9026 },
        openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "08:30", closes: "17:30" }],
      },
    ],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function courseJsonLd(p: { name: string; qualification: string; summary: string; slug: string; duration: string; mode: string; fee_from: number | null; logo_url: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${p.name} – ${p.qualification}`,
    description: p.summary,
    url: absoluteUrl(`/${p.slug}`),
    image: p.logo_url || undefined,
    provider: { "@type": "EducationalOrganization", name: "iCET - Institute of Computer Engineering Technology", sameAs: absoluteUrl("/") },
    educationalCredentialAwarded: p.qualification,
    hasCourseInstance: [{ "@type": "CourseInstance", courseMode: p.mode.toLowerCase().includes("online") ? ["onsite", "online", "blended"] : ["onsite"], location: { "@type": "Place", name: "iCET Panadura Campus", address: { "@type": "PostalAddress", addressLocality: "Panadura", addressCountry: "LK" } }, courseWorkload: p.duration }],
    offers: p.fee_from ? { "@type": "Offer", price: p.fee_from, priceCurrency: "LKR", category: "Paid", availability: "https://schema.org/InStock" } : undefined,
  };
}

export function eventJsonLd(e: { title: string; excerpt: string; slug: string; start_at: string; end_at: string | null; venue: string; address: string; is_online: boolean; image_url: string | null; cost: string; registration_url: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationEvent",
    name: e.title,
    description: e.excerpt,
    startDate: e.start_at,
    endDate: e.end_at || e.start_at,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: e.is_online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    image: e.image_url ? [e.image_url] : undefined,
    location: e.is_online
      ? { "@type": "VirtualLocation", url: e.registration_url || absoluteUrl(`/events/${e.slug}`) }
      : { "@type": "Place", name: e.venue || "iCET Panadura", address: { "@type": "PostalAddress", streetAddress: e.address || "223 A, Galle Road", addressLocality: "Panadura", addressCountry: "LK" } },
    organizer: { "@type": "EducationalOrganization", name: "iCET", url: absoluteUrl("/") },
    offers: { "@type": "Offer", url: e.registration_url || absoluteUrl(`/events/${e.slug}`), price: /free/i.test(e.cost) || !e.cost ? 0 : undefined, priceCurrency: "LKR", availability: "https://schema.org/InStock" },
  };
}

export function articleJsonLd(p: { title: string; excerpt: string; slug: string; cover_image: string | null; author_name: string; published_at: string | null; updated_at: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    image: p.cover_image ? [p.cover_image] : undefined,
    datePublished: p.published_at || p.updated_at,
    dateModified: p.updated_at,
    author: { "@type": "Person", name: p.author_name || "iCET" },
    publisher: { "@type": "Organization", name: "iCET - Institute of Computer Engineering Technology" },
    mainEntityOfPage: absoluteUrl(`/blogs/${p.slug}`),
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
