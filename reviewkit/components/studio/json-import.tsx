"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Add posts as JSON: paste text or choose files. Accepts one post, a list of posts,
 * or { "docs": [...] }. Everything goes through the same checks as the form.
 */

type Saved = { slug: string; type: string; status: string; url: string | null; warnings: string[] };
type Failed = { index: number; slug: string; errors: string[] };

const TEMPLATES: { label: string; type: string; format?: string }[] = [
  { label: "Explainer", type: "article", format: "explainer" },
  { label: "How-to", type: "article", format: "how-to" },
  { label: "Comparison", type: "article", format: "comparison" },
  { label: "Troubleshooting", type: "article", format: "troubleshooting" },
  { label: "News analysis", type: "article", format: "news-analysis" },
  { label: "Review", type: "review" },
  { label: "Buying guide", type: "pillar" },
  { label: "Static page", type: "page" },
];

/** Pull the posts out of whatever shape was pasted. */
function toDocs(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { docs?: unknown }).docs)) {
    return (value as { docs: unknown[] }).docs;
  }
  return [value];
}

const btn = "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2 disabled:opacity-50";

export function JsonImport() {
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [status, setStatus] = useState<"keep" | "draft" | "published">("draft");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<{ saved: Saved[]; failed: Failed[] } | null>(null);

  let count = 0;
  if (text.trim()) {
    try {
      count = toDocs(JSON.parse(text)).length;
    } catch {
      count = 0;
    }
  }

  async function loadTemplate(type: string, format?: string) {
    const res = await fetch(`/api/studio/template?type=${type}${format ? `&format=${format}` : ""}`);
    const doc = await res.json();
    setText(JSON.stringify(doc, null, 2));
    setFileNote("");
    setResult(null);
    setParseError("");
  }

  async function readFiles(files: FileList) {
    const docs: unknown[] = [];
    const bad: string[] = [];
    for (const f of Array.from(files)) {
      try {
        docs.push(...toDocs(JSON.parse(await f.text())));
      } catch {
        bad.push(f.name);
      }
    }
    setText(JSON.stringify(docs.length === 1 ? docs[0] : docs, null, 2));
    setFileNote(
      `${files.length} file${files.length === 1 ? "" : "s"} read, ${docs.length} post${docs.length === 1 ? "" : "s"} found` +
        (bad.length ? `. Not valid JSON: ${bad.join(", ")}` : ""),
    );
    setResult(null);
    setParseError("");
  }

  async function submit() {
    setResult(null);
    let docs: unknown[];
    try {
      docs = toDocs(JSON.parse(text));
      setParseError("");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/studio/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docs, status, overwrite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "import failed");
      setResult(data);
    } catch (e) {
      setResult({ saved: [], failed: [{ index: 0, slug: "", errors: [e instanceof Error ? e.message : String(e)] }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btn} cursor-pointer`}>
            Choose .json files
            <input
              type="file"
              accept="application/json,.json"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) readFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-small text-ink-3">or paste below</span>
          {text && (
            <button type="button" className="link ml-auto text-small" onClick={() => { setText(""); setFileNote(""); setResult(null); }}>
              Clear
            </button>
          )}
        </div>
        {fileNote && <p className="mt-2 text-small text-ink-2">{fileNote}</p>}

        <textarea
          aria-label="Posts as JSON"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setParseError("");
          }}
          placeholder={'{\n  "type": "article",\n  "format": "explainer",\n  "title": "...",\n  ...\n}'}
          className="mt-3 min-h-[32rem] w-full rounded-lg border border-rule-strong bg-paper px-3 py-2 font-mono text-micro leading-relaxed text-ink placeholder:text-ink-3"
        />
        {parseError && (
          <div className="mt-1.5 text-small text-caution">
            <p>Not valid JSON: {parseError}</p>
            {/control character/i.test(parseError) && (
              <p className="mt-1 text-ink-2">
                This usually means line breaks got into the text while copying, for example from a terminal or chat
                window that wraps long lines. Save the JSON as a .json file and use <strong>Choose .json files</strong>{" "}
                instead of pasting.
              </p>
            )}
          </div>
        )}

        {result && (
          <div role="status" className="mt-4 space-y-4">
            {result.saved.length > 0 && (
              <div className="rounded-[10px] border border-rule px-4 py-3">
                <p className="font-medium">
                  {result.saved.length} saved
                </p>
                <ul className="mt-2 space-y-1.5 text-small">
                  {result.saved.map((s) => (
                    <li key={`${s.type}-${s.slug}`}>
                      <Link href={`/studio/edit/${s.type}/${s.slug}`} className="link">
                        {s.slug}
                      </Link>{" "}
                      <span className="text-ink-3">({s.status === "published" ? "published" : "draft"})</span>
                      {s.url && (
                        <>
                          {" "}
                          <Link href={s.url} className="link" target="_blank">
                            view
                          </Link>
                        </>
                      )}
                      {s.warnings.length > 0 && (
                        <span className="block text-micro text-ink-3">Worth a look: {s.warnings.join("; ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="rounded-[10px] border border-rule px-4 py-3">
                <p className="font-medium text-caution">{result.failed.length} not saved. Fix these and import again:</p>
                <ul className="mt-2 max-h-80 space-y-2 overflow-auto text-micro">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      <span className="text-ink">
                        Post {f.index + 1}
                        {f.slug ? ` (${f.slug})` : ""}:
                      </span>
                      <ul className="ml-4 list-disc text-caution">
                        {f.errors.map((e, k) => (
                          <li key={k}>{e}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="order-first lg:order-none">
        <div className="space-y-5 lg:sticky lg:top-6">
          <div className="rounded-[10px] border border-rule p-4">
            <p className="text-small">
              {count > 0 ? (
                <>
                  <span className="font-semibold">{count}</span> post{count === 1 ? "" : "s"} ready to import
                </>
              ) : (
                <span className="text-ink-3">Paste JSON or choose files</span>
              )}
            </p>

            <fieldset className="mt-4">
              <legend className="text-small font-medium">Status</legend>
              {(
                [
                  ["draft", "Save as drafts"],
                  ["published", "Publish"],
                  ["keep", "Use the status in the JSON"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="mt-1.5 flex items-center gap-2 text-small">
                  <input type="radio" name="status" checked={status === v} onChange={() => setStatus(v)} />
                  {label}
                </label>
              ))}
            </fieldset>

            <label className="mt-4 flex items-start gap-2 text-small">
              <input type="checkbox" className="mt-1" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              <span>
                Replace existing
                <span className="block text-micro text-ink-3">Update posts that already have the same slug.</span>
              </span>
            </label>

            <button
              type="button"
              disabled={busy || count === 0}
              onClick={submit}
              className="mt-5 w-full rounded-lg bg-accent px-3.5 py-2 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50"
            >
              {busy ? "Importing" : `Import ${count || ""}`.trim()}
            </button>
            <p className="mt-3 text-micro text-ink-3">
              Each post is checked exactly like the form. Anything that fails is listed with the reason and not saved.
            </p>
          </div>

          <div className="rounded-[10px] border border-rule p-4">
            <p className="text-small font-medium">Start from a template</p>
            <p className="mt-1 text-micro text-ink-3">Fills the box with every required field for that kind of post.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" className={btn} onClick={() => loadTemplate(t.type, t.format)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] border border-rule p-4 text-micro leading-relaxed text-ink-2">
            <p className="text-small font-medium text-ink">Accepted shapes</p>
            <p className="mt-1">One post: <code>{"{ ... }"}</code></p>
            <p>Several: <code>{"[ {...}, {...} ]"}</code></p>
            <p>Or: <code>{'{ "docs": [ ... ] }'}</code></p>
            <p className="mt-2">
              <code>schemaVersion</code> is added if missing. Text fields use Markdown. To see the exact shape of an
              existing post, open it and use <strong>Download JSON</strong>.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
