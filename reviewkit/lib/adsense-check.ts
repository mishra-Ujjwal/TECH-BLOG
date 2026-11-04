/**
 * AdSense readiness checks for the studio. Advice only: nothing here edits or
 * publishes a post.
 *
 * AdSense reviewers refuse sites for "low value content": thin posts, generic text
 * with no first-hand detail, missing policy pages, too few posts, and topics that
 * break the publisher policies. These checks look for those, with a fix for each.
 * They are rules, not a model, so they are free and run on every page load.
 *
 * The AI-like score comes from the writing check's phrase scan. No tool can prove
 * who or what wrote a piece of text; Google judges whether it helps the reader.
 */

import { docToSegments, localCheck, type Finding, type Segment } from "./writing-check";

export type Level = "pass" | "warn" | "fail" | "manual";

export type Check = {
  id: string;
  level: Level;
  label: string;
  /** What is wrong, or what was found. */
  detail?: string;
  /** What to do about it. */
  fix?: string;
  /** Form field to jump to in the editor. */
  path?: string;
  /** Studio page that fixes it. */
  href?: string;
};

export type Risk = "low" | "medium" | "high";

export type PostReport = {
  words: number;
  aiScore: number;
  aiFindings: Finding[];
  checks: Check[];
  risk: Risk;
};

/** Another post on the site, for the duplicate check. */
export type Sibling = { slug: string; title: string };

/* --------------------------------- helpers ---------------------------------- */

/** Top-level fields that are labels or metadata, not the body a reader reads. */
const NOT_BODY = new Set(["title", "metaDescription", "excerpt", "author", "editorial", "sources", "seo", "tags"]);

function bodySegments(segments: Segment[]): Segment[] {
  return segments.filter((s) => !NOT_BODY.has(s.path.split(".")[0]));
}

function countWords(segments: Segment[]): number {
  return segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
}

function quote(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 30)));
  const end = Math.min(text.length, index + length + 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Every { src, alt } object anywhere in the post. */
function findMedia(node: unknown, out: { src: string; credit?: string }[] = []) {
  if (Array.isArray(node)) node.forEach((v) => findMedia(v, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.src === "string" && typeof o.alt === "string") {
      out.push({ src: o.src, credit: typeof o.credit === "string" ? o.credit : undefined });
    }
    for (const [k, v] of Object.entries(o)) if (k !== "_note") findMedia(v, out);
  }
  return out;
}

function titleWords(title: string): Set<string> {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "what", "how", "why", "is", "your", "you", "it", "with"]);
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stop.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

/* ------------------------------ policy wording ------------------------------ */

/**
 * Words that touch AdSense restricted or prohibited content. A match is not a
 * breach: a guide to blocking spyware mentions spyware. Each one is for a person
 * to read in context.
 */
const POLICY: [RegExp, string][] = [
  [/\b(torrent(s|ing)?|keygen|cracked (version|apk|software)|mod apk|pirat(e|ed|ing)|warez|free iptv|watch (free|pirated) (movies|tv|football))\b/i, "Piracy or copyright infringement. AdSense does not allow content that helps people get paid content for free."],
  [/\b(download (youtube|netflix|spotify) (videos?|songs?|music)|bypass (frp|icloud|activation lock|drm|paywall))\b/i, "Circumventing protection or terms of service. Reviewers treat this as a policy risk."],
  [/\b(spy on (someone|your (partner|wife|husband|girlfriend|boyfriend|kids?|employee))|read someone'?s (messages|texts)|hack (into|someone'?s))\b/i, "Hacking or covert surveillance of other people is prohibited content."],
  [/\b(casino|sportsbook|online betting|gambling site|slot machines?)\b/i, "Gambling is restricted. Keep it informational and never link to gambling sites."],
  [/\b(porn|xxx|nsfw|adult (content|site))\b/i, "Sexual content is not allowed next to AdSense ads."],
  [/\b(firearms?|ammunition|explosives?|3d[- ]printed guns?)\b/i, "Weapons content is restricted."],
  [/\b(cannabis|marijuana|cbd oil|recreational drugs?)\b/i, "Drug-related content is restricted."],
  [/\b(guaranteed (income|results|profit)|get rich|make money fast|miracle cure)\b/i, "Misleading or unreliable claims break the policies on dishonest content."],
];

/* --------------------------------- per post --------------------------------- */

const EVIDENCE_NUMBER =
  /(£\s?\d|\$\s?\d|\b\d+(\.\d+)?\s?(%|mah|gb|tb|mb|mbps|gbps|hz|ghz|mhz|w|wh|kwh|nits|db|ms|fps|°c|mm|cm|kg|g|hours?|hrs?|mins?|minutes|seconds|miles|km)\b)/gi;
const EVIDENCE_FIRST_HAND =
  /\b(I|we) (tested|measured|used|tried|ran|timed|bought|found|noticed|checked|compared|set up|installed)\b|\bin (my|our) (test|testing|home|house|flat|office)\b|\bon (my|our) (phone|router|laptop|tv|car)\b/i;

/** Run every per-post check. `siblings` are the other posts, for the duplicate check. */
export function checkPost(doc: Record<string, unknown>, siblings: Sibling[] = []): PostReport {
  const type = String(doc.type ?? "");
  const isPage = type === "page";
  const segments = docToSegments(doc);
  const body = bodySegments(segments);
  const words = countWords(body);
  const local = localCheck(segments);
  const checks: Check[] = [];
  const bodyText = body.map((s) => s.text).join("\n");

  // Thin content. Policy pages can be short; posts cannot.
  if (!isPage) {
    if (words < 300) {
      checks.push({ id: "thin", level: "fail", label: `Thin content: ${words} words of body text`, fix: "AdSense refuses sites full of short posts. Aim for 800 words or more of your own explanation, steps and findings. Merge it with a related post if there is not that much to say.", path: "sections" });
    } else if (words < 600) {
      checks.push({ id: "thin", level: "warn", label: `Short post: ${words} words of body text`, fix: "Add what a reader still needs: the steps you took, what you saw, the mistakes to avoid. Aim for 800 or more.", path: "sections" });
    } else {
      checks.push({ id: "thin", level: "pass", label: `${words.toLocaleString("en-GB")} words of body text` });
    }
  }

  // AI-like phrasing.
  if (local.score >= 60) {
    checks.push({ id: "ai", level: "fail", label: `Reads as AI-written (${local.score}/100)`, detail: `${local.findings.length} stock AI phrases`, fix: "Rewrite the flagged phrases in your own words, and add details only you could know: what you measured, what surprised you, what went wrong." });
  } else if (local.score >= 30) {
    checks.push({ id: "ai", level: "warn", label: `Some AI-like phrasing (${local.score}/100)`, detail: `${local.findings.length} stock phrases`, fix: "Rewrite the flagged phrases. Plain, specific sentences read as human." });
  } else {
    checks.push({ id: "ai", level: "pass", label: `Few AI-style phrases (${local.score}/100)` });
  }

  if (!isPage) {
    // First-hand evidence.
    const numbers = bodyText.match(EVIDENCE_NUMBER)?.length ?? 0;
    const firstHand = EVIDENCE_FIRST_HAND.test(bodyText);
    const measured = Array.isArray((doc.testing as { measurements?: unknown[] } | undefined)?.measurements)
      && ((doc.testing as { measurements: unknown[] }).measurements.length > 0);
    if (measured || (firstHand && numbers >= 3)) {
      checks.push({ id: "evidence", level: "pass", label: "Shows first-hand testing or measurements" });
    } else if (firstHand || numbers >= 3) {
      checks.push({ id: "evidence", level: "warn", label: "Little first-hand evidence", detail: firstHand ? "Says it was tested but gives few numbers" : "Has figures but no sign you tried it yourself", fix: "Add what you did and what you got: which device, the settings, the before and after numbers. This is what separates a hands-on post from a rewrite of other sites.", path: "sections" });
    } else {
      checks.push({ id: "evidence", level: type === "review" ? "fail" : "warn", label: "No first-hand evidence", fix: "Generic text with no testing is the main reason AdSense calls content low value. Add your own measurements, screenshots and what happened when you tried it.", path: "sections" });
    }

    // Images.
    const media = findMedia(doc);
    const own = media.filter((m) => !m.credit || /\bown\b/i.test(m.credit));
    if (media.length === 0) {
      checks.push({ id: "images", level: "warn", label: "No images", fix: "Add your own screenshots or photos with descriptive alt text. Original images are strong proof the post is not copied.", path: "media" });
    } else if (own.length === 0) {
      checks.push({ id: "images", level: "warn", label: "No original images", detail: `${media.length} image${media.length === 1 ? "" : "s"}, all credited to others`, fix: "Add at least one screenshot or photo of your own.", path: "media" });
    } else {
      checks.push({ id: "images", level: "pass", label: `${media.length} image${media.length === 1 ? "" : "s"}, ${own.length} your own` });
    }

    // Sources.
    const sources = Array.isArray(doc.sources) ? doc.sources.length : 0;
    if (type === "article" && sources === 0) {
      checks.push({ id: "sources", level: "warn", label: "No sources listed", fix: "Link the official pages or standards you relied on. It shows the facts were checked.", path: "sources" });
    }

    // Structure.
    const sections = Array.isArray(doc.sections) ? doc.sections.length : 0;
    if ((type === "article" || type === "pillar") && sections < 2) {
      checks.push({ id: "structure", level: "warn", label: "Fewer than two sections", fix: "Break the post into sections with clear headings that match what people search for.", path: "sections" });
    }

    // Byline.
    const author = (doc.author ?? {}) as { name?: string; slug?: string };
    if (!author.name || /\b(team|staff|admin|editor(ial)?)\b/i.test(author.name)) {
      checks.push({ id: "author", level: "warn", label: "No named author", detail: author.name ? `Signed "${author.name}"` : undefined, fix: "Sign the post with a real person who has a profile and bio. Reviewers and Google look for who wrote it and why they know.", path: "author" });
    }
  }

  // Unfinished text.
  const { _note: _ignored, ...publicPart } = doc;
  void _ignored;
  const markers = JSON.stringify(publicPart).match(/\bTODO\b|\[(?:GAP|UNVERIFIED):[^\]]*\]/g) ?? [];
  if (markers.length) {
    checks.push({ id: "placeholders", level: "fail", label: `${markers.length} placeholder${markers.length === 1 ? "" : "s"} left in`, detail: markers[0], fix: "Replace every TODO, [GAP: ...] and [UNVERIFIED: ...] with real text." });
  }

  // Near-duplicate titles.
  const mine = titleWords(String(doc.title ?? ""));
  const twin = siblings
    .filter((s) => s.slug !== doc.slug)
    .map((s) => ({ ...s, score: similarity(mine, titleWords(s.title)) }))
    .sort((a, b) => b.score - a.score)[0];
  if (twin && twin.score >= 0.6) {
    checks.push({ id: "duplicate", level: "warn", label: "Very similar to another post", detail: `"${twin.title}"`, fix: "Several posts on the same question look like filler. Merge them, or give each a clearly different angle and title.", path: "title" });
  }

  // Policy-risk wording.
  for (const seg of segments) {
    for (const [re, why] of POLICY) {
      const m = re.exec(seg.text);
      if (m) {
        checks.push({ id: `policy:${seg.path}:${m[0]}`, level: "warn", label: "Check this against AdSense policies", detail: `"${quote(seg.text, m.index, m[0].length)}"`, fix: why, path: seg.path });
      }
    }
  }

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const risk: Risk = fails > 0 ? "high" : warns >= 2 ? "medium" : "low";
  return { words, aiScore: local.score, aiFindings: local.findings, checks, risk };
}

/* ---------------------------------- site ------------------------------------ */

export type SiteInput = {
  site: {
    url: string;
    publisher: { email: string };
    adsense: { publisherId: string; enabled: boolean };
    verification: { google?: string };
  };
  /** Published static pages by slug, with their plain text. */
  pages: Map<string, string>;
  authors: { name: string; bio?: string }[];
  /** Published posts with their report. */
  published: { slug: string; report: PostReport }[];
};

export function checkSite({ site, pages, authors, published }: SiteInput): Check[] {
  const checks: Check[] = [];
  const page = (slug: string, label: string, why: string) =>
    checks.push(
      pages.has(slug)
        ? { id: `page:${slug}`, level: "pass", label: `${label} is published` }
        : { id: `page:${slug}`, level: "fail", label: `${label} is missing or a draft`, fix: why, href: "/studio/pages" },
    );
  page("privacy-policy", "Privacy policy", "AdSense requires a privacy policy that explains cookies and Google advertising.");
  page("about", "About us", "Reviewers look for who runs the site and why it can be trusted.");
  page("contact", "Contact page", "Reviewers look for a way to reach you.");
  page("terms", "Terms", "Expected on a site that runs ads.");

  const privacy = pages.get("privacy-policy");
  if (privacy) {
    const missing = [
      [/cookie/i, "cookies"],
      [/google/i, "Google as a third-party vendor"],
      [/advertis|\bads?\b/i, "advertising"],
      [/adssettings\.google|ads settings|opt[- ]out|aboutads\.info|youronlinechoices/i, "how to opt out of personalised ads"],
    ].filter(([re]) => !(re as RegExp).test(privacy)).map(([, what]) => what as string);
    checks.push(
      missing.length === 0
        ? { id: "privacy-content", level: "pass", label: "Privacy policy covers cookies, Google ads and opt-out" }
        : { id: "privacy-content", level: "fail", label: "Privacy policy is missing required wording", detail: `Does not mention: ${missing.join(", ")}`, fix: "Google requires the policy to say that third parties, including Google, use cookies to serve ads, and how readers can opt out (adssettings.google.com).", href: "/studio/pages" },
    );
  }

  checks.push(
    /example\.|@test\./i.test(site.publisher.email)
      ? { id: "email", level: "fail", label: "Contact email is a placeholder", detail: site.publisher.email, fix: "Set a real address you read.", href: "/studio/settings" }
      : { id: "email", level: "pass", label: "Real contact email set" },
  );

  // Enough substantial posts.
  const substantial = published.filter((p) => p.report.words >= 600).length;
  checks.push(
    substantial >= 20
      ? { id: "volume", level: "pass", label: `${substantial} substantial published posts` }
      : { id: "volume", level: substantial >= 10 ? "warn" : "fail", label: `${substantial} substantial published posts (aim for 20+)`, detail: `${published.length} published in total, ${published.length - substantial} under 600 words`, fix: "Sites are often refused for not having enough content. Publish more in-depth original posts before applying.", href: "/studio/new" },
  );

  // AI-like posts.
  const aiHigh = published.filter((p) => p.report.aiScore >= 60).length;
  const aiSome = published.filter((p) => p.report.aiScore >= 30 && p.report.aiScore < 60).length;
  checks.push(
    aiHigh > 0
      ? { id: "ai", level: "fail", label: `${aiHigh} published post${aiHigh === 1 ? "" : "s"} read as AI-written`, fix: "Rewrite them first. See the table below.", href: "#posts" }
      : aiSome > 0
        ? { id: "ai", level: "warn", label: `${aiSome} published post${aiSome === 1 ? "" : "s"} with some AI-like phrasing`, fix: "Rewrite the flagged phrases. See the table below.", href: "#posts" }
        : { id: "ai", level: "pass", label: "No published post reads as AI-written" },
  );

  const highRisk = published.filter((p) => p.report.risk === "high").length;
  if (highRisk > 0) {
    checks.push({ id: "post-risk", level: "warn", label: `${highRisk} published post${highRisk === 1 ? "" : "s"} with serious issues`, fix: "Fix them or set them back to draft before you apply. Reviewers judge the whole site.", href: "#posts" });
  }

  // Authors.
  const named = authors.filter((a) => !/\b(team|staff|admin|editor(ial)?)\b/i.test(a.name) && (a.bio ?? "").length >= 40);
  checks.push(
    named.length > 0
      ? { id: "author", level: "pass", label: "A named author with a bio exists" }
      : { id: "author", level: "warn", label: "No named author profile", detail: authors.length ? `Only "${authors[0].name}"` : undefined, fix: "Add yourself in Authors with a real bio and sign your posts. It shows real people with experience write the site.", href: "/studio/authors" },
  );

  if (/example\.|localhost/i.test(site.url)) {
    checks.push({ id: "url", level: "fail", label: "Site URL is a placeholder", detail: site.url, fix: "Set your real domain in Global settings.", href: "/studio/settings" });
  }

  checks.push(
    site.adsense.publisherId
      ? { id: "publisher", level: "pass", label: "AdSense publisher ID set; ads.txt is generated from it" }
      : { id: "publisher", level: "warn", label: "No AdSense publisher ID yet", fix: "When you sign up, AdSense gives you an ID like ca-pub-0000000000000000. Add it in Global settings so /ads.txt lists it; Google checks that file while reviewing.", href: "/studio/settings" },
  );
  if (site.adsense.enabled && !site.adsense.publisherId) {
    checks.push({ id: "enabled", level: "fail", label: "Ads are switched on with no publisher ID", fix: "Add the ID or switch ads off.", href: "/studio/settings" });
  }

  checks.push(
    site.verification.google
      ? { id: "search-console", level: "pass", label: "Google Search Console verified" }
      : { id: "search-console", level: "warn", label: "Search Console not verified", fix: "Verify the site and submit /sitemap.xml so Google has indexed your pages before review.", href: "/studio/settings" },
  );

  checks.push({ id: "cmp", level: "manual", label: "Use a Google-certified consent banner", detail: "The built-in banner is a placeholder.", fix: "Visitors from the UK and EEA need a Google-certified consent platform (AdSense offers one free under Privacy & messaging). Set it up before you switch ads on." });

  return checks;
}

export const LEVEL_ORDER: Record<Level, number> = { fail: 0, warn: 1, manual: 2, pass: 3 };
