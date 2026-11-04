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
