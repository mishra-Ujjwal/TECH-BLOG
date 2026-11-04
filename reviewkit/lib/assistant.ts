import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkPost } from "./adsense-check";
import { auditSite, siblings } from "./adsense-audit";
import { listRawDocs, readRawDoc, type DocType } from "./content/store";
import { docSchema } from "./content/schema";
import { getSite } from "./site";

/**
 * The studio assistant: a chat with Claude that can read the site's content, run
 * the AdSense and writing checks, and propose edits. Server only.
 *
 * Claude can only PROPOSE an edit. Each proposal goes to the browser as a card;
 * nothing is written until the editor clicks Apply, which calls applyEdit() through
 * /api/studio/assistant/apply. Status, slug, dates and author are off limits, so the
 * assistant can never publish, unpublish or rename anything.
 */

type Raw = Record<string, unknown>;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;

export const ASSISTANT_MODEL = () => process.env.ANTHROPIC_ASSISTANT_MODEL?.trim() || "claude-opus-5-5";

/**
 * Keys that are not scoped to one workspace must name it on every request.
 * Set ANTHROPIC_WORKSPACE_ID (wrkspc_...) in .env.local for those.
 */
export function anthropicWorkspaceHeaders(): Record<string, string> {
  const id = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return id ? { "anthropic-workspace-id": id } : {};
}

export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/* ---------------------------------- edits ----------------------------------- */

const DOC_TYPES = ["article", "review", "pillar", "page"] as const;

/** Fields the assistant may never change: they publish, rename, re-date or re-sign a post. */
const LOCKED_ROOTS = new Set(["type", "slug", "status", "schemaVersion", "dates", "author", "editorial", "_note", "locale"]);
/** Keys that hold links, ids or file paths rather than prose. */
const LOCKED_KEYS = new Set(["src", "url", "href", "canonical", "sourceId", "id", "licence", "licenceUrl", "ogImage", "avatar", "reviewSlug"]);

export type EditRequest = { type: string; slug: string; path: string; oldText: string; newText: string };

function splitPath(path: string): (string | number)[] {
  return path.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

/**
 * Apply one text replacement to a copy of the raw document. The field must be a
 * string that contains `oldText` exactly once, so a stale or ambiguous edit is
 * refused rather than guessed at.
 */
export function editRaw(raw: Raw, path: string, oldText: string, newText: string): { ok: true; doc: Raw } | { ok: false; reason: string } {
  const parts = splitPath(path);
  if (parts.length === 0 || parts.some((p) => p === "")) return { ok: false, reason: `"${path}" is not a field path` };
  if (LOCKED_ROOTS.has(String(parts[0]))) return { ok: false, reason: `"${parts[0]}" can only be changed by you in the editor` };
  const last = parts[parts.length - 1];
  if (LOCKED_KEYS.has(String(last))) return { ok: false, reason: `"${last}" holds a link or id, not text` };
  if (!oldText) return { ok: false, reason: "old text is empty" };
  if (oldText === newText) return { ok: false, reason: "the new text is the same as the old" };

  const copy = structuredClone(raw);
  let node: unknown = copy;
  for (const p of parts.slice(0, -1)) {
    node = (node as Record<string | number, unknown> | undefined)?.[p];
    if (node === null || typeof node !== "object") return { ok: false, reason: `no field at "${path}"` };
  }
  const parent = node as Record<string | number, unknown>;
  const current = parent[last];
  if (typeof current !== "string") return { ok: false, reason: `"${path}" is not a text field` };
  const first = current.indexOf(oldText);
  if (first === -1) return { ok: false, reason: `the text at "${path}" no longer contains the old text (it may have been edited since)` };
  if (current.indexOf(oldText, first + 1) !== -1) return { ok: false, reason: `the old text appears more than once in "${path}"; quote more of it` };
  parent[last] = current.slice(0, first) + newText + current.slice(first + oldText.length);
  return { ok: true, doc: copy };
}

/** Check an edit against the stored post and the content contract, without saving. */
export async function previewEdit(e: EditRequest): Promise<{ ok: true; doc: Raw; title: string; published: boolean } | { ok: false; reason: string }> {
  if (!DOC_TYPES.includes(e.type as DocType)) return { ok: false, reason: `unknown type "${e.type}"` };
  const raw = (await readRawDoc(e.type as DocType, e.slug)) as Raw | null;
  if (!raw) return { ok: false, reason: `no ${e.type} with slug "${e.slug}"` };
  const edited = editRaw(raw, e.path, e.oldText, e.newText);
  if (!edited.ok) return edited;
  const parsed = docSchema.safeParse(edited.doc);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, reason: `the edit breaks the content rules at ${i.path.join(".")}: ${i.message}` };
  }
  return { ok: true, doc: edited.doc, title: String(raw.title ?? e.slug), published: raw.status === "published" };
}

/* ---------------------------------- tools ----------------------------------- */

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_posts",
    description:
      "List every post and static page on the site with its status, body word count, AI-like phrase score (0-100), AdSense risk and the problems the rule-based checks found. Start here for any site-wide question.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_post",
    description:
      "Read one post or page as its full JSON file. Field paths in the JSON (for example sections.2.body or faq.0.a) are what propose_edit needs. _note is the writer's private note: use it as context, never quote it as if it were published.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...DOC_TYPES] },
        slug: { type: "string" },
      },
      required: ["type", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "run_checks",
    description:
      "Run the rule-based AdSense and writing checks. With no arguments, checks the whole site (policy pages, contact details, post count, author profile, ads.txt and so on). With type and slug, checks one post in detail, including each AI-style phrase found and where.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...DOC_TYPES] },
        slug: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "propose_edit",
    description:
      "Propose replacing text in one field of one post. The editor sees a card with the old and new text and decides whether to apply it; nothing is saved by this call. old_text must be copied exactly from read_post output and appear exactly once in that field; keep it to the passage you are changing, not the whole field. You cannot change type, slug, status, dates, author, editorial, links or ids. Propose one focused change per call.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...DOC_TYPES] },
        slug: { type: "string" },
        path: { type: "string", description: "Dot path to a text field, e.g. sections.0.body, title, metaDescription, faq.1.a" },
        old_text: { type: "string", description: "Exact current text to replace." },
        new_text: { type: "string", description: "Replacement text, in the post's own style." },
        reason: { type: "string", description: "One sentence for the editor: what was wrong and why this is better." },
      },
      required: ["type", "slug", "path", "old_text", "new_text", "reason"],
      additionalProperties: false,
    },
  },
];

const TypeSlug = z.object({ type: z.enum(DOC_TYPES), slug: z.string().min(1) });
const ChecksInput = z.object({ type: z.enum(DOC_TYPES).optional(), slug: z.string().min(1).optional() });
const EditInput = z.object({
  type: z.enum(DOC_TYPES),
  slug: z.string().min(1),
  path: z.string().min(1),
  old_text: z.string().min(1),
  new_text: z.string(),
  reason: z.string().min(1),
});

export type Proposal = {
  id: string;
  type: string;
  slug: string;
  title: string;
  path: string;
  oldText: string;
  newText: string;
  reason: string;
  published: boolean;
};

/** Events streamed to the browser, one JSON object per line. */
export type AssistantEvent =
  | { kind: "text"; text: string }
  | { kind: "activity"; text: string }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "messages"; messages: BetaMessageParam[] }
  | { kind: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number | null }
  | { kind: "error"; message: string }
  | { kind: "done" };

async function rawDocs(): Promise<Raw[]> {
  return (await listRawDocs())
    .map((f) => f.raw)
    .filter((r): r is Raw => Boolean(r) && typeof r === "object" && typeof (r as Raw).slug === "string");
}

async function runTool(name: string, input: unknown, emit: (e: AssistantEvent) => void): Promise<{ content: string; isError?: boolean }> {
  switch (name) {
    case "list_posts": {
      emit({ kind: "activity", text: "Listing every post" });
      const { posts } = await auditSite();
      const pages = (await rawDocs())
        .filter((d) => d.type === "page")
        .map((d) => ({ type: "page", slug: d.slug, title: d.title, status: d.status }));
      const rows = posts.map((p) => ({
        type: p.type,
        slug: p.slug,
        title: p.title,
        status: p.status,
        words: p.report.words,
        aiLikeScore: p.report.aiScore,
        adsenseRisk: p.report.risk,
        problems: p.report.checks.filter((c) => c.level === "fail" || c.level === "warn").map((c) => `${c.level}: ${c.label}`),
      }));
      return { content: JSON.stringify({ posts: rows, pages }) };
    }
    case "read_post": {
      const parsed = TypeSlug.safeParse(input);
      if (!parsed.success) return { content: `invalid input: ${parsed.error.message}`, isError: true };
      const raw = (await readRawDoc(parsed.data.type, parsed.data.slug)) as Raw | null;
      if (!raw) return { content: `no ${parsed.data.type} with slug "${parsed.data.slug}"`, isError: true };
      emit({ kind: "activity", text: `Reading "${String(raw.title ?? parsed.data.slug)}"` });
      return { content: JSON.stringify(raw, null, 1) };
    }
    case "run_checks": {
      const parsed = ChecksInput.safeParse(input ?? {});
      if (!parsed.success) return { content: `invalid input: ${parsed.error.message}`, isError: true };
      const { type, slug } = parsed.data;
      if (type && slug) {
        const raw = (await readRawDoc(type, slug)) as Raw | null;
        if (!raw) return { content: `no ${type} with slug "${slug}"`, isError: true };
        emit({ kind: "activity", text: `Checking "${String(raw.title ?? slug)}"` });
        return { content: JSON.stringify(checkPost(raw, await siblings())) };
      }
      emit({ kind: "activity", text: "Checking the whole site" });
      const { site } = await auditSite();
      return { content: JSON.stringify({ siteChecks: site }) };
    }
    case "propose_edit": {
      const parsed = EditInput.safeParse(input);
      if (!parsed.success) return { content: JSON.stringify({ INVALID_JSON: JSON.stringify(input) }), isError: true };
      const e = parsed.data;
      const check = await previewEdit({ type: e.type, slug: e.slug, path: e.path, oldText: e.old_text, newText: e.new_text });
      if (!check.ok) return { content: `edit not proposed: ${check.reason}`, isError: true };
      const proposal: Proposal = {
        id: crypto.randomUUID().slice(0, 8),
        type: e.type,
        slug: e.slug,
        title: check.title,
        path: e.path,
        oldText: e.old_text,
        newText: e.new_text,
        reason: e.reason,
        published: check.published,
      };
      emit({ kind: "proposal", proposal });
      return { content: `Shown to the editor as edit ${proposal.id}. They will apply or reject it; you will be told which in their next message.` };
    }
    default:
      return { content: `unknown tool "${name}"`, isError: true };
  }
}

/* ---------------------------------- prompt ---------------------------------- */

function systemPrompt(): string {
  const site = getSite();
  return `You are the editorial assistant inside the admin studio of ${site.name} (${site.url}), a ${site.defaultLocale === "en-GB" ? "UK" : "US"} consumer tech site: ${site.tagline}

The person talking to you is the site's owner and writer. They are not a developer, so explain in plain words and never ask them to edit JSON.

What they want from you:
- Find what is wrong with their content and what to fix, especially anything that would get the site refused by Google AdSense: thin posts, generic text with no first-hand experience, writing that reads as machine-generated, missing sources, missing policy pages, and anything against the AdSense publisher policies.
- Fix it with them. When a passage should change, call propose_edit with a concrete rewrite. The editor approves each edit; you never save anything yourself.

How to work:
- Use the tools to look before you answer. Start site-wide questions with list_posts and run_checks, and read a post before you judge or edit it. Do not guess what a post says.
- Rank problems by how much they matter for approval and for readers, and say which posts to fix first.
- The rule-based checks are a starting point. Read the actual text: a post can pass every rule and still be generic, or fail one for a harmless reason. Say so when you disagree with a check.
- No tool, including you, can prove who or what wrote a text. Judge the writing, not the author.
- Never invent test results, measurements, prices, dates or personal experiences. Where a post needs first-hand detail, say exactly what the writer should go and find out or add, and leave a clear placeholder out of your edits rather than making it up.
- Keep edits focused: one passage per propose_edit, old_text copied exactly from read_post, new_text in the post's voice. Do not propose more than about six edits in one reply unless asked.
- Write in ${site.defaultLocale === "en-US" ? "American" : "British"} English. Never use em dashes, in your replies or in edits.
- Be direct and brief. Use short headings and lists when it helps; no filler.`;
}

/* ----------------------------------- loop ----------------------------------- */

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

const MAX_STEPS = 24;

/**
 * Run one user turn: call Claude, run its tool calls, repeat until it answers.
 * `history` is the full API conversation so far (kept by the browser) ending with
 * the new user message. Emits text as it streams, plus activity, proposals, the
 * messages to append to the history, and usage.
 */
export async function runTurn(history: BetaMessageParam[], emit: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void> {
  const client = new Anthropic({ defaultHeaders: anthropicWorkspaceHeaders() });
  const model = ASSISTANT_MODEL();
  const messages = [...history];
  const added: BetaMessageParam[] = [];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let jsonRetries = 0;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 64000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          cache_control: { type: "ephemeral" },
          system: systemPrompt(),
          tools: TOOLS,
          messages,
        },
        { signal },
      );
      stream.on("text", (delta) => emit({ kind: "text", text: delta }));

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only an unparseable streamed tool input is retried; API errors go up.
        if (err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err;
        continue;
      }

      usage.input += message.usage.input_tokens ?? 0;
      usage.output += message.usage.output_tokens ?? 0;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

      // Append the assistant turn unchanged (thinking blocks included).
      const assistantTurn: BetaMessageParam = { role: "assistant", content: message.content };
      messages.push(assistantTurn);
      added.push(assistantTurn);

      if (message.stop_reason === "refusal") {
        emit({ kind: "error", message: "Claude declined to answer that. Try rephrasing the request." });
        break;
      }
      if (message.stop_reason === "pause_turn") continue;

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break;
      if (message.stop_reason === "max_tokens") {
        throw new Error("The reply was cut off. Ask for less at once, for example one post at a time.");
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(toolUses.map(async (t): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const r = await runTool(t.name, t.input, emit);
          return { type: "tool_result", tool_use_id: t.id, content: r.content, is_error: r.isError };
        } catch (err) {
          return { type: "tool_result", tool_use_id: t.id, content: `tool failed: ${err instanceof Error ? err.message : String(err)}`, is_error: true };
        }
      }));
      const resultTurn: BetaMessageParam = { role: "user", content: results };
      messages.push(resultTurn);
      added.push(resultTurn);
      emit({ kind: "text", text: "\n\n" });
    }
  } catch (err) {
    if (signal.aborted) return;
    emit({ kind: "error", message: describeError(err) });
  } finally {
    // The browser appends these to its copy of the conversation. If the turn ended
    // on a tool call with no reply, drop that dangling call so the history stays valid.
    while (added.length && endsWithToolUse(added[added.length - 1])) added.pop();
    emit({ kind: "messages", messages: added });
    const p = PRICES[model];
    emit({
      kind: "usage",
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      cacheWriteTokens: usage.cacheWrite,
      costUsd: p
        ? (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) / 1_000_000
        : null,
    });
    emit({ kind: "done" });
  }
}

function endsWithToolUse(m: BetaMessageParam): boolean {
  return m.role === "assistant" && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use");
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude rejected the API key. Check ANTHROPIC_API_KEY in .env.local.";
  if (err instanceof Anthropic.RateLimitError) return "Claude rate limit reached. Wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError && /workspace/i.test(err.message)) {
    return "Your API key is not tied to a workspace. Add ANTHROPIC_WORKSPACE_ID (it starts wrkspc_, from console.anthropic.com under Workspaces) to .env.local and restart npm run dev, or use a key created inside a workspace.";
  }
  if (err instanceof Anthropic.BadRequestError) return `Claude could not process the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude returned an error (${err.status ?? "network"}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/** Pages of the site, for the welcome screen. */
export async function siteSummary(): Promise<{ posts: number; published: number }> {
  const docs = (await rawDocs()).filter((d) => d.type !== "page");
  return { posts: docs.length, published: docs.filter((d) => d.status === "published").length };
}

