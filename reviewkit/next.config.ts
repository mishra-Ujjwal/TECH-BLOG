import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pages read content/*.json at request time (revalidation, the studio), so the
  // folder must ship with the server code on hosts that trace dependencies.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*.json"],
  },
  // Review pages are static and revalidated; see lib/content/index.ts.
  images: {
    // Serve each picture in the smallest modern format the browser accepts, at the
    // width the layout needs, and cache the result for a month.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    // Add any remote image host you are licensed to use, e.g. a press kit CDN.
    // Studio uploads go to Vercel Blob when BLOB_READ_WRITE_TOKEN is set (lib/media.ts).
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/images/**" }],
  },
  // Near-duplicate articles folded into one page each, so Google stops choosing its
  // own canonical between them. The retired copies are drafts in the content store.
  async redirects() {
    return [
      { source: "/articles/dell-xps-13-699-vs-macbook-neo-budget-laptop", destination: "/articles/dell-xps-13-vs-macbook-neo-who-wins", permanent: true },
      { source: "/articles/macbook-neo-vs-macbook-air-m5-price-hike", destination: "/articles/macbook-neo-vs-macbook-air-m5-which-to-choose", permanent: true },
      { source: "/articles/pixel-11-vs-pixel-10-upgrade-price-trade-in", destination: "/articles/pixel-11-vs-pixel-10-should-you-upgrade", permanent: true },
    ];
  },
  async headers() {
    return [
      // Uploaded pictures rarely change; let browsers keep them for a week.
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default config;
