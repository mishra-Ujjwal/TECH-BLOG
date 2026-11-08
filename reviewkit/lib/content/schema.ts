/**
 * THE CONTENT CONTRACT.
 *
 * This file is the single definition of what a piece of content may contain.
 * You hand-author JSON in content/, `npm run content:validate` checks it against
 * these rules, and `npm run content:import` loads it into Neon.
 *
 * Objects are STRICT: an unknown or misspelled key fails validation rather than
 * being silently ignored. That is deliberate for hand-written JSON.
 */
import { z } from "zod";

/* ---------------------------------- helpers --------------------------------- */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and single hyphens only");

/** Absolute URL, checked with the URL constructor (no zod version quirks). */
const absoluteUrl = z.string().refine(
  (v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "must be an absolute http(s) URL" },
);

/** Site-relative path (for your own images) or absolute URL. */
const imageRef = z
  .string()
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "use a /public path or an absolute URL",
  });

export const LOCALES = ["en-GB", "en-US"] as const;
export const localeSchema = z.enum(LOCALES);

export const CURRENCIES = ["GBP", "USD", "EUR"] as const;

/* ---------------------------------- pieces ---------------------------------- */

export const mediaSchema = z.strictObject({
  src: imageRef,
  /** Required and meaningful: screen readers and AdSense reviewers both care. */
  alt: z.string().min(8, "write a real description, not 'image'"),
  caption: z.string().optional(),
  /** Who made it. Keep "Own screenshot"/"Own photo" for your own work. */
  credit: z.string().default("Own screenshot"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/** A source you took a fact from, with its licence. Drives the audit trail. */
export const sourceRefSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  url: absoluteUrl.optional(),
  licence: z.string().min(1),
  licenceUrl: absoluteUrl.optional(),
  /** Credit line you must print (CC BY-SA, OGL). null when none is required. */
  attribution: z.string().nullable().default(null),
  fetchedAt: isoDate.optional(),
});

export const priceSchema = z.strictObject({
  retailer: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.enum(CURRENCIES),
  url: absoluteUrl.optional(),
  /** true if the link earns commission. Forces a disclosure on the page. */
  affiliate: z.boolean().default(false),
  /** The date YOU checked it. Always rendered next to the price. */
  checkedAt: isoDate,
  /** e.g. "inc. VAT", "before sales tax", "Plus plan, billed yearly" */
  note: z.string().optional(),
});

export const prosConsSchema = z.strictObject({
  text: z.string().min(3),
  /** The number or observation behind it. Keeps claims traceable. */
  evidence: z.string().optional(),
});

export const specItemSchema = z.strictObject({
  label: z.string().min(1),
  value: z.string().min(1),
  /** id of an entry in `sources`. */
  sourceId: z.string().optional(),
  /** true = you confirmed it first-hand. Unverified specs render marked. */
  verified: z.boolean().default(false),
});

export const specGroupSchema = z.strictObject({
  group: z.string().min(1),
  items: z.array(specItemSchema).min(1),
});

export const tableSchema = z.strictObject({
  caption: z.string().optional(),
  columns: z.array(z.string().min(1)).min(2),
  rows: z.array(z.array(z.string())).min(1),
});

export const sectionSchema = z.strictObject({
  /** Used as the heading anchor and in the contents list. */
  id: slug,
  heading: z.string().min(3),
  /** Markdown. Your words. */
  body: z.string().min(1),
  table: tableSchema.optional(),
  media: z.array(mediaSchema).optional(),
  /** The editor's own take, labelled as opinion on the page. News analysis needs one. */
  opinion: z.boolean().optional(),
});

export const measurementSchema = z.strictObject({
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  /** What you compared it against, if anything. */
  comparison: z.string().optional(),
  method: z.string().optional(),
});

export const testingSchema = z.strictObject({
  testedOn: isoDate,
  /** e.g. "14 days of daily use" */
  duration: z.string().min(3),
  /** Device, OS, network, account tier. */
  setup: z.string().min(10),
  versionTested: z.string().optional(),
  /** Be explicit about the limits of your test. */
  notTested: z.array(z.string()).default([]),
  /** Hard numbers you recorded. At least one keeps a review first-hand. */
  measurements: z.array(measurementSchema).default([]),
});

export const verdictSchema = z.strictObject({
  summary: z.string().min(40, "the verdict needs a real paragraph"),
  score: z.number().min(0).max(10).optional(),
  scoreMax: z.number().positive().default(10),
  bestFor: z.array(z.string().min(3)).min(1),
  /** Required: every review must say who should not buy it. */
  skipIf: z.array(z.string().min(3)).min(1),
  pros: z.array(prosConsSchema).min(1),
  /** Required and non-empty: no puff pieces. */
  cons: z.array(prosConsSchema).min(1, "record at least one real downside"),
});

export const authorSchema = z.strictObject({
  name: z.string().min(2),
  slug: slug,
  bio: z.string().min(20).optional(),
  url: absoluteUrl.optional(),
  avatar: imageRef.optional(),
});

export const faqSchema = z.strictObject({
  q: z.string().min(8),
  a: z.string().min(20),
});

export const alternativeSchema = z.strictObject({
  name: z.string().min(1),
  /** Link to your own review of it, if you have one. */
  reviewSlug: slug.optional(),
  url: absoluteUrl.optional(),
  why: z.string().min(10),
});

export const seoSchema = z.strictObject({
  canonical: absoluteUrl.optional(),
  noindex: z.boolean().default(false),
  /** The <title> in search results, when the headline runs past 60 characters and gets cut off. */
  searchTitle: z.string().min(10).max(60).optional(),
  ogImage: imageRef.optional(),
  /** Equivalent pages in other locales, for hreflang. */
  alternates: z.array(z.strictObject({ locale: localeSchema, path: z.string() })).default([]),
});

export const editorialSchema = z.strictObject({
  /** Honest disclosure. Renders a line on the page when true. */
  aiAssisted: z.boolean().default(false),
  editedBy: z.string().optional(),
  approvedOn: isoDate.optional(),
  /** Free-text changelog shown under "Updates". */
  updates: z
    .array(z.strictObject({ date: isoDate, note: z.string().min(5) }))
    .default([]),
});

const datesSchema = z.strictObject({
  published: isoDate,
  updated: isoDate.optional(),
  /** Last time you re-checked prices and links. */
  lastChecked: isoDate.optional(),
});

/* ---------------------------------- content ---------------------------------- */

const baseDoc = {
  schemaVersion: z.literal(1),
  slug: slug,
  locale: localeSchema,
  status: z.enum(["draft", "published"]),
  title: z.string().min(10).max(80),
  /** Optional on-page H1 if it should differ from the <title>. */
  headline: z.string().min(10).optional(),
  metaDescription: z.string().min(70).max(165),
  excerpt: z.string().min(40).max(300),
  author: authorSchema,
  dates: datesSchema,
  tags: z.array(slug).default([]),
  seo: seoSchema.default({ noindex: false, alternates: [] }),
  editorial: editorialSchema.default({ aiAssisted: false, updates: [] }),
  /** Scratch note to yourself. Never rendered. */
  _note: z.string().optional(),
};

export const reviewSchema = z.strictObject({
  ...baseDoc,
  type: z.literal("review"),
  /** slug from content/categories.json */
  category: slug,
  /** slug of the pillar page this review clusters under */
  pillar: slug.optional(),
  product: z.strictObject({
    name: z.string().min(2),
    brand: z.string().optional(),
    model: z.string().optional(),
    homepage: absoluteUrl.optional(),
    image: mediaSchema.optional(),
  }),
  verdict: verdictSchema,
  /** Optional sub-scores, e.g. Ease of use 8, Value 6. */
  scores: z
    .array(z.strictObject({ label: z.string().min(2), value: z.number().min(0).max(10) }))
    .default([]),
  testing: testingSchema,
  prices: z.array(priceSchema).default([]),
  specs: z.array(specGroupSchema).default([]),
  sections: z.array(sectionSchema).min(2, "a review needs at least two sections"),
  media: z.array(mediaSchema).default([]),
  alternatives: z.array(alternativeSchema).default([]),
  faq: z.array(faqSchema).default([]),
  sources: z.array(sourceRefSchema).default([]),
});

export const pillarSchema = z.strictObject({
  ...baseDoc,
  type: z.literal("pillar"),
  category: slug,
  sections: z.array(sectionSchema).min(1),
  /** The ranked picks. Each should point at one of your own reviews. */
  picks: z
    .array(
      z.strictObject({
        award: z.string().min(3),
        reviewSlug: slug,
        oneLiner: z.string().min(10),
      }),
    )
    .default([]),
  faq: z.array(faqSchema).default([]),
  sources: z.array(sourceRefSchema).default([]),
});

export const pageSchema = z.strictObject({
  ...baseDoc,
  type: z.literal("page"),
  /** Shows the page in the footer nav. */
  footer: z.boolean().default(true),
  sections: z.array(sectionSchema).min(1),
});

/* -------------------------------- articles -------------------------------- */

/**
 * Everything that is not a single-product review or a buying guide. Each format
 * has its own required evidence, checked below, so a how-to cannot ship without
 * steps and a comparison cannot ship without the products it compared.
 */
export const ARTICLE_FORMATS = [
  "comparison",
  "how-to",
  "troubleshooting",
  "explainer",
  "news-analysis",
] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export const FORMAT_LABELS: Record<ArticleFormat, string> = {
  comparison: "Comparison",
  "how-to": "How-to",
  troubleshooting: "Troubleshooting",
  explainer: "Explainer",
  "news-analysis": "News analysis",
};

export const stepSchema = z.strictObject({
  id: slug,
  title: z.string().min(3),
  /** Markdown. What you did, in the second person. */
  body: z.string().min(1),
  /** Your own screenshot of this step. */
  media: z.array(mediaSchema).optional(),
});

export const articleSchema = z
  .strictObject({
    ...baseDoc,
    type: z.literal("article"),
    format: z.enum(ARTICLE_FORMATS),
    category: slug,
    pillar: slug.optional(),
    /** The answer to the title, in plain language. Rendered before anything else. */
    answer: z.string().min(40, "lead with the answer in a real paragraph"),
    /** When, how and on what. Required for comparison, how-to and troubleshooting. */
    testing: testingSchema.optional(),
    /** comparison: the two to four products compared. */
    products: z
      .array(
        z.strictObject({
          name: z.string().min(2),
          reviewSlug: slug.optional(),
          url: absoluteUrl.optional(),
        }),
      )
      .default([]),
    /** how-to: e.g. "About 20 minutes" */
    timeNeeded: z.string().min(3).optional(),
    /** how-to: what the reader needs before starting. */
    requirements: z.array(z.string().min(3)).default([]),
    /** how-to: numbered steps, each ideally with its own screenshot. */
    steps: z.array(stepSchema).default([]),
    sections: z.array(sectionSchema).min(1),
    prices: z.array(priceSchema).default([]),
    media: z.array(mediaSchema).default([]),
    faq: z.array(faqSchema).default([]),
    sources: z.array(sourceRefSchema).default([]),
  })
  .superRefine((a, ctx) => {
    // These rules decide whether a post is fit to publish. A draft may be incomplete,
    // so it can be saved (or imported) and finished later.
    if (a.status !== "published") return;
    const need = (ok: boolean, message: string, path: string | (string | number)[]) => {
      if (!ok) ctx.addIssue({ code: "custom", message, path: Array.isArray(path) ? path : [path] });
    };
    if (a.format === "comparison" || a.format === "how-to" || a.format === "troubleshooting") {
      need(Boolean(a.testing), `a ${a.format} needs a testing block: when, on what, which version`, "testing");
    }
    if (a.format === "comparison") {
      need(
        a.products.length >= 2 && a.products.length <= 4,
        "a comparison covers two to four products you used",
        "products",
      );
    }
    if (a.format === "how-to") {
      need(a.steps.length >= 2, "a how-to needs at least two steps", "steps");
      need(
        Boolean(a.testing?.versionTested),
        "a how-to must name the exact OS or app version it was done on: fill in Testing, Exact version tested",
        "testing",
      );
    }
    if (a.format === "news-analysis") {
      need(
        a.sources.some((s) => Boolean(s.url)),
        "news analysis must link its original source: add it under Sources with its full link (starting https://)",
        // Point at the first source's link box when a source is already there.
        a.sources.length > 0 ? ["sources", 0, "url"] : "sources",
      );
      need(
        a.sections.some((s) => s.opinion),
        "news analysis needs your own take: tick \"This section is opinion\" on one section",
        "sections",
      );
    }
  });

export const docSchema = z.discriminatedUnion("type", [
  reviewSchema,
  pillarSchema,
  pageSchema,
  articleSchema,
]);

/* --------------------------------- taxonomy --------------------------------- */

export const categorySchema = z.strictObject({
  slug: slug,
  name: z.string().min(2),
  description: z.string().min(40),
  metaDescription: z.string().min(70).max(165).optional(),
  order: z.number().int().default(100),
  /** The <title> for the category page, if the bare name is too thin to rank. */
  seoTitle: z.string().min(10).max(60).optional(),
  /** A few words after the name in homepage section headings, e.g. "phones, laptops and PC parts". */
  tagline: z.string().min(5).max(60).optional(),
  /** What the category covers, shown on its page and in the navigation. */
  topics: z.array(z.string().min(2)).default([]),
  /** Popular brands, listed in the category's menu in the navigation. */
  brands: z.array(z.string().min(2)).default([]),
});

export const categoriesFileSchema = z.strictObject({
  categories: z.array(categorySchema).min(1),
});

export const SOCIAL_NETWORKS = ["x", "instagram", "linkedin", "github", "youtube", "facebook"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const siteSchema = z.strictObject({
  name: z.string().min(2),
  shortName: z.string().min(2).optional(),
  url: absoluteUrl,
  tagline: z.string().min(10),
  /** The homepage <title>. Under 60 characters so search results show all of it. */
  homeTitle: z.string().min(10).max(60),
  /** The homepage meta description, 140 to 160 characters. */
  description: z.string().min(140).max(160),
  defaultLocale: localeSchema,
  /** Shown on About/Contact and in Organization JSON-LD. */
  publisher: z.strictObject({
    name: z.string().min(2),
    email: z.string().email(),
    country: z.string().length(2),
    address: z.string().optional(),
    logo: imageRef.optional(),
  }),
  adsense: z.strictObject({
    /** e.g. "ca-pub-0000000000000000". Empty until you are approved. */
    publisherId: z.string().default(""),
    /** Ad scripts load only when this is true AND the visitor has consented. */
    enabled: z.boolean().default(false),
  }),
  /** Extra ads.txt lines, e.g. for an affiliate or video partner. */
  adsTxtExtra: z.array(z.string()).default([]),
  affiliate: z.strictObject({
    disclosure: z.string().min(40),
    programmes: z.array(z.string()).default([]),
  }),
  nav: z.array(z.strictObject({ label: z.string().min(2), href: z.string().min(1) })).default([]),
  /** Site ownership codes from Google Search Console and Bing Webmaster Tools. */
  verification: z
    .strictObject({ google: z.string().optional(), bing: z.string().optional() })
    .default({}),
  /** Your own profiles. Shown as icons in the footer and as sameAs in Organization JSON-LD. */
  social: z
    .array(z.strictObject({ network: z.enum(SOCIAL_NETWORKS), url: absoluteUrl }))
    .default([]),
});

/* ---------------------------------- authors --------------------------------- */

/**
 * Full author profiles. Documents reference an author by `author.slug`; when a
 * profile exists here, the byline links to /authors/<slug> and the profile's name
 * wins, so a name is spelt one way everywhere.
 */
export const authorProfileSchema = z.strictObject({
  slug: slug,
  name: z.string().min(2),
  /** e.g. "Editor and lead tester" */
  role: z.string().min(3),
  /** One or two sentences, shown under bylines and in listings. */
  bio: z.string().min(40),
  /** Markdown. Background, what they test, how long they have done it. First person. */
  about: z.string().min(80),
  /** Subjects they cover, in plain words. */
  expertise: z.array(z.string().min(2)).default([]),
  /** Their own profiles elsewhere (LinkedIn, GitHub, Mastodon). Feeds schema.org sameAs. */
  sameAs: z.array(absoluteUrl).default([]),
  avatar: mediaSchema.optional(),
});

export const authorsFileSchema = z.strictObject({
  _note: z.string().optional(),
  authors: z.array(authorProfileSchema).default([]),
});

/* ----------------------------------- types ---------------------------------- */

export type Media = z.infer<typeof mediaSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Price = z.infer<typeof priceSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SpecGroup = z.infer<typeof specGroupSchema>;
export type SpecItem = z.infer<typeof specItemSchema>;
export type Alternative = z.infer<typeof alternativeSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Pillar = z.infer<typeof pillarSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Doc = z.infer<typeof docSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Site = z.infer<typeof siteSchema>;
export type AuthorProfile = z.infer<typeof authorProfileSchema>;
export type Locale = z.infer<typeof localeSchema>;

/** Light row used by listings, derived from a full doc. */
export type DocSummary = {
  type: Doc["type"];
  slug: string;
  locale: Locale;
  title: string;
  excerpt: string;
  category: string | null;
  pillar: string | null;
  /** Article format, null for other types. */
  format: ArticleFormat | null;
  /** author.slug, so an author page can list its own work. */
  authorSlug: string;
  score: number | null;
  publishedAt: string;
  updatedAt: string | null;
  image: Media | null;
};

/**
 * The picture that represents a post in listings and share previews: the product
 * image for a review, otherwise the first item in Media, and failing that the first
 * image placed inside a section or a step.
 */
export function leadImage(doc: Doc): Media | null {
  const fromSections = () => doc.sections.flatMap((s) => s.media ?? [])[0];
  if (doc.type === "review") return doc.product.image ?? doc.media[0] ?? fromSections() ?? null;
  if (doc.type === "article") {
    return doc.media[0] ?? fromSections() ?? doc.steps.flatMap((s) => s.media ?? [])[0] ?? null;
  }
  return null;
}

export function toSummary(doc: Doc): DocSummary {
  return {
    type: doc.type,
    slug: doc.slug,
    locale: doc.locale,
    title: doc.title,
    excerpt: doc.excerpt,
    category: "category" in doc ? doc.category : null,
    pillar: doc.type === "review" || doc.type === "article" ? (doc.pillar ?? null) : null,
    format: doc.type === "article" ? doc.format : null,
    authorSlug: doc.author.slug,
    score: doc.type === "review" ? (doc.verdict.score ?? null) : null,
    publishedAt: doc.dates.published,
    updatedAt: doc.dates.updated ?? null,
    image: leadImage(doc),
  };
}
