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
    remotePatterns: [],
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
