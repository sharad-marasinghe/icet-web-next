import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dmmxgcjmlhdevfnvzxfx.supabase.co").hostname;
  } catch {
    return "dmmxgcjmlhdevfnvzxfx.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "icet.lk", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    // Prerender pages gently so the database pooler is not flooded during `next build`:
    // a single build worker, two pages at a time, and a generous cache-fill timeout.
    cpus: 1,
    staticGenerationMaxConcurrency: 2,
    staticGenerationRetryCount: 2,
    useCacheTimeout: 120,
  },
  staticPageGenerationTimeout: 180,
  async redirects() {
    return [
      // Legacy WordPress URLs
      { source: "/icet_admin", destination: "/admin", permanent: false },
      { source: "/icet_admin/:path*", destination: "/admin", permanent: false },
      { source: "/certifications-verification", destination: "/verify-certificate", permanent: true },
      { source: "/verify", destination: "/verify-certificate", permanent: true },
      { source: "/event-directory", destination: "/events", permanent: true },
      { source: "/professional-programmes", destination: "/professional-it-courses-in-sri-lanka", permanent: true },
      { source: "/icet-certified-master", destination: "/software-development-course-university-students", permanent: true },
      { source: "/blockchain-01", destination: "/blogs/blockchain-cryptocurrency-tokens-smart-contracts-nfts-dapps-web3-guide", permanent: true },
      { source: "/category/:slug", destination: "/blogs?category=:slug", permanent: true },
      { source: "/author/:slug", destination: "/blogs", permanent: true },
      { source: "/alumni", destination: "/industry-placement", permanent: true },
      { source: "/feed", destination: "/blogs", permanent: true },
      { source: "/event/:slug", destination: "/events/:slug", permanent: true },
      { source: "/events/list", destination: "/events", permanent: true },
      { source: "/devops-workshop-registration", destination: "/register/devops-workshop", permanent: false },
      { source: "/mobile-app-development-workshop-registration", destination: "/register/mobile-application-development-workshop", permanent: false },
      { source: "/wp-admin/:path*", destination: "/admin", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
