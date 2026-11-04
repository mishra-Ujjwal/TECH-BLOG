"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { WritingCheck } from "./writing-check";
import { docSchema } from "@/lib/content/schema";
import { clean, plain, slugify } from "@/lib/studio-shared";

/**
 * The studio form. It is generated from the JSON Schema of the content contract, so
 * every field the schema allows appears here in the same shape, and a new field added
 * to lib/content/schema.ts shows up without touching this file. A few keys get a
 * better control than the generic one (category, author, slugs, images, Markdown).
 */

type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: (string | number)[];
  const?: unknown;
  default?: unknown;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

type Json = unknown;
type Obj = Record<string, Json>;
type Issue = { path: string; message: string };


export type StudioOptions = {
  categories: { slug: string; name: string }[];
  authors: { slug: string; name: string }[];
  pillars: string[];
  reviews: string[];
};

/* ----------------------------- labels and hints ----------------------------- */

const LABELS: Record<string, string> = {
  metaDescription: "Meta description",
  headline: "On-page headline",
  excerpt: "Excerpt",
  answer: "The answer, first",
  testedOn: "Tested on",
  versionTested: "Exact version tested",
  notTested: "Not tested",
  timeNeeded: "Time needed",
  bestFor: "Best for",
  skipIf: "Skip if",
  scoreMax: "Score out of",
  checkedAt: "Price checked on",
  reviewSlug: "Our review",
  sourceId: "Source id",
  licenceUrl: "Licence URL",
  fetchedAt: "Fetched on",
  ogImage: "Share image",
  noindex: "Hide from search engines",
  aiAssisted: "AI helped draft this",
  editedBy: "Edited by",
  approvedOn: "Approved on",
  lastChecked: "Prices and links last checked",
  oneLiner: "One-line reason",
  q: "Question",
  a: "Answer",
  src: "Image",
  alt: "Alt text",
  faq: "FAQ",
  seo: "SEO",
  _note: "Private note (never shown)",
  footer: "Show in footer",
  opinion: "This section is opinion",
};

const HINTS: Record<string, string> = {
  title: "10 to 80 characters. Used in search results and as the headline.",
  slug: "The file name and the URL. Lowercase words joined by hyphens.",
  metaDescription: "70 to 165 characters. The snippet under the title in search results.",
  excerpt: "40 to 300 characters. Shown on the home page and in listings.",
  answer: "Answer the title in plain language before anything else.",
  body: "Markdown: **bold**, [link](/path), - list, blank line for a new paragraph.",
  setup: "Device, OS, network, account tier.",
  alt: "Describe what the picture shows. At least 8 characters.",
  credit: 'Keep "Own screenshot" or "Own photo" for your own work.',
  evidence: "The number or observation behind this claim.",
  sourceId: "The id of an entry in Sources below.",
  checkedAt: "Always shown next to the price.",
  affiliate: "Ticked links are marked and get rel=\"sponsored nofollow\".",
  opinion: "Labelled as opinion on the page. News analysis needs one.",
  versionTested: "Required for a how-to, e.g. \"iOS 18.1\" or \"Notely 3.2.1\".",
  notTested: "Be explicit about the limits of your test.",
};

const MARKDOWN = new Set(["body", "answer", "summary", "about"]);
const LONG_TEXT = new Set(["excerpt", "metaDescription", "setup", "why", "a", "oneLiner", "caption", "note", "evidence", "_note", "attribution"]);
const HIDDEN_TOP = new Set(["schemaVersion", "type", "status"]);

/** Top-level order: what a writer fills first, then evidence, then housekeeping. */
const ORDER = [
  "format", "title", "headline", "slug", "category", "pillar", "author", "dates", "locale",
  "excerpt", "metaDescription", "answer", "product", "verdict", "scores", "testing",
  "timeNeeded", "requirements", "products", "steps", "sections", "picks", "specs", "prices",
  "media", "alternatives", "faq", "sources", "tags", "footer", "seo", "editorial", "_note",
];

/** "sources.0.url" becomes "Sources, item 1, Url" for the checklist. */
function pathLabel(path: string): string {
  if (!path) return "Post";
  return path
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `item ${Number(part) + 1}` : labelFor(part)))
    .join(", ");
}

function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ---------------------------------- helpers --------------------------------- */

function typeOf(s: JSONSchema): string {
  if (s.enum) return "enum";
  if (Array.isArray(s.type)) return s.type.includes("number") ? "number|string" : s.type[0];
  return s.type ?? "any";
}

/** A value to start a new item or optional block with: required keys only. */
function emptyFor(s: JSONSchema): Json {
  if (s.default !== undefined && typeOf(s) !== "object") return structuredClone(s.default);
  switch (typeOf(s)) {
    case "object": {
      const out: Obj = {};
      for (const k of s.required ?? []) out[k] = emptyFor(s.properties![k]);
      if (s.properties?.credit) out.credit = "Own screenshot";
      return out;
    }
    case "array":
      return [];
    case "boolean":
      return false;
    case "enum":
      return s.enum![0];
    case "number":
    case "integer":
      return undefined;
    default:
      return "";
  }
}

function setIn(root: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy;
  }
  const obj = { ...((root as Obj) ?? {}) };
  const next = setIn(obj[head as string], rest, value);
  if (next === undefined) delete obj[head as string];
  else obj[head as string] = next;
  return obj;
}

function itemTitle(item: Json, index: number): string {
  if (typeof item === "string") return item || `Item ${index + 1}`;
  const o = (item ?? {}) as Obj;
  const name = [o.heading, o.title, o.name, o.q, o.label, o.text, o.retailer, o.award, o.group, o.alt]
    .find((v) => typeof v === "string" && v.trim());
  return `${index + 1}. ${(name as string | undefined) ?? "Untitled"}`;
}

const inputCls =
  "w-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-small text-ink placeholder:text-ink-3";
const btnCls =
  "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2 disabled:opacity-50";
const btnPrimary =
  "rounded-lg bg-accent px-3.5 py-2 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50";

/* ---------------------------------- context --------------------------------- */

type Ctx = {
  issues: Map<string, string[]>;
  options: StudioOptions;
  folder: string;
};

function Errors({ ctx, path }: { ctx: Ctx; path: string }) {
  const list = ctx.issues.get(path);
  if (!list?.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-micro text-caution">
      {list.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function Counter({ value, s }: { value: string; s: JSONSchema }) {
  if (s.minLength === undefined && s.maxLength === undefined) return null;
  const n = value.length;
  const bad = (s.minLength && n > 0 && n < s.minLength) || (s.maxLength && n > s.maxLength);
  return (
    <span className={`num text-micro ${bad ? "text-caution" : "text-ink-3"}`}>
      {n}
      {s.maxLength ? ` / ${s.maxLength}` : s.minLength ? ` (min ${s.minLength})` : ""}
    </span>
  );
}

/* ----------------------------------- fields --------------------------------- */

type FieldProps = {
  name: string;
  s: JSONSchema;
  value: Json;
  path: (string | number)[];
  required: boolean;
  onChange: (path: (string | number)[], value: Json) => void;
  ctx: Ctx;
  doc: Obj;
};

function FieldShell({
  name,
  required,
  children,
  pathKey,
  ctx,
  extra,
}: {
  name: string;
  required: boolean;
  children: React.ReactNode;
  pathKey: string;
  ctx: Ctx;
  extra?: React.ReactNode;
}) {
  const id = `f-${pathKey}`;
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-medium">
          {labelFor(name)}
          {!required && <span className="ml-1.5 font-normal text-ink-3">optional</span>}
        </label>
        {extra}
      </div>
      {HINTS[name] && <p className="mt-0.5 text-micro text-ink-3">{HINTS[name]}</p>}
      <div className="mt-1.5">{children}</div>
      <Errors ctx={ctx} path={pathKey} />
    </div>
  );
}

function Field(p: FieldProps) {
  const { name, s, value, path, required, onChange, ctx, doc } = p;
  const pathKey = path.join(".");
  const id = `f-${pathKey}`;
  const t = typeOf(s);
  const set = (v: Json) => onChange(path, v);

  if (s.const !== undefined) return null;
  // Image credit is not asked for in the form; new images default to "Own screenshot".
  if (name === "credit") return null;

  /* --- special controls --- */
  if (name === "category" && t === "string") {
    return (
      <FieldShell {...{ name, required, pathKey, ctx }}>
        <select id={id} className={inputCls} value={(value as string) ?? ""} onChange={(e) => set(e.target.value)}>
          {ctx.options.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }
  if (name === "author" && t === "object" && path.length === 1) {
    const cur = (value as Obj)?.slug as string;
    return (
      <FieldShell {...{ name, required, pathKey: `${pathKey}.slug`, ctx }}>
        <select
          id={`f-${pathKey}.slug`}
          className={inputCls}
          value={cur ?? ""}
          onChange={(e) => {
            const a = ctx.options.authors.find((x) => x.slug === e.target.value);
            if (a) set({ ...(value as Obj), name: a.name, slug: a.slug });
          }}
        >
          {ctx.options.authors.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-micro text-ink-3">
          Profiles live in <code>content/authors.json</code>.
        </p>
      </FieldShell>
    );
  }
  if ((name === "pillar" || name === "reviewSlug") && t === "string") {
    const list = name === "pillar" ? ctx.options.pillars : ctx.options.reviews;
    return (
      <FieldShell {...{ name: name === "pillar" ? "pillar" : name, required, pathKey, ctx }}>
        <select id={id} className={inputCls} value={(value as string) ?? ""} onChange={(e) => set(e.target.value || undefined)}>
          {!required && <option value="">None</option>}
          {list.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }
  if (name === "tags" && t === "array") {
    const arr = (value as string[]) ?? [];
    return (
      <FieldShell {...{ name, required, pathKey, ctx }}>
        <input
          id={id}
          className={inputCls}
          defaultValue={arr.join(", ")}
          placeholder="wi-fi, routers, home-network"
          onBlur={(e) =>
            set(
              e.target.value
                .split(",")
                .map((x) => slugify(x))
                .filter(Boolean),
            )
          }
        />
        <p className="mt-1 text-micro text-ink-3">Comma separated.</p>
      </FieldShell>
    );
  }
  if (name === "slug" && path.length === 1) {
    return (
      <FieldShell
        {...{ name, required, pathKey, ctx }}
        extra={
          <button type="button" className="link text-micro" onClick={() => set(slugify(String(doc.title ?? "")))}>
            Make from title
          </button>
        }
      >
        <input id={id} className={inputCls} value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} />
      </FieldShell>
    );
  }
  if (name === "src" && t === "string") {
    return (
      <FieldShell {...{ name, required, pathKey, ctx }}>
        <ImageField id={id} value={(value as string) ?? ""} folder={ctx.folder} path={path} onChange={onChange} />
      </FieldShell>
    );
  }

  /* --- generic controls --- */
  switch (t) {
    case "enum":
      return (
        <FieldShell {...{ name, required, pathKey, ctx }}>
          <select id={id} className={inputCls} value={String(value ?? "")} onChange={(e) => set(e.target.value || undefined)}>
            {!required && <option value="">None</option>}
            {s.enum!.map((v) => (
              <option key={String(v)} value={String(v)}>
                {String(v)}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "boolean":
      return (
        <div className="mt-4 first:mt-0">
          <label className="flex items-start gap-2.5 text-small">
            <input type="checkbox" className="mt-1" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
            <span>
              <span className="font-medium">{labelFor(name)}</span>
              {HINTS[name] && <span className="block text-micro text-ink-3">{HINTS[name]}</span>}
            </span>
          </label>
          <Errors ctx={ctx} path={pathKey} />
        </div>
      );
    case "number":
    case "integer":
      return (
        <FieldShell {...{ name, required, pathKey, ctx }}>
          <input
            id={id}
            type="number"
            className={`${inputCls} num max-w-[12rem]`}
            value={value === undefined || value === null ? "" : String(value)}
            min={s.minimum}
            max={s.maximum}
            step={t === "integer" ? 1 : "any"}
            onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </FieldShell>
      );
    case "number|string":
      return (
        <FieldShell {...{ name, required, pathKey, ctx }}>
          <input
            id={id}
            className={`${inputCls} num max-w-[12rem]`}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => {
              const v = e.target.value;
              set(v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
            }}
          />
        </FieldShell>
      );
    case "string": {
      const v = (value as string) ?? "";
      if (s.pattern === "^\\d{4}-\\d{2}-\\d{2}$") {
        return (
          <FieldShell {...{ name, required, pathKey, ctx }}>
            <input id={id} type="date" className={`${inputCls} max-w-[12rem]`} value={v} onChange={(e) => set(e.target.value)} />
          </FieldShell>
        );
      }
      const md = MARKDOWN.has(name);
      const long = md || LONG_TEXT.has(name) || (s.maxLength ?? 0) > 120;
      return (
        <FieldShell {...{ name, required, pathKey, ctx }} extra={<Counter value={v} s={s} />}>
          {long ? (
            <textarea
              id={id}
              className={`${inputCls} ${md ? "min-h-[11rem] font-serif text-base leading-relaxed" : "min-h-[4.5rem]"}`}
              value={v}
              onChange={(e) => set(e.target.value)}
            />
          ) : (
            <input id={id} className={inputCls} value={v} onChange={(e) => set(e.target.value)} />
          )}
        </FieldShell>
      );
    }
    case "array":
      return <ArrayField {...p} />;
    case "object":
      return <ObjectField {...p} />;
    default:
      return null;
  }
}

function ObjectField(p: FieldProps) {
  const { name, s, value, path, required, onChange, ctx, doc } = p;
  const pathKey = path.join(".");
  const present = value !== undefined && value !== null;

  if (!present) {
    return (
      <div className="mt-4 first:mt-0">
        <button id={`f-${pathKey}`} type="button" className={btnCls} onClick={() => onChange(path, emptyFor(s))}>
          Add {labelFor(name).toLowerCase()}
        </button>
        <Errors ctx={ctx} path={pathKey} />
      </div>
    );
  }

  return (
    <fieldset id={`f-${pathKey}`} tabIndex={-1} className="mt-5 scroll-mt-6 rounded-[10px] border border-rule p-4 outline-none first:mt-0">
      <legend className="px-1.5 text-small font-semibold">{labelFor(name)}</legend>
      {!required && (
        <div className="-mt-1 mb-2 text-right">
          <button type="button" className="link text-micro" onClick={() => onChange(path, undefined)}>
            Remove
          </button>
        </div>
      )}
      <Errors ctx={ctx} path={pathKey} />
      <Props s={s} value={value as Obj} path={path} onChange={onChange} ctx={ctx} doc={doc} />
    </fieldset>
  );
}

function Props({
  s,
  value,
  path,
  onChange,
  ctx,
  doc,
  order,
  hidden,
}: {
  s: JSONSchema;
  value: Obj;
  path: (string | number)[];
  onChange: FieldProps["onChange"];
  ctx: Ctx;
  doc: Obj;
  order?: string[];
  hidden?: Set<string>;
}) {
  let keys = Object.keys(s.properties ?? {});
  if (order) {
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
    keys = [...keys].sort((a, b) => rank(a) - rank(b));
  }
  return (
    <>
      {keys
        .filter((k) => !hidden?.has(k))
        .map((k) => (
          <Field
            key={k}
            name={k}
            s={s.properties![k]}
            value={value?.[k]}
            path={[...path, k]}
            required={(s.required ?? []).includes(k)}
            onChange={onChange}
            ctx={ctx}
            doc={doc}
          />
        ))}
    </>
  );
}

function ArrayField(p: FieldProps) {
  const { name, s, value, path, required, onChange, ctx, doc } = p;
  const pathKey = path.join(".");
  const arr = (Array.isArray(value) ? value : []) as Json[];
  const itemS = s.items ?? {};
  const scalar = typeOf(itemS) !== "object" && typeOf(itemS) !== "array";

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const copy = [...arr];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(path, copy);
  };
  const remove = (i: number) => onChange(path, arr.filter((_, k) => k !== i));
  const add = () => {
    let item = emptyFor(itemS);
    // A new section or step needs a unique anchor id.
    if (item && typeof item === "object" && "id" in (item as Obj)) {
      const prefix = name === "steps" ? "step" : name === "sources" ? "source" : "section";
      item = { ...(item as Obj), id: `${prefix}-${arr.length + 1}` };
    }
    onChange(path, [...arr, item]);
  };
  const limits =
    s.minItems || s.maxItems
      ? `${s.minItems ? `at least ${s.minItems}` : ""}${s.minItems && s.maxItems ? ", " : ""}${s.maxItems ? `at most ${s.maxItems}` : ""}`
      : "";

  return (
    <section id={`f-${pathKey}`} tabIndex={-1} className="mt-6 scroll-mt-6 outline-none first:mt-0" aria-label={labelFor(name)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-1.5">
        <h3 className="text-small font-semibold">
          {labelFor(name)}
          <span className="num ml-1.5 font-normal text-ink-3">{arr.length}</span>
          {!required && <span className="ml-1.5 font-normal text-ink-3">optional</span>}
        </h3>
        {limits && <span className="text-micro text-ink-3">{limits}</span>}
      </div>
      {HINTS[name] && <p className="mt-1 text-micro text-ink-3">{HINTS[name]}</p>}
      <Errors ctx={ctx} path={pathKey} />

      <div className="mt-3 space-y-3">
        {arr.map((item, i) =>
          scalar ? (
            <div key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Field name={name.replace(/s$/, "")} s={itemS} value={item} path={[...path, i]} required onChange={onChange} ctx={ctx} doc={doc} />
              </div>
              <button type="button" className={`${btnCls} mt-0`} onClick={() => remove(i)} aria-label={`Remove item ${i + 1}`}>
                Remove
              </button>
            </div>
          ) : (
            <details key={i} open className="rounded-[10px] border border-rule bg-paper-2/40">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-small font-medium">
                <span className="min-w-0 truncate">{itemTitle(item, i)}</span>
                <span className="flex shrink-0 gap-1.5" onClick={(e) => e.preventDefault()}>
                  <button type="button" className={btnCls} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    Up
                  </button>
                  <button type="button" className={btnCls} onClick={() => move(i, 1)} disabled={i === arr.length - 1} aria-label="Move down">
                    Down
                  </button>
                  <button type="button" className={btnCls} onClick={() => remove(i)}>
                    Remove
                  </button>
                </span>
              </summary>
              <div className="border-t border-rule px-4 py-4">
                {typeOf(itemS) === "object" ? (
                  <Props s={itemS} value={item as Obj} path={[...path, i]} onChange={onChange} ctx={ctx} doc={doc} />
                ) : (
                  <Field name={`${labelFor(name)} ${i + 1}`} s={itemS} value={item} path={[...path, i]} required onChange={onChange} ctx={ctx} doc={doc} />
                )}
              </div>
            </details>
          ),
        )}
      </div>
      <button type="button" className={`${btnCls} mt-3`} onClick={add}>
        Add {labelFor(name).toLowerCase().replace(/s$/, "").replace(/ie$/, "y")}
      </button>
    </section>
  );
}

function ImageField({
  id,
  value,
  folder,
  path,
  onChange,
}: {
  id: string;
  value: string;
  folder: string;
  path: (string | number)[];
  onChange: FieldProps["onChange"];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const parent = path.slice(0, -1);

  async function upload(file: File) {
    setBusy(true);
    setErr("");
    try {
      // Read the real pixel size so the page can reserve space and avoid layout shift.
      const size = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
      });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder || "uploads");
      const res = await fetch("/api/studio/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      onChange([...parent, "src"], data.src);
      // The server resizes and compresses, so use the size it reports.
      const w = data.width ?? size?.w;
      const h = data.height ?? size?.h;
      if (w && h) {
        onChange([...parent, "width"], w);
        onChange([...parent, "height"], h);
      }
      if (data.bytes && data.originalBytes) {
        setNote(`Compressed from ${Math.round(data.originalBytes / 1024)} KB to ${Math.round(data.bytes / 1024)} KB`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} className={`${inputCls} min-w-0 flex-1`} value={value} placeholder="/images/... or https://..." onChange={(e) => onChange(path, e.target.value)} />
        <label className={`${btnCls} cursor-pointer`}>
          {busy ? "Uploading" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {err && <p className="text-micro text-caution">{err}</p>}
      {note && !err && <p className="text-micro text-ink-3">{note}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="max-h-40 rounded-lg border border-rule" />
      )}
    </div>
  );
}

/** Save a value as a .json file in the browser. */
export function downloadJson(name: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------------------------- editor ---------------------------------- */

export function Editor({
  schema,
  initial,
  originalSlug,
  options,
  typeLabel,
  driver,
}: {
  schema: JSONSchema;
  initial: Obj;
  originalSlug?: string;
  options: StudioOptions;
  typeLabel: string;
  driver: "files" | "neon";
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<Obj>(initial);
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [server, setServer] = useState<{ errors: Issue[]; warnings: Issue[]; message?: string; url?: string | null }>({
    errors: [],
    warnings: [],
  });
  const slugTouched = useRef(Boolean(originalSlug));
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    if (!originalSlug) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", items: [{ type: initial.type, slug: originalSlug }] }),
      });
      const data = await res.json();
      if (res.ok && data.done?.length) {
        setDirty(false);
        router.push("/studio");
        return;
      }
      setServer({
        errors: [{ path: "", message: data.failed?.[0]?.reason ?? data.error ?? "could not delete" }],
        warnings: [],
        message: "Not deleted.",
      });
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const onChange = (path: (string | number)[], value: Json) => {
    setDirty(true);
    setDoc((d) => {
      let next = setIn(d, path, value) as Obj;
      // Keep the slug in step with the title until the writer edits it.
      if (path.join(".") === "slug") slugTouched.current = true;
      if (path.join(".") === "title" && !slugTouched.current) {
        next = { ...next, slug: slugify(String(value ?? "")) };
      }
      return next;
    });
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* live check against the same contract the validator uses */
  const live = useMemo(() => {
    // Check against the publishing rules, so the panel lists everything Publish needs;
    // Save draft stays available while items remain.
    const r = docSchema.safeParse(clean({ ...doc, status: "published" }));
    return r.success ? [] : r.error.issues.map((i) => ({ path: i.path.join("."), message: plain(i.message) }));
  }, [doc]);

  const issues = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of [...live, ...server.errors]) m.set(i.path, [...new Set([...(m.get(i.path) ?? []), i.message])]);
    return m;
  }, [live, server.errors]);

  const ctx: Ctx = { issues, options, folder: String(doc.slug || "uploads") };

  async function save(status: "draft" | "published") {
    setSaving(true);
    setServer({ errors: [], warnings: [] });
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc: { ...doc, status }, originalSlug }),
      });
      const data = await res.json();
      if (!data.ok) {
        setServer({ errors: (data.errors ?? []).map((i: Issue) => ({ ...i, message: plain(i.message) })), warnings: data.warnings ?? [], message: "Not saved. Fix the items below." });
        return;
      }
      setDirty(false);
      setDoc((d) => ({ ...d, status }));
      setServer({
        errors: [],
        warnings: data.warnings ?? [],
        message: status === "published" ? `Published. Saved to ${data.file}.` : `Draft saved to ${data.file}.`,
        url: data.url,
      });
      if (originalSlug !== data.doc.slug) {
        router.replace(`/studio/edit/${data.doc.type}/${data.doc.slug}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setServer({ errors: [{ path: "", message: String(e) }], warnings: [], message: "Not saved." });
    } finally {
      setSaving(false);
    }
  }

  const status = String(doc.status ?? "draft");
  // The live check and the server can report the same problem; list it once.
  const allErrors = [...live, ...server.errors].filter(
    (i, k, arr) => arr.findIndex((j) => j.path === i.path && j.message === i.message) === k,
  );

  /** Scroll to the field an issue is about, or the nearest section that contains it. */
  const jumpTo = (path: string) => {
    setTab("form");
    setTimeout(() => {
      const parts = path.split(".");
      for (let n = parts.length; n > 0; n--) {
        const el = document.getElementById(`f-${parts.slice(0, n).join(".")}`);
        if (el) {
          el.scrollIntoView({ block: "center" });
          el.focus({ preventScroll: true });
          return;
        }
      }
    }, 0);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="flex gap-1 border-b border-rule" role="tablist">
          {(["form", "json"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`-mb-px border-b-2 px-3 py-2 text-small font-medium ${tab === t ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
              onClick={() => {
                if (t === "json") setJsonText(JSON.stringify(doc, null, 2));
                setJsonErr("");
                setTab(t);
              }}
            >
              {t === "form" ? "Form" : "JSON"}
            </button>
          ))}
        </div>

        {tab === "form" ? (
          <form className="mt-6" onSubmit={(e) => e.preventDefault()}>
            <Props s={schema} value={doc} path={[]} onChange={onChange} ctx={ctx} doc={doc} order={ORDER} hidden={HIDDEN_TOP} />
          </form>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-[34rem] text-small text-ink-2">
                The file exactly as it will be saved. Paste a whole document here, for example one drafted from your
                notes, then switch back to the form. To add several posts at once, use{" "}
                <Link href="/studio/import" className="link">
                  Import JSON
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnCls}
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(doc, null, 2))}
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  className={btnCls}
                  onClick={() => downloadJson(`${String(doc.slug || "post")}.json`, doc)}
                >
                  Download JSON
                </button>
              </div>
            </div>
            <textarea
              aria-label="Document JSON"
              className={`${inputCls} mt-3 min-h-[36rem] font-mono text-micro leading-relaxed`}
              value={jsonText}
              spellCheck={false}
              onChange={(e) => {
                setJsonText(e.target.value);
                try {
                  const v = JSON.parse(e.target.value);
                  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("expected an object");
                  setJsonErr("");
                  setDirty(true);
                  setDoc({ ...v, type: initial.type });
                } catch (err) {
                  setJsonErr(err instanceof Error ? err.message : String(err));
                }
              }}
            />
            {jsonErr && <p className="mt-1.5 text-micro text-caution">Not valid JSON yet: {jsonErr}</p>}
          </div>
        )}
      </div>

      <aside className="order-first lg:order-none">
        <div className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <div className="rounded-[10px] border border-rule p-4">
            <p className="text-small text-ink-2">
              {typeLabel}
              {doc.format ? `, ${String(doc.format)}` : ""}
            </p>
            <p className="mt-1 text-small">
              Status: <span className="font-semibold">{status === "published" ? "Published" : "Draft"}</span>
              {dirty && <span className="ml-1.5 text-ink-3">(unsaved changes)</span>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={btnCls} disabled={saving} onClick={() => save("draft")}>
                {status === "published" ? "Unpublish" : "Save draft"}
              </button>
              <button type="button" className={btnPrimary} disabled={saving || live.length > 0} onClick={() => save("published")}>
                {status === "published" ? "Update" : "Publish"}
              </button>
            </div>
            {live.length > 0 && (
              <p className="mt-3 text-micro text-caution">
                {status === "published" ? "Update" : "Publish"} is unavailable until the{" "}
                {live.length === 1 ? "item" : `${live.length} items`} under &ldquo;Before you can publish&rdquo; below{" "}
                {live.length === 1 ? "is" : "are"} done.
              </p>
            )}
            <p className="mt-3 text-micro text-ink-3">
              Not sure what goes where?{" "}
              <Link href="/studio/guide" className="link" target="_blank">
                Open the writing guide
              </Link>
              .
            </p>
            <p className="mt-2 text-micro text-ink-3">
              Drafts never appear on the site. Published posts show on the home page, their category and the
              listings straight away.
            </p>
            {server.message && (
              <p className={`mt-3 text-small ${server.errors.length ? "text-caution" : ""}`} role="status">
                {server.message}{" "}
                {server.url && (
                  <Link href={server.url} className="link" target="_blank">
                    View on site
                  </Link>
                )}
              </p>
            )}
            {originalSlug && (
              <div className="mt-4 border-t border-rule pt-3 text-small">
                {confirmDelete ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-2">Delete this post?</span>
                    <button type="button" className={btnCls} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={remove}
                      className="rounded-lg bg-caution px-3 py-1.5 text-small font-medium text-paper disabled:opacity-50"
                    >
                      Yes, delete
                    </button>
                  </div>
                ) : (
                  <button type="button" className="text-caution hover:underline" onClick={() => setConfirmDelete(true)}>
                    Delete this post
                  </button>
                )}
                <p className="mt-1.5 text-micro text-ink-3">
                  {driver === "neon" ? "The post moves to the database trash and can be restored." : "The file moves to content/.trash/ and can be restored."}
                </p>
              </div>
            )}
            {driver === "neon" && (
              <p className="mt-3 text-micro text-ink-3">
                Saved to the live database. Run <code>npm run content:pull</code> on your computer to copy it into
                content/ for git.
              </p>
            )}
          </div>

          <div className="rounded-[10px] border border-rule p-4">
            <h2 className="text-small font-semibold">
              {allErrors.length === 0
                ? "Ready to publish"
                : `Before you can publish: ${allErrors.length} thing${allErrors.length === 1 ? "" : "s"} to do`}
            </h2>
            {allErrors.length > 0 && (
              <p className="mt-1 text-micro text-ink-3">
                You can still save a draft. Click an item to go to it.
              </p>
            )}
            {allErrors.length > 0 && (
              <ul className="mt-2 max-h-[40vh] space-y-1.5 overflow-auto text-micro">
                {allErrors.map((i, k) => (
                  <li key={k}>
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => jumpTo(i.path)}
                    >
                      <span className="font-medium text-ink-2">{pathLabel(i.path)}:</span>{" "}
                      <span className="text-caution">{i.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {server.warnings.length > 0 && (
              <>
                <h3 className="mt-4 text-small font-semibold">Worth a look</h3>
                <ul className="mt-2 space-y-1.5 text-micro text-ink-2">
                  {server.warnings.map((w, k) => (
                    <li key={k}>
                      {w.path}: {w.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <WritingCheck doc={doc} onJump={jumpTo} />
        </div>
      </aside>
    </div>
  );
}
