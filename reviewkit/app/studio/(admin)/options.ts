import { contentDriver } from "@/lib/content";
import { loadAllDocs } from "@/lib/content/store";
import { getAuthors, getCategories } from "@/lib/site";
import type { StudioOptions } from "@/components/studio/editor";

/** The choices the form offers: categories, author profiles and existing slugs. */
export async function studioOptions(): Promise<StudioOptions> {
  const docs = (await loadAllDocs()).map((l) => l.doc);
  return {
    categories: getCategories().map((c) => ({ slug: c.slug, name: c.name })),
    authors: getAuthors().map((a) => ({ slug: a.slug, name: a.name })),
    pillars: docs.filter((d) => d.type === "pillar").map((d) => d.slug),
    reviews: docs.filter((d) => d.type === "review").map((d) => d.slug),
  };
}

export { contentDriver };
