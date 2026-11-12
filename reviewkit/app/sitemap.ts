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

  // Hubs change when any page under them does, so they carry the newest update date.
  const latest = (type?: Doc["type"]) =>
    entries
      .filter((e) => !type || e.type === type)
      .map((e) => e.updatedAt)
      .sort()
      .at(-1);

  // Empty lists are noindexed, so they are left out here too.
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: latest(), changeFrequency: "weekly" as const, priority: 1 },
    ...(has("review") ? [{ url: absoluteUrl("/reviews"), lastModified: latest("review"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...(has("pillar") ? [{ url: absoluteUrl("/guides"), lastModified: latest("pillar"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    ...(has("article") ? [{ url: absoluteUrl("/articles"), lastModified: latest("article"), changeFrequency: "weekly" as const, priority: 0.8 }] : []),
    { url: absoluteUrl("/categories"), lastModified: latest(), changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  const filled = await Promise.all(
    getCategories().map(async (c) => ((await listCategory(c.slug)).length > 0 ? c : null)),
  );
  const categories: MetadataRoute.Sitemap = filled.filter((c) => c !== null).map((c) => ({
    url: absoluteUrl(`/categories/${c.slug}`),
    lastModified: latest(),
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
