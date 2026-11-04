"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { AssistantEvent, Proposal } from "@/lib/assistant";

/**
 * The studio assistant chat. The conversation lives in this tab only (sessionStorage),
 * and is sent whole with each message. Edits Claude proposes appear as cards; only
 * Apply on a card saves anything.
 */

type Part = { kind: "text"; text: string } | { kind: "activity"; text: string } | { kind: "proposal"; proposal: Proposal };
type Item =
  | { role: "user"; text: string; about?: string }
  | { role: "assistant"; parts: Part[]; cost?: number | null; error?: string; pending?: boolean };
type Decision = { state: "applying" | "applied" | "rejected" | "failed"; note?: string };
type Saved = { items: Item[]; api: unknown[]; decisions: Record<string, Decision>; notes: string[] };

const STORE = "studio-assistant:v1";
const btn = "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2 disabled:opacity-50";
const btnMain = "rounded-lg bg-accent px-3 py-1.5 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50";

function load(key: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, s: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(s));
  } catch {}
}

/* --------------------- markdown, rendered as React elements -------------------- */

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={m.index}>{t.slice(2, -2)}</strong> : <code key={m.index}>{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {list.items.map((t, i) => (
          <li key={i}>{inline(t)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (heading) blocks.push(<h3 key={blocks.length} className="mt-2 font-semibold">{inline(heading[1])}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

/* ------------------------------------ card ----------------------------------- */

function ProposalCard({ p, decision, onApply, onReject }: { p: Proposal; decision?: Decision; onApply: () => void; onReject: () => void }) {
  const done = decision && decision.state !== "applying" && decision.state !== "failed";
  return (
    <div className="rounded-[10px] border border-rule bg-paper p-4 text-small">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          Edit to{" "}
          <Link href={`/studio/edit/${p.type}/${p.slug}`} className="link">
            {p.title}
          </Link>
        </p>
        <code className="text-micro text-ink-3">{p.path}</code>
      </div>
      <p className="mt-1 text-ink-2">{p.reason}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-paper-2 p-3">
          <p className="text-micro font-semibold text-ink-3">Now</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-ink-2 line-through decoration-rule-strong">{p.oldText}</p>
        </div>
        <div className="rounded-lg bg-accent-wash p-3">
          <p className="text-micro font-semibold text-accent">Proposed</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{p.newText}</p>
        </div>
      </div>
      {p.published && !done && (
        <p className="mt-2 text-micro text-caution">This post is live. Applying changes the site straight away.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!done && (
          <>
            <button type="button" className={btnMain} disabled={decision?.state === "applying"} onClick={onApply}>
              {decision?.state === "applying" ? "Applying…" : "Apply"}
            </button>
            <button type="button" className={btn} disabled={decision?.state === "applying"} onClick={onReject}>
              Reject
            </button>
          </>
        )}
        {decision?.state === "applied" && <span className="text-micro font-semibold text-measured">Applied and saved. Reload the editor if this post is open.</span>}
        {decision?.state === "rejected" && <span className="text-micro text-ink-3">Rejected</span>}
        {decision?.state === "failed" && <span className="text-micro text-caution">Not applied: {decision.note}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------ chat ----------------------------------- */

const SITE_PROMPTS = [
  "What is stopping my site getting AdSense approval? Rank what to fix.",
  "Which posts read most like AI, and why?",
  "Check my privacy policy, about and contact pages for AdSense.",
  "Which three posts should I improve first, and how?",
];
const POST_PROMPTS = [
  "What is wrong with this post, and what should I fix first?",
  "Rewrite the parts that read as AI-written.",
  "What first-hand detail should I add to make this post stronger?",
  "Would this post pass an AdSense review?",
];

export function AssistantChat({ configured, focus }: { configured: boolean; focus?: { type: string; slug: string; title: string } }) {
  const [items, setItems] = useState<Item[]>([]);
  const [api, setApi] = useState<unknown[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  // One saved conversation for the whole site, and one per post.
  const storeKey = `${STORE}:${focus ? `${focus.type}/${focus.slug}` : "site"}`;

  useEffect(() => {
    const s = load(storeKey);
    if (s) {
      setItems(s.items.map((i) => (i.role === "assistant" ? { ...i, pending: false } : i)));
      setApi(s.api);
      setDecisions(s.decisions);
      setNotes(s.notes);
    }
    setReady(true);
  }, [storeKey]);

  useEffect(() => {
    if (ready) save(storeKey, { items, api, decisions, notes });
  }, [ready, storeKey, items, api, decisions, notes]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items]);

  const updateLast = (fn: (a: Extract<Item, { role: "assistant" }>) => Extract<Item, { role: "assistant" }>) =>
    setItems((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") copy[copy.length - 1] = fn(last);
      return copy;
    });

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const about = focus && api.length === 0 ? `${focus.title}` : undefined;
    const pendingNotes = notes;
    const context = [
      ...pendingNotes,
      focus && api.length === 0 ? `(I am asking about the ${focus.type} "${focus.title}", slug "${focus.slug}".)` : "",
    ].filter(Boolean);
    const userTurn = { role: "user", content: context.length ? `${context.join("\n")}\n\n${question}` : question };
    const history = [...api, userTurn];

    setInput("");
    setNotes([]);
    setBusy(true);
    setItems((prev) => [...prev, { role: "user", text: question, about }, { role: "assistant", parts: [], pending: true }]);

    const controller = new AbortController();
    abort.current = controller;
    let added: unknown[] = [];
    try {
      const res = await fetch("/api/studio/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `The assistant failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line) as AssistantEvent;
          if (e.kind === "text") {
            updateLast((a) => {
              const parts = [...a.parts];
              const tail = parts[parts.length - 1];
              if (tail?.kind === "text") parts[parts.length - 1] = { kind: "text", text: tail.text + e.text };
              else parts.push({ kind: "text", text: e.text });
              return { ...a, parts };
            });
          } else if (e.kind === "activity") {
            updateLast((a) => ({ ...a, parts: [...a.parts, { kind: "activity", text: e.text }] }));
          } else if (e.kind === "proposal") {
            updateLast((a) => ({ ...a, parts: [...a.parts, { kind: "proposal", proposal: e.proposal }] }));
          } else if (e.kind === "messages") {
            added = e.messages;
          } else if (e.kind === "usage") {
            updateLast((a) => ({ ...a, cost: e.costUsd }));
          } else if (e.kind === "error") {
            updateLast((a) => ({ ...a, error: e.message }));
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) updateLast((a) => ({ ...a, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      // Keep the conversation valid: the user turn stays only if the assistant answered it.
      if (added.length) setApi([...history, ...added]);
      else setNotes(pendingNotes);
      updateLast((a) => ({ ...a, pending: false }));
      setBusy(false);
      abort.current = null;
    }
  }

  async function apply(p: Proposal) {
    setDecisions((d) => ({ ...d, [p.id]: { state: "applying" } }));
    try {
      const res = await fetch("/api/studio/assistant/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: p.type, slug: p.slug, path: p.path, oldText: p.oldText, newText: p.newText }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? `failed (${res.status})`);
      setDecisions((d) => ({ ...d, [p.id]: { state: "applied" } }));
      setNotes((n) => [...n, `(I applied edit ${p.id}.)`]);
    } catch (err) {
      const note = err instanceof Error ? err.message : String(err);
      setDecisions((d) => ({ ...d, [p.id]: { state: "failed", note } }));
      setNotes((n) => [...n, `(Edit ${p.id} could not be applied: ${note}.)`]);
    }
  }

  function reject(p: Proposal) {
    setDecisions((d) => ({ ...d, [p.id]: { state: "rejected" } }));
    setNotes((n) => [...n, `(I rejected edit ${p.id}.)`]);
  }

  function reset() {
    abort.current?.abort();
    setItems([]);
    setApi([]);
    setDecisions({});
    setNotes([]);
  }

  if (!configured) {
    return (
      <div className="rounded-[14px] border border-rule bg-paper p-6 text-small">
        <p className="font-semibold">The assistant needs a Claude API key.</p>
        <p className="mt-1 text-ink-2">
          Add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code>, then restart <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  const prompts = focus ? POST_PROMPTS : SITE_PROMPTS;

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col rounded-[14px] border border-rule bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate text-small text-ink-2">
          {focus ? (
            <>
              About{" "}
              <Link href={`/studio/edit/${focus.type}/${focus.slug}`} className="link">
                {focus.title}
              </Link>
            </>
          ) : (
            "About the whole site"
          )}
        </p>
        <button type="button" className={btn} onClick={reset} disabled={items.length === 0}>
          New chat
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {items.length === 0 && (
          <div>
            <p className="text-small text-ink-2">
              Ask what is wrong with your content and how to fix it. I read your posts and run the AdSense and writing
              checks before answering. When I suggest a rewrite, you approve it before anything is saved.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {prompts.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    className="w-full rounded-[10px] border border-rule px-3 py-2.5 text-left text-small hover:border-accent hover:bg-paper-2"
                    onClick={() => send(q)}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.map((item, k) =>
          item.role === "user" ? (
            <div key={k} className="ml-auto max-w-[85%] rounded-[12px] bg-paper-2 px-4 py-2.5 text-small">
              {item.about && <span className="block text-micro text-ink-3">About {item.about}</span>}
              <span className="whitespace-pre-wrap">{item.text}</span>
            </div>
          ) : (
            <div key={k} className="space-y-3 text-small">
              {item.parts.map((part, i) => (
                <Fragment key={i}>
                  {part.kind === "text" && part.text.trim() && <Markdown text={part.text} />}
                  {part.kind === "activity" && <p className="text-micro text-ink-3">{part.text}…</p>}
                  {part.kind === "proposal" && (
                    <ProposalCard
                      p={part.proposal}
                      decision={decisions[part.proposal.id]}
                      onApply={() => apply(part.proposal)}
                      onReject={() => reject(part.proposal)}
                    />
                  )}
                </Fragment>
              ))}
              {item.pending && item.parts.length === 0 && <p className="text-micro text-ink-3">Thinking…</p>}
              {item.error && <p className="text-micro text-caution">{item.error}</p>}
              {!item.pending && typeof item.cost === "number" && item.cost > 0 && (
                <p className="text-micro text-ink-3">About ${item.cost < 0.01 ? "0.01" : item.cost.toFixed(2)} of API credit</p>
              )}
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-0 border-t border-rule bg-paper px-4 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        {notes.length > 0 && !busy && (
          <p className="mb-2 text-micro text-ink-3">Your apply and reject decisions are sent with your next message.</p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            Message
          </label>
          <textarea
            id="assistant-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={focus ? "Ask about this post…" : "Ask about your site…"}
            className="min-h-[2.75rem] flex-1 resize-y rounded-lg border border-rule-strong bg-paper px-3 py-2 text-small"
          />
          {busy ? (
            <button type="button" className={btn} onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <button type="submit" className={btnMain} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
