"use client";

import { useEffect, useState } from "react";
import type { PostReport } from "@/lib/adsense-check";
import type { ClaudeReport, Finding, LocalReport } from "@/lib/writing-check";
import { CheckList, RiskBadge } from "./adsense-parts";

/**
 * "Check writing" panel in the editor sidebar. Sends the current form (saved or
 * not) to /api/studio/check and lists what reads as machine-written, plus SEO
 * advice from Claude when a key is set, and what an AdSense reviewer would flag.
 * It never changes the post.
 */

const btnCls =
  "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2 disabled:opacity-50";

function band(score: number): { label: string; cls: string } {
  if (score >= 60) return { label: "Reads as AI-written", cls: "text-caution" };
  if (score >= 30) return { label: "Some AI-like passages", cls: "text-caution" };
  return { label: "Reads as human", cls: "text-measured" };
}

function FindingList({ items, onJump }: { items: Finding[]; onJump: (path: string) => void }) {
  return (
    <ul className="mt-2 max-h-[40vh] space-y-2.5 overflow-auto text-micro">
      {items.map((f, k) => (
        <li key={k} className="border-l-2 border-rule-strong pl-2.5">
          <button type="button" className="text-left hover:underline" onClick={() => onJump(f.path)}>
            &ldquo;{f.quote}&rdquo;
          </button>
          <span className="block text-ink-2">{f.why}</span>
          {f.suggestion && <span className="block text-ink-3">Try: {f.suggestion}</span>}
        </li>
      ))}
    </ul>
  );
}

export function WritingCheck({ doc, onJump }: { doc: unknown; onJump: (path: string) => void }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [local, setLocal] = useState<LocalReport | null>(null);
  const [adsense, setAdsense] = useState<PostReport | null>(null);
  const [claude, setClaude] = useState<ClaudeReport | null>(null);
  const [claudeError, setClaudeError] = useState("");

  useEffect(() => {
    fetch("/api/studio/check")
      .then((r) => r.json())
      .then((d: { claude?: boolean }) => setHasKey(Boolean(d.claude)))
      .catch(() => setHasKey(false));
  }, []);

  async function run(useClaude: boolean) {
    setBusy(true);
    setError("");
    setClaudeError("");
    if (useClaude) setClaude(null);
    try {
      const res = await fetch("/api/studio/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc, useClaude }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Check failed (${res.status})`);
      setLocal(data.local);
      setAdsense(data.adsense ?? null);
      if (data.claude) setClaude(data.claude);
      if (data.claudeError) setClaudeError(data.claudeError);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

  return (
    <div className="rounded-[10px] border border-rule p-4">
      <h2 className="text-small font-semibold">Writing check</h2>
      <p className="mt-1 text-micro text-ink-3">
        Finds passages that read as AI-written or generic, and what an AdSense reviewer would flag, so you can fix them in your own words. It checks
        what is in the form now, saved or not, and never changes the post.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnCls} disabled={busy} onClick={() => run(false)}>
          Quick check
        </button>
        <button
          type="button"
          className="rounded-lg bg-accent px-3 py-1.5 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50"
          disabled={busy || !hasKey}
          onClick={() => run(true)}
        >
          {busy ? "Checking…" : "Check with Claude"}
        </button>
      </div>
      {hasKey === false && (
        <p className="mt-2 text-micro text-ink-3">
          To use Claude, add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> and restart{" "}
          <code>npm run dev</code>. The quick check works without it.
        </p>
      )}
      {error && <p className="mt-2 text-micro text-caution">{error}</p>}

      {local && (
        <div className="mt-4 border-t border-rule pt-3">
          <p className="text-small">
            <span className="font-semibold">Quick check:</span>{" "}
            {local.findings.length === 0
              ? `no common AI phrases in ${local.words.toLocaleString("en-GB")} words`
              : `${local.findings.length} AI-style phrase${local.findings.length === 1 ? "" : "s"} in ${local.words.toLocaleString("en-GB")} words`}
          </p>
          {local.findings.length > 0 && <FindingList items={local.findings} onJump={onJump} />}
        </div>
      )}

      {adsense && (
        <div className="mt-4 border-t border-rule pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-small font-semibold">AdSense</h3>
            <RiskBadge risk={adsense.risk} />
          </div>
          <div className="mt-2">
            {adsense.checks.some((c) => c.level !== "pass") ? (
              <CheckList checks={adsense.checks} onJump={onJump} hidePassed small />
            ) : (
              <p className="text-micro text-measured">Nothing an AdSense reviewer would obviously flag.</p>
            )}
          </div>
        </div>
      )}

      {claudeError && <p className="mt-3 text-micro text-caution">Claude: {claudeError}</p>}

      {claude && (
        <div className="mt-4 space-y-4 border-t border-rule pt-3">
          <div>
            <p className="text-small">
              <span className="font-semibold">Claude:</span>{" "}
              <span className={`font-semibold ${band(claude.aiLikeScore).cls}`}>
                {band(claude.aiLikeScore).label} ({claude.aiLikeScore}/100)
              </span>
            </p>
            <p className="mt-1 text-micro text-ink-2">{claude.verdict}</p>
            {claude.reasons.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-micro text-ink-2">
                {claude.reasons.map((r, k) => (
                  <li key={k}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          {claude.findings.length > 0 && (
            <div>
              <h3 className="text-small font-semibold">Rewrite these</h3>
              <FindingList items={claude.findings} onJump={onJump} />
            </div>
          )}

          <div>
            <h3 className="text-small font-semibold">SEO</h3>
            <p className="mt-1 text-micro">
              <span className="text-ink-3">Main search phrase:</span> {claude.seo.primaryKeyword}
            </p>
            {claude.seo.relatedKeywords.length > 0 && (
              <p className="mt-1 text-micro">
                <span className="text-ink-3">Also cover:</span> {claude.seo.relatedKeywords.join(", ")}
              </p>
            )}
            {claude.seo.titleIdeas.length > 0 && (
              <ul className="mt-2 space-y-1 text-micro">
                {claude.seo.titleIdeas.map((t, k) => (
                  <li key={k}>
                    <button type="button" className="text-left hover:underline" onClick={() => copy(t)} title="Copy">
                      {t}
                    </button>{" "}
                    <span className="text-ink-3">({t.length})</span>
                  </li>
                ))}
              </ul>
            )}
            {claude.seo.metaDescription && (
              <p className="mt-2 text-micro">
                <span className="text-ink-3">Meta description ({claude.seo.metaDescription.length}):</span>{" "}
                <button type="button" className="text-left hover:underline" onClick={() => copy(claude.seo.metaDescription)} title="Copy">
                  {claude.seo.metaDescription}
                </button>
              </p>
            )}
            {claude.seo.issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-micro text-ink-2">
                {claude.seo.issues.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-micro text-ink-3">Click a title or description to copy it.</p>
          </div>

          {claude.adsense && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-small font-semibold">AdSense review</h3>
                <RiskBadge risk={claude.adsense.risk} />
              </div>
              <p className="mt-1 text-micro text-ink-2">{claude.adsense.summary}</p>
              {claude.adsense.issues.length > 0 && (
                <ul className="mt-2 space-y-2.5 text-micro">
                  {claude.adsense.issues.map((i, k) => (
                    <li key={k} className="border-l-2 border-rule-strong pl-2.5">
                      {i.path ? (
                        <button type="button" className="text-left font-medium hover:underline" onClick={() => onJump(i.path!)}>
                          {i.problem}
                        </button>
                      ) : (
                        <span className="font-medium">{i.problem}</span>
                      )}
                      <span className="block text-ink-3">Fix: {i.fix}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {claude.claimsToSource.length > 0 && (
            <div>
              <h3 className="text-small font-semibold">Check or source these facts</h3>
              <ul className="mt-2 space-y-2 text-micro">
                {claude.claimsToSource.map((c, k) => (
                  <li key={k} className="border-l-2 border-rule-strong pl-2.5">
                    <button type="button" className="text-left hover:underline" onClick={() => onJump(c.path)}>
                      {c.claim}
                    </button>
                    <span className="block text-ink-3">{c.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-micro text-ink-3">
            No tool can prove whether text was written by AI. Treat the score as a guide to which parts need your own
            experience and detail.
          </p>
        </div>
      )}
    </div>
  );
}
