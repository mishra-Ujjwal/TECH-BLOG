"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadJson } from "./editor";

export type StudioRow = {
  key: string;
  type: string | null;
  /** "review", "pillar", "page" or "article:<format>" */
  kind: string;
  category: string | null;
  aiAssisted: boolean;
  slug: string;
  title: string;
  sourcePath: string;
  categoryLabel: string;
  typeLabel: string;
  status: string;
  date: string;
  error: boolean;
  viewHref: string | null;
};

/**
 * The studio's document list, with checkboxes and bulk status changes. Publishing in
 * bulk runs every file through the same checks as the editor, and anything that fails
 * is listed with the reason and left as it was.
 */
type Filters = {
  q: string;
  status: "all" | "draft" | "published";
  category: string;
  kind: string;
  ai: "all" | "yes" | "no";
  sort: "newest" | "oldest" | "title";
};
const NO_FILTERS: Filters = { q: "", status: "all", category: "all", kind: "all", ai: "all", sort: "newest" };

export function DocTable({
  rows,
  categories,
  kinds,
}: {
  rows: StudioRow[];
  categories: { slug: string; name: string }[];
  kinds: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, setResult] = useState<{ done: string[]; failed: { slug: string; reason: string }[]; status: string } | null>(null);
  const allBox = useRef<HTMLInputElement>(null);

  // Changing a filter clears the selection, so nothing hidden stays selected.
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (k !== "sort") setSelected(new Set());
  };
  const active = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter(
    (k) => k !== "sort" && f[k] !== NO_FILTERS[k],
  ).length;

  const count = (pred: (r: StudioRow) => boolean) => rows.filter(pred).length;

  const visible = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (f.status === "all" || r.status === f.status) &&
        (f.category === "all" || (f.category === "none" ? !r.category : r.category === f.category)) &&
        (f.kind === "all" || r.kind === f.kind) &&
        (f.ai === "all" || (f.ai === "yes") === r.aiAssisted) &&
        (!q || r.title.toLowerCase().includes(q) || r.slug.includes(q)),
    );
    return out.sort((a, b) =>
      f.sort === "title"
        ? a.title.localeCompare(b.title)
        : f.sort === "oldest"
          ? a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
          : b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    );
  }, [rows, f]);
  const selectable = visible.filter((r) => r.type && r.slug);
  const chosen = selectable.filter((r) => selected.has(r.key));
  const allOn = selectable.length > 0 && chosen.length === selectable.length;
  useEffect(() => setConfirmDelete(false), [chosen.length]);

  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = chosen.length > 0 && !allOn;
  }, [chosen.length, allOn]);

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      for (const r of selectable) {
        if (allOn) n.delete(r.key);
        else n.add(r.key);
      }
      return n;
    });

  async function exportSelected() {
    const res = await fetch("/api/studio/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: chosen.map((r) => ({ type: r.type, slug: r.slug })) }),
    });
    const data = await res.json();
    const docs = data.docs ?? [];
    downloadJson(
      docs.length === 1 ? `${docs[0].slug}.json` : `technoworld360-posts-${new Date().toISOString().slice(0, 10)}.json`,
      docs.length === 1 ? docs[0] : { docs },
    );
  }

  async function apply(status: "published" | "draft" | "delete") {
    if (chosen.length === 0) return;
    setBusy(true);
    setResult(null);
    setConfirmDelete(false);
    try {
      const items = chosen.map((r) => ({ type: r.type, slug: r.slug }));
      const res = await fetch("/api/studio/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(status === "delete" ? { action: "delete", items } : { status, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setResult({ ...data, status });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setResult({ done: [], failed: [{ slug: "", reason: e instanceof Error ? e.message : String(e) }], status });
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 rounded-lg border border-rule-strong bg-paper px-2.5 py-1.5 text-small";
  const btn = "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2 disabled:opacity-50";

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
        <label className="block">
          <span className="text-micro text-ink-3">Search titles</span>
          <input
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="e.g. battery"
            className={`${field} w-full`}
          />
        </label>
        <label className="block">
          <span className="text-micro text-ink-3">Category</span>
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className={`${field} w-full`}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({count((r) => r.category === c.slug)})
              </option>
            ))}
            <option value="none">No category ({count((r) => !r.category)})</option>
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-ink-3">Type</span>
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className={`${field} w-full`}>
            <option value="all">All types</option>
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label} ({count((r) => r.kind === k.value)})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-ink-3">Status</span>
          <select value={f.status} onChange={(e) => set("status", e.target.value as Filters["status"])} className={`${field} w-full`}>
            <option value="all">All ({rows.length})</option>
            <option value="draft">Drafts ({count((r) => r.status === "draft")})</option>
            <option value="published">Published ({count((r) => r.status === "published")})</option>
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-ink-3">Written with AI</span>
          <select value={f.ai} onChange={(e) => set("ai", e.target.value as Filters["ai"])} className={`${field} w-full`}>
            <option value="all">Either</option>
            <option value="yes">AI-assisted ({count((r) => r.aiAssisted)})</option>
            <option value="no">Not AI-assisted ({count((r) => !r.aiAssisted)})</option>
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-ink-3">Sort</span>
          <select value={f.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className={`${field} w-full`}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A to Z</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-rule px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small">
          <label className="flex items-center gap-2 font-medium">
            <input ref={allBox} type="checkbox" checked={allOn} onChange={toggleAll} disabled={selectable.length === 0} />
            Select all{active > 0 ? " shown" : ""}
          </label>
          <span className="text-ink-3">
            {chosen.length} selected, {visible.length} of {rows.length} shown
          </span>
          {active > 0 && (
            <button
              type="button"
              className="link text-small"
              onClick={() => {
                setF((prev) => ({ ...NO_FILTERS, sort: prev.sort }));
                setSelected(new Set());
              }}
            >
              Clear filters ({active})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {confirmDelete ? (
            <>
              <button type="button" className={btn} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => apply("delete")}
                className="rounded-lg border border-caution bg-caution px-3 py-1.5 text-small font-medium text-paper disabled:opacity-50"
              >
                Yes, delete {chosen.length}
              </button>
              {chosen.some((r) => r.type === "page") && (
                <span className="basis-full text-micro text-caution">
                  Includes {chosen.filter((r) => r.type === "page").length} static page
                  {chosen.filter((r) => r.type === "page").length === 1 ? "" : "s"} such as the privacy policy or
                  terms, which the site needs.
                </span>
              )}
            </>
          ) : (
            <button
              type="button"
              className={`${btn} text-caution`}
              disabled={busy || chosen.length === 0}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
          <button type="button" className={btn} disabled={busy || chosen.length === 0} onClick={exportSelected}>
            Download JSON
          </button>
          <button type="button" className={btn} disabled={busy || chosen.length === 0} onClick={() => apply("draft")}>
            Move to draft
          </button>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => apply("published")}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50"
          >
            {busy ? "Working" : `Publish${chosen.length ? ` ${chosen.length}` : ""}`}
          </button>
        </div>
      </div>

      {result && (
        <div role="status" className="mt-3 rounded-[10px] border border-rule px-4 py-3 text-small">
          {result.done.length > 0 && (
            <p>
              {result.done.length}{" "}
              {result.status === "published"
                ? "published"
                : result.status === "delete"
                  ? "deleted. The files were moved to content/.trash/, so they can be restored by moving them back."
                  : "moved to draft"}
              {result.status === "delete" ? "" : "."}
            </p>
          )}
          {result.failed.length > 0 && (
            <>
              <p className="font-medium text-caution">
                {result.failed.length} not changed. Fix these, then try again:
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-micro">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    {f.slug && <span className="text-ink">{f.slug}: </span>}
                    <span className="text-caution">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="relative mt-4 overflow-x-auto">
        <table className="data w-full min-w-[40rem]">
          <thead>
            <tr>
              <th scope="col" className="w-8">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Published</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-small text-ink-2">
                  Nothing matches these filters.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.key} className={selected.has(r.key) ? "bg-paper-2" : ""}>
                <td>
                  {r.type && r.slug && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.title}`}
                      checked={selected.has(r.key)}
                      onChange={() => toggle(r.key)}
                    />
                  )}
                </td>
                <td>
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-micro text-ink-3">
                    {r.sourcePath}
                    {r.categoryLabel ? `, ${r.categoryLabel}` : ""}
                  </span>
                  {r.error && <span className="block text-micro text-caution">Does not pass validation</span>}
                </td>
                <td className="text-small">{r.typeLabel}</td>
                <td className="text-small">{r.status === "published" ? "Published" : "Draft"}</td>
                <td className="num text-small">{r.date}</td>
                <td className="whitespace-nowrap text-right text-small">
                  {r.type && r.slug && (
                    <Link href={`/studio/edit/${r.type}/${r.slug}`} className="link">
                      Edit
                    </Link>
                  )}
                  {r.viewHref && (
                    <Link href={r.viewHref} className="link ml-3">
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
