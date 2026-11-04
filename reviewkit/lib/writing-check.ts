/**
 * Writing check for the studio: flags prose that reads as machine-written or
 * generic, and suggests SEO improvements. Advice only. Nothing here edits or
 * publishes a post.
 *
 * Two layers:
 *   1. localCheck()  - a phrase scan that always runs, no key needed.
 *   2. claudeCheck() - a review by Claude, when ANTHROPIC_API_KEY is set.
 *
 * No tool can prove who or what wrote a piece of text. Both layers point at the
 * patterns readers (and Google's quality guidelines) treat as low effort, so the
 * writer can rewrite them in their own voice.
 */

export type Segment = { path: string; text: string };

export type Finding = { path: string; quote: string; why: string; suggestion?: string };

export type LocalReport = {
  words: number;
  score: number;
  findings: Finding[];
};

export type ClaudeReport = {
  aiLikeScore: number;
  verdict: string;
  reasons: string[];
  findings: Finding[];
  seo: {
    titleIdeas: string[];
    metaDescription: string;
    primaryKeyword: string;
    relatedKeywords: string[];
    issues: string[];
  };
  claimsToSource: { path: string; claim: string; why: string }[];
  /** Missing from reports made before the AdSense review was added. */
  adsense?: {
    risk: "low" | "medium" | "high";
    summary: string;
    issues: { path?: string; problem: string; fix: string }[];
  };
};

/* ------------------------------ text extraction ----------------------------- */

/** Fields that hold identifiers, links or settings rather than prose. */
const SKIP = new Set([
  "type", "slug", "status", "format", "category", "author", "authorSlug", "src", "url", "href",
  "canonical", "sourceId", "id", "licence", "license", "width", "height", "kind", "_note",
  "publishedAt", "updatedAt", "date", "approvedOn", "editedBy", "locale", "path", "currency",
  "retailer", "asin", "sku",
]);

export function docToSegments(doc: unknown): Segment[] {
  const out: Segment[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (typeof node === "string") {
      const text = node.trim();
      // Prose has spaces and some length; short labels are not worth checking.
      if (text.length >= 20 && /\s/.test(text) && !/^https?:\/\//.test(text)) {
        out.push({ path: path.join("."), text });
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, [...path, String(i)]));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) if (!SKIP.has(k)) walk(v, [...path, k]);
    }
  };
  walk(doc, []);
  return out;
}

/* -------------------------------- phrase scan ------------------------------- */

const TELLS: [RegExp, string, string?][] = [
  [/\bdelv(e|es|ing)\b/i, "A word strongly associated with AI writing", "look at, go through"],
  [/\bin today'?s (fast-paced|digital|modern|ever-changing)\b/i, "Stock AI opening", "Start with the actual point"],
  [/\bever-(evolving|changing)\b/i, "Filler phrase", "Say what changed and when"],
  [/\bit'?s (important|worth|crucial) (to note|noting|to remember)\b/i, "Filler that delays the point", "Just state it"],
  [/\bit is (important|worth|crucial) (to note|noting)\b/i, "Filler that delays the point", "Just state it"],
  [/\b(navigat(e|ing)) the (world|landscape|complexities)\b/i, "Stock AI phrase"],
  [/\b(landscape|realm|tapestry|testament to)\b/i, "Vague, overused AI word"],
  [/\bgame[- ]changer\b/i, "Hype without evidence", "Say what it changes, with a number"],
  [/\b(seamless(ly)?|cutting-edge|state-of-the-art|robust|revolutionar(y|ise))\b/i, "Marketing word with no information", "Describe what it actually does"],
  [/\b(unlock|elevate|empower|supercharge|harness)\b/i, "Marketing verb"],
  [/\bembark\b/i, "Stock AI word"],
  [/\b(whether you'?re a|look no further|rest assured)\b/i, "Stock AI phrase"],
  [/\b(plays? a (crucial|pivotal|vital) role|pivotal)\b/i, "Overused AI phrasing"],
  [/\b(dive in(to)?|let'?s dive|deep dive)\b/i, "Stock AI phrase"],
  [/\bwhen it comes to\b/i, "Filler", "Cut it and start with the subject"],
  [/\bin conclusion\b/i, "School-essay ending", "End on the advice itself"],
  [/^(moreover|furthermore|additionally),/im, "Formal linking word typical of AI text", "Often you can delete it"],
  [/\bnot (just|only) [^.]{1,40}, but (also )?/i, "The 'not just X but Y' pattern is an AI habit"],
  [/\b(boasts|nestled|meticulous(ly)?|bustling)\b/i, "Overused AI word"],
  [/\bstands? out (as|from)\b/i, "Vague praise", "Say what is different"],
  [/\b(the world of|a wide (range|array) of|a plethora of|myriad)\b/i, "Vague filler"],
  [/—/, "Em dash. The house style avoids them, and they are a common AI tell", "Use a comma, colon or full stop"],
];

function quoteAround(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 30)));
  const end = Math.min(text.length, index + length + 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function localCheck(segments: Segment[]): LocalReport {
  const findings: Finding[] = [];
  let words = 0;
  for (const seg of segments) {
    words += seg.text.split(/\s+/).length;
    for (const [re, why, suggestion] of TELLS) {
      const m = re.exec(seg.text);
      if (m) findings.push({ path: seg.path, quote: quoteAround(seg.text, m.index, m[0].length), why, suggestion });
    }
  }
  // Tells per 1,000 words, scaled so about 8 per 1,000 reads as "very likely".
  const rate = words ? (findings.length / words) * 1000 : 0;
  return { words, score: Math.min(100, Math.round(rate * 12)), findings };
}

/* ---------------------------------- Claude ---------------------------------- */

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const MODEL = () => process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

const REPORT_TOOL = {
  name: "report",
  description: "Return the writing and SEO review.",
  input_schema: {
    type: "object",
    required: ["aiLikeScore", "verdict", "reasons", "findings", "seo", "claimsToSource", "adsense"],
    properties: {
      aiLikeScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "How strongly the text reads as generic or machine-written. 0 = clearly a person with first-hand experience, 100 = unedited AI output.",
      },
      verdict: { type: "string", description: "One or two plain sentences for the writer." },
      reasons: { type: "array", items: { type: "string" }, description: "Up to 5 reasons behind the score." },
      findings: {
        type: "array",
        description: "Up to 15 specific passages to rewrite, worst first.",
        items: {
          type: "object",
          required: ["path", "quote", "why", "suggestion"],
          properties: {
            path: { type: "string", description: "The [path] label of the passage, copied exactly." },
            quote: { type: "string", description: "The exact words from the text, under 25 words." },
            why: { type: "string" },
            suggestion: { type: "string", description: "A concrete rewrite or what to add (for example a measurement or something the writer saw)." },
          },
        },
      },
      seo: {
        type: "object",
        required: ["titleIdeas", "metaDescription", "primaryKeyword", "relatedKeywords", "issues"],
        properties: {
          titleIdeas: { type: "array", items: { type: "string" }, description: "Up to 3 titles of 60 characters or fewer, true to the content." },
          metaDescription: { type: "string", description: "120 to 155 characters, true to the content." },
          primaryKeyword: { type: "string", description: "The search phrase this post can realistically rank for in the UK." },
          relatedKeywords: { type: "array", items: { type: "string" }, description: "Up to 6 phrases a searcher would also use." },
          issues: { type: "array", items: { type: "string" }, description: "Up to 6 SEO problems: missing questions searchers ask, weak headings, thin sections, no internal links, and so on." },
        },
      },
      claimsToSource: {
        type: "array",
        description: "Up to 8 factual claims (numbers, dates, specs, prices) that need a source or a check.",
        items: {
          type: "object",
          required: ["path", "claim", "why"],
          properties: { path: { type: "string" }, claim: { type: "string" }, why: { type: "string" } },
        },
      },
      adsense: {
        type: "object",
        description: "How a Google AdSense reviewer would judge this post.",
        required: ["risk", "summary", "issues"],
        properties: {
          risk: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Risk this post counts against approval: high = thin, generic, unoriginal or policy-breaking; low = original, useful, first-hand.",
          },
          summary: { type: "string", description: "One or two plain sentences for the writer." },
          issues: {
            type: "array",
            description: "Up to 8 problems a reviewer would notice, worst first.",
            items: {
              type: "object",
              required: ["problem", "fix"],
              properties: {
                path: { type: "string", description: "The [path] label of the passage, if the problem is in one place." },
                problem: { type: "string" },
                fix: { type: "string", description: "What to do, concretely." },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the editor of TechnoWorld360, a UK consumer tech site. You review drafts before they are published.

Your job:
1. Judge how generic or machine-written the prose reads. Look for stock phrases, hedging, symmetrical lists of three, empty transitions, sentences of uniform length, praise without evidence, and above all an absence of first-hand detail (what the writer measured, saw, or did). Be honest: say plainly when text reads as unedited AI output. You cannot know who wrote it, so judge the writing, not the author.
2. Point at specific passages and say how to fix them. Prefer suggestions that add real experience or evidence over cosmetic rewording. Never invent test results, measurements or experiences for the writer; tell them what kind of detail to add.
3. Give SEO advice for Google UK: a realistic primary keyword, titles and a meta description true to the content, and concrete issues.
4. List factual claims that need a source.
5. Judge the post as a Google AdSense reviewer would. They refuse "low value content": thin posts, text that restates what other sites say with nothing original, no sign of first-hand experience, misleading titles, copied or scraped material, and anything against the publisher policies (piracy, bypassing protections, hacking or spying on people, adult, gambling, weapons, drugs, dangerous or dishonest claims). Name each problem and how to fix it.

Use British English and no em dashes. Each passage is labelled [path]; copy that label exactly into "path".`;

export async function claudeCheck(segments: Segment[], meta: { title?: string; kind: string }): Promise<ClaudeReport> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  // Keep the request a sensible size; very long posts are cut at about 15,000 words.
  let body = "";
  for (const s of segments) {
    const line = `[${s.path}] ${s.text}\n\n`;
    if (body.length + line.length > 90_000) break;
    body += line;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // Keys not scoped to one workspace must name it.
      ...(process.env.ANTHROPIC_WORKSPACE_ID?.trim() ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID.trim() } : {}),
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 5000,
      system: SYSTEM,
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: "report" },
      messages: [
        {
          role: "user",
          content: `Review this ${meta.kind}${meta.title ? ` titled "${meta.title}"` : ""}.\n\n${body}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = detail;
    try {
      message = JSON.parse(detail)?.error?.message ?? detail;
    } catch {}
    if (res.status === 401) throw new Error("Claude rejected the API key. Check ANTHROPIC_API_KEY in .env.local.");
    if (res.status === 429) throw new Error("Claude rate limit reached. Wait a minute and try again.");
    throw new Error(`Claude returned ${res.status}: ${message.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const tool = data.content?.find((c) => c.type === "tool_use" && c.name === "report");
  if (!tool?.input) throw new Error("Claude did not return a review. Try again.");
  return tool.input as ClaudeReport;
}
