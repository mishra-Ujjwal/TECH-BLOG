import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { docFilePath, loadAllDocs, writeDocFile, type DocType } from "./content/files";
import {
  ARTICLE_FORMATS,
  articleSchema,
  docSchema,
  pageSchema,
  pillarSchema,
  reviewSchema,
  type ArticleFormat,
  type Doc,
} from "./content/schema";
import { getAuthors, getCategories } from "./site";
import { clean } from "./studio-shared";

/**
 * The writing studio at /studio: a form for every document type, generated from the
 * content contract, that saves JSON into content/ exactly as if you had written the
 * file by hand. The same schema and the same checks apply either way.
 *
 * It writes to disk, so it only runs where the disk is yours: `npm run dev`, or a
 * server you control with STUDIO_ENABLED=true. On a serverless host the filesystem is
 * read-only; write locally, then commit and deploy.
 */

export function studioEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.STUDIO_ENABLED === "true";
}

export const DOC_TYPES: DocType[] = ["article", "review", "pillar", "page"];

export const TYPE_LABELS: Record<DocType, string> = {
  article: "Article",
  review: "Review",
  pillar: "Buying guide",
  page: "Static page",
};

/** Page slugs may not shadow a real route. Kept in step with scripts/validate-content.ts. */
const RESERVED_SLUGS = new Set([
  "reviews",
  "articles",
  "authors",
  "guides",
  "categories",
  "search",
  "api",
  "studio",
  "sitemap.xml",
  "robots.txt",
  "ads.txt",
  "images",
]);

const SCHEMAS = {
  review: reviewSchema,
  article: articleSchema,
  pillar: pillarSchema,
  page: pageSchema,
} as const;

/** JSON Schema for the form. `io: "input"` so fields with defaults are optional. */
export function formSchemaFor(type: DocType): unknown {
  // Round-trip through JSON: the generator returns null-prototype objects, which
  // cannot be passed from a server component to a client one.
  return JSON.parse(JSON.stringify(z.toJSONSchema(SCHEMAS[type], { io: "input", unrepresentable: "any" })));
}

const today = () => new Date().toISOString().slice(0, 10);

/** A starting document with every required field present, ready for the form. */
export function blankDoc(type: DocType, format: ArticleFormat = "explainer"): Record<string, unknown> {
  const author = getAuthors()[0];
  const category = getCategories()[0]?.slug ?? "";
  const section = { id: "first-section", heading: "", body: "" };
  const base = {
    schemaVersion: 1,
    type,
    slug: "",
    locale: "en-GB",
    status: "draft",
    title: "",
    metaDescription: "",
    excerpt: "",
    author: { name: author?.name ?? "", slug: author?.slug ?? "" },
    dates: { published: today() },
    tags: [],
  };
  const testing = {
    testedOn: today(),
    duration: "",
    setup: "",
    notTested: [],
    measurements: [],
  };

  switch (type) {
    case "article":
      return {
        ...base,
        format,
        category,
        answer: "",
        ...(format === "how-to"
          ? {
              testing: { ...testing, versionTested: "" },
              timeNeeded: "",
              requirements: [],
              steps: [
                { id: "step-1", title: "", body: "" },
                { id: "step-2", title: "", body: "" },
              ],
            }
          : {}),
        ...(format === "troubleshooting" ? { testing } : {}),
        ...(format === "comparison"
          ? { testing, products: [{ name: "" }, { name: "" }] }
          : {}),
        sections:
          format === "news-analysis"
            ? [section, { id: "our-take", heading: "Our take", body: "", opinion: true }]
            : [section],
        ...(format === "news-analysis"
          ? { sources: [{ id: "primary", name: "", url: "", licence: "Headline and link only" }] }
          : {}),
        faq: [],
      };
    case "review":
      return {
        ...base,
        category,
        product: { name: "", brand: "" },
        verdict: {
          summary: "",
          score: 7,
          bestFor: [""],
          skipIf: [""],
          pros: [{ text: "" }],
          cons: [{ text: "" }],
        },
        scores: [],
        testing,
        prices: [],
        specs: [],
        sections: [section, { id: "second-section", heading: "", body: "" }],
        media: [],
        alternatives: [],
        faq: [],
        sources: [],
      };
    case "pillar":
      return { ...base, category, sections: [section], picks: [], faq: [], sources: [] };
    case "page":
      return { ...base, footer: true, sections: [section] };
  }
}

/* ----------------------------------- saving ---------------------------------- */

export type Issue = { path: string; message: string };
export type SaveResult =
  | { ok: true; doc: Doc; file: string; url: string | null; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

/** Paths of every string field that still says TODO. */
function findTodos(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") return /\bTODO\b/.test(value) ? [path.join(".")] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findTodos(v, [...path, String(i)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => (k === "_note" ? [] : findTodos(v, [...path, k])));
  }
  return [];
}

function wordCount(...parts: string[]): number {
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

/** Validate, run the cross-file checks, and write the file. */
export function saveDoc(input: unknown, originalSlug?: string): SaveResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  const parsed = docSchema.safeParse(clean(input));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      warnings,
    };
  }
  const doc = parsed.data;
  const live = doc.status === "published";

  // The profile in content/authors.json is the one spelling of an author's name; the
  // pages already show it, so keep the copy stored on the post in step with it.
  const profile = getAuthors().find((a) => a.slug === doc.author.slug);
  if (profile) doc.author = { ...doc.author, name: profile.name };
  const others = loadAllDocs()
    .map((l) => l.doc)
    .filter((d) => !(d.type === doc.type && d.slug === (originalSlug ?? doc.slug)));

  /* the slug is the file name and the URL, so it must be free */
  if (doc.slug !== originalSlug && fs.existsSync(docFilePath(doc.type, doc.slug))) {
    errors.push({ path: "slug", message: `a ${doc.type} called "${doc.slug}" already exists` });
  }
  if (doc.type === "page" && RESERVED_SLUGS.has(doc.slug)) {
    errors.push({ path: "slug", message: `"${doc.slug}" clashes with a site route` });
  }

  if ("category" in doc && !getCategories().some((c) => c.slug === doc.category)) {
    errors.push({ path: "category", message: `"${doc.category}" is not in content/categories.json` });
  }
  if (doc.type !== "page" && !getAuthors().some((a) => a.slug === doc.author.slug)) {
    warnings.push({ path: "author.slug", message: "no profile in content/authors.json" });
  }

  const reviewSlugs = new Set(others.filter((d) => d.type === "review").map((d) => d.slug));
  const pillarSlugs = new Set(others.filter((d) => d.type === "pillar").map((d) => d.slug));
  if ((doc.type === "review" || doc.type === "article") && doc.pillar && !pillarSlugs.has(doc.pillar)) {
    errors.push({ path: "pillar", message: `no buying guide with slug "${doc.pillar}"` });
  }
  if (doc.type === "review") {
    doc.alternatives.forEach((a, i) => {
      if (a.reviewSlug && !reviewSlugs.has(a.reviewSlug)) {
        errors.push({ path: `alternatives.${i}.reviewSlug`, message: `no review "${a.reviewSlug}"` });
      }
    });
    const ids = new Set(doc.sources.map((s) => s.id));
    doc.specs.forEach((g, gi) =>
      g.items.forEach((item, ii) => {
        if (item.sourceId && !ids.has(item.sourceId)) {
          errors.push({
            path: `specs.${gi}.items.${ii}.sourceId`,
            message: `no source with id "${item.sourceId}"`,
          });
        }
      }),
    );
  }
  if (doc.type === "article") {
    doc.products.forEach((p, i) => {
      if (p.reviewSlug && !reviewSlugs.has(p.reviewSlug)) {
        errors.push({ path: `products.${i}.reviewSlug`, message: `no review "${p.reviewSlug}"` });
      }
    });
  }
  if (doc.type === "pillar") {
    doc.picks.forEach((p, i) => {
      if (!reviewSlugs.has(p.reviewSlug)) {
        errors.push({ path: `picks.${i}.reviewSlug`, message: `no review "${p.reviewSlug}"` });
      }
    });
  }

  const ids = new Set<string>();
  doc.sections.forEach((s, i) => {
    if (ids.has(s.id)) errors.push({ path: `sections.${i}.id`, message: `duplicate id "${s.id}"` });
    ids.add(s.id);
  });

  if (doc.dates.updated && doc.dates.updated < doc.dates.published) {
    errors.push({ path: "dates.updated", message: "is before the published date" });
  }

  /* images referenced from /public must exist */
  const blob = JSON.stringify(doc);
  for (const m of blob.matchAll(/"(?:src|ogImage|avatar)":"(\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(process.cwd(), "public", m[1]))) {
      warnings.push({ path: "media", message: `image not found at public${m[1]}` });
    }
  }

  /* unfinished text cannot go live (the private _note is ignored) */
  const { _note: _ignored, ...publicPart } = doc;
  void _ignored;
  const markerText = JSON.stringify(publicPart);
  if (live) {
    const markers = markerText.match(/\[(?:GAP|UNVERIFIED):[^\]]*\]|\bREPLACE:[^"]*/g) ?? [];
    if (markers.length) {
      errors.push({ path: "status", message: `clear ${markers.length} marker(s) first: ${markers[0]}` });
    }
    const todos = findTodos(doc);
    if (todos.length) {
      const where = todos.slice(0, 3).join(", ");
      const hint = todos.includes("author.name")
        ? " (set your real name in content/authors.json)"
        : "";
      errors.push({
        path: todos[0],
        message: `remove "TODO" before publishing, found in ${where}${todos.length > 3 ? " and more" : ""}${hint}`,
      });
    }
    if (doc.type === "article") {
      const words = wordCount(doc.answer, ...doc.sections.map((s) => s.body), ...doc.steps.map((s) => s.body));
      if (words < 600) warnings.push({ path: "sections", message: `about ${words} words; thin for an article` });
    }
    if (doc.type === "review") {
      const words = wordCount(doc.verdict.summary, ...doc.sections.map((s) => s.body));
      if (words < 800) warnings.push({ path: "sections", message: `about ${words} words; thin for a review` });
      if (doc.testing.measurements.length === 0) {
        warnings.push({ path: "testing.measurements", message: "no measurements, so nothing is verifiably first-hand" });
      }
    }
  }

  if (errors.length) return { ok: false, errors, warnings };

  const file = writeAndMove(doc, originalSlug);
  return { ok: true, doc, file, url: live ? publicPath(doc) : null, warnings };
}

function writeAndMove(doc: Doc, originalSlug?: string): string {
  const file = writeDocFile(doc);
  if (originalSlug && originalSlug !== doc.slug) {
    // Renamed, not deleted: the old file is kept beside it with a .bak suffix, which
    // the loader ignores, so a slug change can always be undone.
    const old = docFilePath(doc.type, originalSlug);
    if (fs.existsSync(old)) fs.renameSync(old, `${old}.bak`);
  }
  return file;
}

export function publicPath(doc: Pick<Doc, "type" | "slug">): string {
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

export function isArticleFormat(v: unknown): v is ArticleFormat {
  return typeof v === "string" && (ARTICLE_FORMATS as readonly string[]).includes(v);
}

/* ---------------------------------- delete ---------------------------------- */

/**
 * Where deleted documents go. Deleting from the studio moves the file here rather
 * than erasing it, so a mistake can be undone by moving the file back into its
 * folder. The loader only reads the four content folders, so nothing in here is
 * published, listed or validated.
 */
export const TRASH_DIR = path.join(process.cwd(), "content", ".trash");

/** Other documents that link to this one, which would break if it disappeared. */
function referencesTo(type: DocType, slug: string): string[] {
  const out: string[] = [];
  for (const { doc } of loadAllDocs()) {
    if (doc.type === type && doc.slug === slug) continue;
    if (type === "review") {
      if (doc.type === "pillar" && doc.picks.some((p) => p.reviewSlug === slug)) out.push(doc.slug);
      if (doc.type === "review" && doc.alternatives.some((a) => a.reviewSlug === slug)) out.push(doc.slug);
      if (doc.type === "article" && doc.products.some((p) => p.reviewSlug === slug)) out.push(doc.slug);
    }
    if (type === "pillar" && (doc.type === "review" || doc.type === "article") && doc.pillar === slug) {
      out.push(doc.slug);
    }
  }
  return out;
}

export function trashDoc(type: DocType, slug: string): { ok: true; movedTo: string } | { ok: false; reason: string } {
  const file = docFilePath(type, slug);
  if (!fs.existsSync(file)) return { ok: false, reason: "file not found" };
  const refs = referencesTo(type, slug);
  if (refs.length) {
    return { ok: false, reason: `still linked from ${refs.slice(0, 3).join(", ")}${refs.length > 3 ? " and more" : ""}; remove those links first` };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(TRASH_DIR, type);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${slug}--${stamp}.json`);
  fs.renameSync(file, dest);
  return { ok: true, movedTo: path.relative(process.cwd(), dest) };
}
