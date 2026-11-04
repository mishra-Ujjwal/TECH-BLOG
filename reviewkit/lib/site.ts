import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import {
  authorsFileSchema,
  categoriesFileSchema,
  siteSchema,
  type AuthorProfile,
  type Category,
  type Site,
} from "./content/schema";

/**
 * Site configuration and taxonomy. These are config rather than content, so they
 * are always read from the repo, never from the database.
 */

let siteCache: Site | null = null;
let categoriesCache: Category[] | null = null;
let authorsCache: AuthorProfile[] | null = null;

/**
 * Each config file is cached until it changes on disk, so editing site.json,
 * categories.json or authors.json shows on the next request without a restart.
 */
const seen: Record<string, number> = {};
function changed(rel: string): boolean {
  let mtime = 0;
  try {
    mtime = fs.statSync(path.join(/* turbopackIgnore: true */ process.cwd(), rel)).mtimeMs;
  } catch {
    mtime = -1;
  }
  if (seen[rel] === mtime) return false;
  seen[rel] = mtime;
  return true;
}

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), rel), "utf8"));
}

export function getSite(): Site {
  if (changed("content/site.json")) siteCache = null;
  if (siteCache) return siteCache;
  const parsed = siteSchema.safeParse(readJson("content/site.json"));
  if (!parsed.success) {
    throw new Error(
      "content/site.json is invalid:\n" +
        parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  siteCache = parsed.data;
  return siteCache;
}

/** Canonical origin. The env var wins so previews get their own URL. */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = fromEnv && fromEnv.length > 0 ? fromEnv : getSite().url;
  return url.replace(/\/$/, "");
}

export function absoluteUrl(pathname: string): string {
  return `${siteUrl()}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function getCategories(): Category[] {
  if (changed("content/categories.json")) categoriesCache = null;
  if (categoriesCache) return categoriesCache;
  const parsed = categoriesFileSchema.safeParse(readJson("content/categories.json"));
  if (!parsed.success) {
    throw new Error(
      "content/categories.json is invalid:\n" +
        parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  categoriesCache = [...parsed.data.categories].sort((a, b) => a.order - b.order);
  return categoriesCache;
}

export function getCategory(slug: string): Category | undefined {
  return getCategories().find((c) => c.slug === slug);
}

export function categoryName(slug: string | null): string {
  if (!slug) return "";
  return getCategory(slug)?.name ?? slug;
}

/**
 * Static pages can say {{publisher.email}} instead of repeating it, so the
 * publisher's details live in site.json alone. Unknown tokens are left as written,
 * which makes a typo visible on the page rather than silently blank.
 */
export function fillSiteTokens(text: string): string {
  const site = getSite();
  const values: Record<string, string> = {
    "site.name": site.name,
    "site.url": siteUrl(),
    "publisher.name": site.publisher.name,
    "publisher.email": site.publisher.email,
  };
  return text.replace(/\{\{\s*([a-z.]+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}

export function getAuthors(): AuthorProfile[] {
  if (changed("content/authors.json")) authorsCache = null;
  if (authorsCache) return authorsCache;
  if (!fs.existsSync(path.join(process.cwd(), "content/authors.json"))) return (authorsCache = []);
  const parsed = authorsFileSchema.safeParse(readJson("content/authors.json"));
  if (!parsed.success) {
    throw new Error(
      "content/authors.json is invalid:\n" +
        parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  authorsCache = parsed.data.authors;
  return authorsCache;
}

export function getAuthor(slug: string): AuthorProfile | undefined {
  return getAuthors().find((a) => a.slug === slug);
}

/**
 * A page <title>. The layout appends " | Site name"; when that would push the title
 * past 60 characters, where search results start cutting it off, the title stands
 * alone instead.
 */
export function seoTitle(title: string): Metadata["title"] {
  const suffix = ` | ${getSite().name}`;
  return title.length + suffix.length > 60 ? { absolute: title } : title;
}

/**
 * Open Graph for a page that sets its own. Next.js replaces the layout's openGraph
 * object rather than merging it, so the site name, locale and fallback share card
 * are added back here. Pass the page's own image when it has one.
 */
export function openGraphFor(og: {
  type: "article" | "profile" | "website";
  title: string;
  description: string;
  url?: string;
  publishedTime?: string;
  modifiedTime?: string;
  images?: string;
}): Metadata["openGraph"] {
  const site = getSite();
  return {
    siteName: site.name,
    locale: site.defaultLocale.replace("-", "_"),
    ...og,
    images: og.images ?? "/opengraph-image",
  };
}
