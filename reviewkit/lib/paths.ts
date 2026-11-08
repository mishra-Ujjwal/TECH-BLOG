import type { DocSummary } from "./content/schema";

/** The URL for any listed document. One place, so routes cannot drift apart. */
export function docPath(doc: Pick<DocSummary, "type" | "slug">): string {
  switch (doc.type) {
    case "review":
      return `/reviews/${doc.slug}`;
    case "article":
      return `/articles/${doc.slug}`;
    case "pillar":
      return `/guides/${doc.slug}`;
    case "page":
      return `/${doc.slug}`;
  }
}

/** True for a URL in this project's Blob store (or any public Blob store). */
export function isBlobUrl(src: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(src);
}

/** Local and Blob pictures can go through next/image (see remotePatterns in next.config.ts). */
export function canOptimize(src: string): boolean {
  return src.startsWith("/") || isBlobUrl(src);
}
