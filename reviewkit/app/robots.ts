import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /search is kept out of the index by its own noindex tag. It is not blocked
        // here, because a blocked page cannot be crawled, so the noindex would never
        // be seen and the URL could still be indexed from links.
        disallow: ["/api/", "/studio"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
