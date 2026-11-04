"use client";

import { useState } from "react";
import type { AuthorProfile } from "@/lib/content/schema";

/** Edit the author profiles behind every byline and author page. */

const input =
  "mt-1.5 w-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-small text-ink placeholder:text-ink-3";
const btn = "rounded-lg border border-rule-strong px-3 py-1.5 text-small font-medium hover:bg-paper-2";

type Issue = { path: string; message: string };
type FileShape = { _note?: string; authors: AuthorProfile[] };

function Labelled({ label, hint, err, children, count }: { label: string; hint?: string; err?: string; children: React.ReactNode; count?: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-small font-semibold">{label}</span>
        {count && <span className="num text-micro text-ink-3">{count}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-micro text-ink-3">{hint}</span>}
      {err && <span className="mt-1 block text-micro text-caution">{err}</span>}
    </label>
  );
}

export function AuthorsForm({ initial, usage }: { initial: FileShape; usage: Record<string, number> }) {
  const [file, setFile] = useState<FileShape>(initial);
  const [errors, setErrors] = useState<Issue[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const err = (p: string) => errors.find((e) => e.path === p)?.message;
  const edit = (i: number, patch: Partial<AuthorProfile>) =>
    setFile((f) => ({ ...f, authors: f.authors.map((a, k) => (k === i ? { ...a, ...patch } : a)) }));

  async function save() {
    setSaving(true);
    setErrors([]);
    setMsg("");
    try {
      const res = await fetch("/api/studio/authors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrors(data.errors ?? []);
        setMsg("Not saved. Fix the fields marked below.");
      } else setMsg("Saved. Bylines and author pages are updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {file.authors.map((a, i) => (
        <section key={i} className="rounded-[14px] border border-rule bg-paper p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">{a.name || "New author"}</h2>
            <span className="text-micro text-ink-3">
              {usage[a.slug] ?? 0} post{usage[a.slug] === 1 ? "" : "s"}
              {a.slug && (
                <>
                  {", "}
                  <a href={`/authors/${a.slug}`} target="_blank" className="link">
                    View profile page
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Labelled label="Name" err={err(`authors.${i}.name`)}>
              <input className={input} value={a.name} onChange={(e) => edit(i, { name: e.target.value })} />
            </Labelled>
            <Labelled label="Role" err={err(`authors.${i}.role`)} hint="For example Editor, or Editorial team.">
              <input className={input} value={a.role} onChange={(e) => edit(i, { role: e.target.value })} />
            </Labelled>
            <Labelled label="Slug" err={err(`authors.${i}.slug`)} hint="The web address and the id posts use. Lowercase and hyphens.">
              <input className={`${input} font-mono`} value={a.slug} readOnly={Boolean(usage[a.slug])} onChange={(e) => edit(i, { slug: e.target.value })} />
            </Labelled>
          </div>
          <div className="mt-5 space-y-5">
            <Labelled label="Short bio" err={err(`authors.${i}.bio`)} count={`${a.bio.length} (min 40)`} hint="One or two sentences, shown under bylines.">
              <textarea className={`${input} min-h-[4rem]`} value={a.bio} onChange={(e) => edit(i, { bio: e.target.value })} />
            </Labelled>
            <Labelled label="About" err={err(`authors.${i}.about`)} count={`${a.about.length} (min 80)`} hint="Shown on the author page. Markdown. Specific, checkable background builds trust.">
              <textarea className={`${input} min-h-[8rem]`} value={a.about} onChange={(e) => edit(i, { about: e.target.value })} />
            </Labelled>
            <div className="grid gap-5 sm:grid-cols-2">
              <Labelled label="Subjects covered" hint="Comma separated.">
                <input className={input} value={a.expertise.join(", ")} onChange={(e) => edit(i, { expertise: e.target.value.split(",").map((x) => x.trim()) })} />
              </Labelled>
              <Labelled label="Profiles elsewhere" err={err(`authors.${i}.sameAs`)} hint="One address per line, starting https://.">
                <textarea className={`${input} min-h-[4rem] font-mono`} value={a.sameAs.join("\n")} onChange={(e) => edit(i, { sameAs: e.target.value.split("\n") })} />
              </Labelled>
            </div>
          </div>
          {!usage[a.slug] && file.authors.length > 1 && (
            <button type="button" className={`${btn} mt-5 text-caution`} onClick={() => setFile((f) => ({ ...f, authors: f.authors.filter((_, k) => k !== i) }))}>
              Remove this author
            </button>
          )}
        </section>
      ))}

      <button
        type="button"
        className={btn}
        onClick={() =>
          setFile((f) => ({
            ...f,
            authors: [...f.authors, { slug: "", name: "", role: "Writer", bio: "", about: "", expertise: [], sameAs: [] }],
          }))
        }
      >
        Add author
      </button>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper-2 py-4">
        <p className={`text-small ${errors.length ? "text-caution" : "text-ink-2"}`} role="status">
          {msg || (errors[0] && !errors[0].path ? errors[0].message : "Changes apply to every byline straight away.")}
        </p>
        <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-accent px-5 py-2 text-small font-semibold text-paper hover:bg-accent-2 disabled:opacity-50">
          {saving ? "Saving" : "Save authors"}
        </button>
      </div>
    </div>
  );
}
