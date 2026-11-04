import type { MetadataRoute } from "next";
import { listCategory, sitemapEntries, type Doc } from "@/lib/content";
import { absoluteUrl, getAuthors, getCategories } from "@/lib/site";

const PATH_FOR: Record<string, (slug: string) => string> = {
  review: (s) => `/reviews/${s}`,
  pillar: (s) => `/guides/${s}`,
  page: (s) => `/${s}`,
  article: (s) => `/articles/${s}`,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await sitemapEntries();

  const has = (type: Doc["type"]) => entries.some((e) => e.type === type);

  // Empty lists are noindexed, so they are left out here too.
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly" as const, priority: 1 },
    ...(has("review") ? [{ url: absoluteUrl("/reviews"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...(has("pillar") ? [{ url: absoluteUrl("/guides"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...(has("article") ? [{ url: absoluteUrl("/articles"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    { url: absoluteUrl("/categories"), changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  const filled = await Promise.all(
    getCategories().map(async (c) => ((await listCategory(c.slug)).length > 0 ? c : null)),
  );
  const categories: MetadataRoute.Sitemap = filled.filter((c) => c !== null).map((c) => ({
    url: absoluteUrl(`/categories/${c.slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const docs: MetadataRoute.Sitemap = entries.map((e) => ({
    url: absoluteUrl(PATH_FOR[e.type](e.slug)),
    lastModified: e.updatedAt,
    changeFrequency: e.type === "page" ? "yearly" : "monthly",
    priority:
      e.type === "review" ? 0.9 : e.type === "pillar" || e.type === "article" ? 0.8 : 0.3,
  }));

  const authors: MetadataRoute.Sitemap = getAuthors().map((a) => ({
    url: absoluteUrl(`/authors/${a.slug}`),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...fixed, ...categories, ...authors, ...docs];
}
