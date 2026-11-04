/**
 * Validates every file in content/ against the contract in lib/content/schema.ts,
 * then runs the cross-file checks a single-file schema cannot do.
 *
 *   npm run content:validate            errors fail, warnings are printed
 *   npm run content:validate -- --strict  warnings fail too (use before going live)
 *
 * Run this before every import and in CI.
 */
import fs from "node:fs";
import path from "node:path";
import { contentFilePaths, loadDocFile, type LoadedDoc } from "../lib/content/files";
import {
  authorsFileSchema,
  categoriesFileSchema,
  siteSchema,
  type Doc,
} from "../lib/content/schema";

const STRICT = process.argv.includes("--strict");
const ROOT = process.cwd();

/** Page slugs may not shadow a real route. */
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

const errors: string[] = [];
const warnings: string[] = [];

function err(where: string, msg: string) {
  errors.push(`${where}: ${msg}`);
}
function warn(where: string, msg: string) {
  warnings.push(`${where}: ${msg}`);
}

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/* ------------------------------- config files ------------------------------- */

const siteParsed = siteSchema.safeParse(readJson("content/site.json"));
if (!siteParsed.success) {
  for (const i of siteParsed.error.issues) {
    err("content/site.json", `${i.path.join(".") || "(root)"} ${i.message}`);
  }
}

/* The publisher's name and email are printed in the footer and on every legal page. */
if (siteParsed.success && /\bTODO\b/.test(JSON.stringify(siteParsed.data))) {
  const msg = 'contains "TODO", which shows in the footer and on the legal pages';
  if (STRICT) err("content/site.json", msg);
  else warn("content/site.json", msg);
}

const catsParsed = categoriesFileSchema.safeParse(readJson("content/categories.json"));
if (!catsParsed.success) {
  for (const i of catsParsed.error.issues) {
    err("content/categories.json", `${i.path.join(".") || "(root)"} ${i.message}`);
  }
}
/* authors: profiles behind the bylines */
const authorSlugs = new Set<string>();
if (fs.existsSync(path.join(ROOT, "content/authors.json"))) {
  const authorsParsed = authorsFileSchema.safeParse(readJson("content/authors.json"));
  if (!authorsParsed.success) {
    for (const i of authorsParsed.error.issues) {
      err("content/authors.json", `${i.path.join(".") || "(root)"} ${i.message}`);
    }
  } else {
    for (const a of authorsParsed.data.authors) authorSlugs.add(a.slug);
    const { _note, ...rest } = authorsParsed.data;
    void _note;
    if (/\bTODO\b/.test(JSON.stringify(rest))) {
      const msg = 'contains "TODO"; author pages and bylines show it';
      if (STRICT) err("content/authors.json", msg);
      else warn("content/authors.json", msg);
    }
  }
}

const categorySlugs = new Set(
  catsParsed.success ? catsParsed.data.categories.map((c) => c.slug) : [],
);

/* --------------------------------- documents -------------------------------- */

const loaded: LoadedDoc[] = [];
for (const file of contentFilePaths()) {
  try {
    loaded.push(loadDocFile(file));
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
}

const byTypeSlug = new Map<string, string>();
const reviewSlugs = new Set<string>();
const pillarSlugs = new Set<string>();

for (const { doc, sourcePath } of loaded) {
  const key = `${doc.type}:${doc.slug}`;
  const seen = byTypeSlug.get(key);
  if (seen) err(sourcePath, `duplicate ${doc.type} slug "${doc.slug}", already in ${seen}`);
  else byTypeSlug.set(key, sourcePath);
  if (doc.type === "review") reviewSlugs.add(doc.slug);
  if (doc.type === "pillar") pillarSlugs.add(doc.slug);
}

const today = new Date().toISOString().slice(0, 10);

for (const { doc, sourcePath } of loaded) {
  const where = sourcePath;
  const live = doc.status === "published";

  /* dates */
  if (doc.dates.published > today) {
    warn(where, `published date ${doc.dates.published} is in the future`);
  }
  if (doc.dates.updated && doc.dates.updated < doc.dates.published) {
    err(where, "dates.updated is before dates.published");
  }
  if (doc.dates.lastChecked && doc.dates.lastChecked > today) {
    err(where, `dates.lastChecked ${doc.dates.lastChecked} is in the future`);
  }

  /* section ids unique */
  const ids = new Set<string>();
  for (const s of doc.sections) {
    if (ids.has(s.id)) err(where, `duplicate section id "${s.id}"`);
    ids.add(s.id);
  }

  /* unfinished text */
  const blob = JSON.stringify(doc);
  if (live && /\bTODO\b/.test(blob)) {
    const msg = 'contains "TODO" but status is "published"';
    if (STRICT) err(where, msg);
    else warn(where, msg);
  }
  /* markers the drafting prompt leaves for the editor to clear before approval:
     [GAP: ...], [UNVERIFIED: ...] and REPLACE: ..., ignoring the private _note */
  const { _note: _skip, ...publicPart } = doc;
  void _skip;
  const markerText = JSON.stringify(publicPart);
  const markers = markerText.match(/\[(?:GAP|UNVERIFIED):[^\]]*\]|\bREPLACE:[^"]*/g) ?? [];
  if (live && markers.length > 0) {
    err(where, `published with ${markers.length} unresolved marker(s), first: ${markers[0]}`);
  }

  /* images must exist in public/ when they are local paths */
  const localImages: string[] = [];
  const collect = (src?: string) => {
    if (src && src.startsWith("/")) localImages.push(src);
  };
  if (doc.type === "review") {
    collect(doc.product.image?.src);
    for (const m of doc.media) collect(m.src);
  }
  if (doc.type === "article") {
    for (const m of doc.media) collect(m.src);
    for (const st of doc.steps) for (const m of st.media ?? []) collect(m.src);
  }
  for (const s of doc.sections) for (const m of s.media ?? []) collect(m.src);
  collect(doc.seo.ogImage);
  for (const src of localImages) {
    if (!fs.existsSync(path.join(ROOT, "public", src))) {
      warn(where, `image not found at public${src}`);
    }
  }

  /* bylines should lead to a real author page */
  if (live && doc.type !== "page" && !authorSlugs.has(doc.author.slug)) {
    warn(where, `author "${doc.author.slug}" has no profile in content/authors.json`);
  }

  /* taxonomy */
  if ("category" in doc && !categorySlugs.has(doc.category)) {
    err(where, `category "${doc.category}" is not in content/categories.json`);
  }

  if (doc.type === "page" && RESERVED_SLUGS.has(doc.slug)) {
    err(where, `page slug "${doc.slug}" clashes with a site route`);
  }

  if (doc.type === "review") {
    if (doc.pillar && !pillarSlugs.has(doc.pillar)) {
      err(where, `pillar "${doc.pillar}" has no matching file in content/pillars`);
    }
    for (const alt of doc.alternatives) {
      if (alt.reviewSlug && !reviewSlugs.has(alt.reviewSlug)) {
        err(where, `alternatives: no review with slug "${alt.reviewSlug}"`);
      }
    }

    /* fact provenance */
    const sourceIds = new Set(doc.sources.map((s) => s.id));
    for (const g of doc.specs) {
      for (const item of g.items) {
        if (item.sourceId && !sourceIds.has(item.sourceId)) {
          err(where, `spec "${item.label}" points at unknown sourceId "${item.sourceId}"`);
        }
        if (!item.sourceId) {
          warn(where, `spec "${item.label}" has no sourceId, so it is unattributable`);
        }
      }
    }

    /* prices */
    for (const p of doc.prices) {
      if (p.checkedAt > today) err(where, `price from ${p.retailer} is checked in the future`);
      if (p.affiliate && !p.url) warn(where, `affiliate price from ${p.retailer} has no url`);
    }
    if (live && doc.prices.length === 0) {
      warn(where, "no prices, so the page cannot show a dated price");
    }

    /* first-hand evidence: the thing that makes a review original */
    if (doc.testing.measurements.length === 0) {
      warn(where, "no measurements recorded, so nothing on the page is verifiably first-hand");
    }
    const ownImages = [doc.product.image, ...doc.media].filter(Boolean).length;
    if (live && ownImages < 2) {
      warn(where, `only ${ownImages} image(s); aim for two or more of your own`);
    }

    /* length */
    const words = doc.sections
      .map((s) => s.body)
      .concat(doc.verdict.summary)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    if (live && words < 800) {
      warn(where, `about ${words} words of body text; thin for a review`);
    }
  }

  if (doc.type === "article") {
    if (doc.pillar && !pillarSlugs.has(doc.pillar)) {
      err(where, `pillar "${doc.pillar}" has no matching file in content/pillars`);
    }
    for (const p of doc.products) {
      if (p.reviewSlug && !reviewSlugs.has(p.reviewSlug)) {
        err(where, `products: no review with slug "${p.reviewSlug}"`);
      }
    }
    for (const p of doc.prices) {
      if (p.checkedAt > today) err(where, `price from ${p.retailer} is checked in the future`);
      if (p.affiliate && !p.url) warn(where, `affiliate price from ${p.retailer} has no url`);
    }

    /* something only this site has: a measurement, a screenshot, a step performed */
    const ownImages =
      doc.media.length + doc.steps.reduce((n, st) => n + (st.media?.length ?? 0), 0);
    const measured = doc.testing?.measurements.length ?? 0;
    // Explainers and news analysis are built from sources rather than tests, so they
    // must cite them; every other format needs something first-hand.
    if (doc.format === "explainer" || doc.format === "news-analysis") {
      if (live && doc.sources.length === 0) {
        warn(where, "an explainer with no sources gives readers nothing to check");
      }
    } else if (live && ownImages === 0 && measured === 0) {
      warn(where, "no screenshots and no measurements, so nothing here is verifiably first-hand");
    }
    if (doc.format === "how-to") {
      for (const st of doc.steps) {
        if (!st.media?.length) warn(where, `step "${st.id}" has no screenshot of its own`);
      }
    }
    if (doc.format === "comparison" && measured === 0) {
      warn(where, "a comparison with no measured figures is opinion, not a comparison");
    }

    const words = [doc.answer, ...doc.sections.map((s) => s.body), ...doc.steps.map((s) => s.body)]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    if (live && words < 600) {
      warn(where, `about ${words} words of body text; fine if that is all the material supports`);
    }
  }

  if (doc.type === "pillar") {
    for (const pick of doc.picks) {
      if (!reviewSlugs.has(pick.reviewSlug)) {
        err(where, `picks: no review with slug "${pick.reviewSlug}"`);
      }
    }
    if (live && doc.picks.length === 0) {
      warn(where, "a pillar page with no picks has nothing to link to");
    }
  }
}

/* orphan reviews: in a pillar's category but not clustered */
for (const { doc, sourcePath } of loaded) {
  if (doc.type !== "review" || doc.status !== "published") continue;
  if (!doc.pillar) warn(sourcePath, "review is not attached to a pillar page");
}

/* ---------------------------------- report ---------------------------------- */

const counts = loaded.reduce<Record<string, number>>((acc, l) => {
  const k = `${l.doc.type}/${l.doc.status}`;
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`Checked ${loaded.length} document(s) in content/`);
for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  x ${e}`);
}

if (errors.length || (STRICT && warnings.length)) {
  console.log(`\nFAILED${STRICT ? " (strict: warnings count as errors)" : ""}`);
  process.exit(1);
}
console.log(`\nOK${warnings.length ? " with warnings" : ""}`);
