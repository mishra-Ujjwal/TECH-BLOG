import { hasDatabase } from "../db/client";
import { loadAllDocs } from "./files";
import { categoryName as categoryLabel } from "../site";
import * as db from "./neon-driver";
import {
  toSummary,
  type Article,
  type ArticleFormat,
  type Doc,
  type DocSummary,
  type Page,
  type Pillar,
  type Price,
  type Review,
} from "./schema";

/**
 * One API for the pages, two drivers behind it.
 *
 *   CONTENT_SOURCE=neon   query Postgres
 *   CONTENT_SOURCE=files  read content/*.json
 *   unset                 neon if DATABASE_URL exists, otherwise files
 */
function useNeon(): boolean {
  const mode = process.env.CONTENT_SOURCE;
  if (mode === "files") return false;
  if (mode === "neon") return true;
  return hasDatabase();
}

export function contentDriver(): "neon" | "files" {
  return useNeon() ? "neon" : "files";
}

function publishedDocs(): Doc[] {
  return loadAllDocs()
    .map((d) => d.doc)
    .filter((d) => d.status === "published")
    .sort((a, b) => b.dates.published.localeCompare(a.dates.published));
}

/* --------------------------------- reviews --------------------------------- */

export async function listReviews(opts: {
  category?: string;
  pillar?: string;
  limit?: number;
} = {}): Promise<DocSummary[]> {
  if (useNeon()) return db.listSummaries({ type: "review", ...opts });
  let docs = publishedDocs().filter((d): d is Review => d.type === "review");
  if (opts.category) docs = docs.filter((d) => d.category === opts.category);
  if (opts.pillar) docs = docs.filter((d) => d.pillar === opts.pillar);
  const out = docs.map(toSummary);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function getReview(slug: string): Promise<Review | null> {
  if (useNeon()) {
    const doc = await db.getDoc("review", slug);
    return doc && doc.type === "review" ? doc : null;
  }
  const found = publishedDocs().find((d) => d.type === "review" && d.slug === slug);
  return found && found.type === "review" ? found : null;
}

/* --------------------------------- articles -------------------------------- */

export async function listArticles(opts: {
  category?: string;
  format?: ArticleFormat;
  limit?: number;
} = {}): Promise<DocSummary[]> {
  let out: DocSummary[];
  if (useNeon()) {
    out = await db.listSummaries({ type: "article", category: opts.category });
  } else {
    let docs = publishedDocs().filter((d): d is Article => d.type === "article");
    if (opts.category) docs = docs.filter((d) => d.category === opts.category);
    out = docs.map(toSummary);
  }
  if (opts.format) out = out.filter((s) => s.format === opts.format);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (useNeon()) {
    const doc = await db.getDoc("article", slug);
    return doc && doc.type === "article" ? doc : null;
  }
  const found = publishedDocs().find((d) => d.type === "article" && d.slug === slug);
  return found && found.type === "article" ? found : null;
}

/** Everything filed under a category: reviews, articles and guides, newest first. */
export async function listCategory(category: string): Promise<DocSummary[]> {
  if (useNeon()) return db.listSummaries({ category });
  return publishedDocs()
    .filter((d) => "category" in d && d.category === category)
    .map(toSummary);
}

/** Reviews, articles and guides together, newest first. Static pages are left out. */
export async function listLatest(limit = 30): Promise<DocSummary[]> {
  const all = useNeon()
    ? await db.listSummaries({ limit: limit + 50 })
    : publishedDocs().map(toSummary);
  return all.filter((d) => d.type !== "page").slice(0, limit);
}

/* --------------------------------- pillars --------------------------------- */

export async function listPillars(opts: { limit?: number } = {}): Promise<DocSummary[]> {
  if (useNeon()) return db.listSummaries({ type: "pillar", ...opts });
  const out = publishedDocs()
    .filter((d): d is Pillar => d.type === "pillar")
    .map(toSummary);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function getPillar(slug: string): Promise<Pillar | null> {
  if (useNeon()) {
    const doc = await db.getDoc("pillar", slug);
    return doc && doc.type === "pillar" ? doc : null;
  }
  const found = publishedDocs().find((d) => d.type === "pillar" && d.slug === slug);
  return found && found.type === "pillar" ? found : null;
}

/* ---------------------------------- pages ---------------------------------- */

export async function getPage(slug: string): Promise<Page | null> {
  if (useNeon()) {
    const doc = await db.getDoc("page", slug);
    return doc && doc.type === "page" ? doc : null;
  }
  const found = publishedDocs().find((d) => d.type === "page" && d.slug === slug);
  return found && found.type === "page" ? found : null;
}

export async function listFooterPages(): Promise<{ slug: string; title: string }[]> {
  if (useNeon()) {
    const rows = await db.listSummaries({ type: "page" });
    // `footer` lives in the document, so fetch each one only when needed.
    const pages = await Promise.all(rows.map((r) => getPage(r.slug)));
    return pages
      .filter((p): p is Page => Boolean(p) && (p as Page).footer)
      .map((p) => ({ slug: p.slug, title: p.title }));
  }
  return publishedDocs()
    .filter((d): d is Page => d.type === "page" && d.footer)
    .map((p) => ({ slug: p.slug, title: p.title }));
}

/* --------------------------------- helpers --------------------------------- */

/** Prices for a document. From snapshot history on Neon, from the doc on files. */
export async function pricesFor(doc: Review | Article): Promise<Price[]> {
  if (!useNeon()) return doc.prices;
  const rows = await db.latestPrices(doc.type, doc.slug);
  if (rows.length === 0) return doc.prices;
  return rows.map((r) => ({
    retailer: r.retailer,
    amount: r.amount,
    currency: r.currency as Price["currency"],
    url: r.url ?? undefined,
    affiliate: r.affiliate,
    checkedAt: r.checkedAt,
    note: r.note ?? undefined,
  }));
}

/**
 * One headline measurement from each of the most recent reviews. The home page
 * leads with these, so the first thing a visitor sees is evidence from the actual
 * content rather than a claim about it.
 */
export async function latestEvidence(limit = 3): Promise<
  {
    slug: string;
    product: string;
    label: string;
    value: string;
    unit: string | null;
    method: string | null;
  }[]
> {
  const recent = await listReviews({ limit });
  const out: Awaited<ReturnType<typeof latestEvidence>> = [];
  for (const summary of recent) {
    const review = await getReview(summary.slug);
    const m = review?.testing.measurements[0];
    if (!review || !m) continue;
    out.push({
      slug: review.slug,
      product: review.product.name,
      label: m.label,
      value: String(m.value),
      unit: m.unit ?? null,
      method: m.method ?? null,
    });
  }
  return out;
}

export async function sitemapEntries(): Promise<
  { type: Doc["type"]; slug: string; updatedAt: string }[]
> {
  if (useNeon()) return db.listSitemapEntries();
  return publishedDocs().map((d) => ({
    type: d.type,
    slug: d.slug,
    updatedAt: d.dates.updated ?? d.dates.published,
  }));
}

/* ---------------------------------- search --------------------------------- */

const STOP_WORDS = new Set(["a", "an", "and", "the", "of", "for", "to", "in", "on", "with", "or", "vs", "how", "best"]);

/** Lowercase words with a plural "s" removed, so "phones" finds "phone". */
function terms(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/** The text of a document, split by how much a match there should count. */
function searchFields(d: Doc): { weight: number; text: string }[] {
  const strong = [d.title, d.headline ?? "", d.tags.join(" ")];
  const medium = [d.excerpt, "category" in d ? categoryLabel(d.category) : ""];
  const body = d.sections.map((s) => `${s.heading} ${s.body}`);
  if (d.type === "review") {
    strong.push(d.product.name, d.product.brand ?? "", d.product.model ?? "");
    medium.push(d.verdict.summary);
  }
  if (d.type === "article") {
    strong.push(...d.products.map((p) => p.name));
    medium.push(d.answer);
    body.push(...d.steps.map((s) => `${s.title} ${s.body}`));
  }
  if (d.type === "pillar") medium.push(...d.picks.map((p) => p.oneLiner));
  return [
    { weight: 5, text: strong.join(" ") },
    { weight: 2, text: medium.join(" ") },
    { weight: 1, text: body.join(" ") },
  ];
}

/**
 * Word search over published documents. Every word of a one- or two-word query must
 * appear somewhere; longer queries (menu topics such as "Budget and mid-range phones")
 * need half their words. Results are ranked by where the words were found.
 */
export async function search(query: string, limit = 25): Promise<DocSummary[]> {
  const q = query.trim();
  if (!q) return [];
  if (useNeon()) return db.searchContent(q, limit);
  const wanted = [...new Set(terms(q))];
  if (wanted.length === 0) return [];
  const need = wanted.length <= 2 ? wanted.length : Math.ceil(wanted.length / 2);

  return publishedDocs()
    .filter((d) => d.type !== "page")
    .map((d) => {
      const fields = searchFields(d).map((f) => ({ weight: f.weight, words: new Set(terms(f.text)) }));
      let score = 0;
      let matched = 0;
      for (const w of wanted) {
        const best = Math.max(0, ...fields.filter((f) => f.words.has(w)).map((f) => f.weight));
        if (best > 0) matched++;
        score += best;
      }
      return { d, score, matched };
    })
    .filter((r) => r.matched >= need)
    .sort((a, b) => b.score - a.score || b.d.dates.published.localeCompare(a.d.dates.published))
    .map((r) => toSummary(r.d))
    .slice(0, limit);
}

export type { Article, Doc, DocSummary, Page, Pillar, Review, Price };
