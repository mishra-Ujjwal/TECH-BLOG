"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaItem } from "@/lib/media";

/** The media library: every uploaded image, where it is used, and its size. */
export function MediaGrid({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unused">("all");
  const [copied, setCopied] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const shown = items.filter((i) => filter === "all" || i.usedBy.length === 0);

  async function remove(src: string) {
    setError("");
    const res = await fetch("/api/studio/media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ src }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "could not remove");
    setConfirm("");
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-small">
        {(["all", "unused"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 font-medium ${
              filter === f ? "border-accent bg-accent text-paper" : "border-rule-strong bg-paper hover:bg-paper-2"
            }`}
          >
            {f === "all" ? `All images (${items.length})` : `Not used by any post (${items.filter((i) => !i.usedBy.length).length})`}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 text-small text-caution">{error}</p>}
      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-rule bg-paper p-6 text-small text-ink-2">No images here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => (
            <li key={i.src} className="overflow-hidden rounded-[14px] border border-rule bg-paper">
              <div className="aspect-[16/10] bg-paper-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-3.5 text-micro">
                <p className="truncate text-small font-semibold" title={i.name}>
                  {i.name}
                </p>
                <p className="mt-0.5 text-ink-3">
                  {i.kb} KB, {i.modified}
                </p>
                <p className="mt-1.5 text-ink-2">
                  {i.usedBy.length ? (
                    <>Used by {i.usedBy.slice(0, 2).join(", ")}{i.usedBy.length > 2 ? ` and ${i.usedBy.length - 2} more` : ""}</>
                  ) : (
                    <span className="text-caution">Not used by any post</span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-rule-strong px-2.5 py-1 font-medium hover:bg-paper-2"
                    onClick={() => {
                      navigator.clipboard?.writeText(i.src);
                      setCopied(i.src);
                    }}
                  >
                    {copied === i.src ? "Copied" : "Copy path"}
                  </button>
                  <a href={i.src} target="_blank" className="rounded-lg border border-rule-strong px-2.5 py-1 font-medium hover:bg-paper-2">
                    Open
                  </a>
                  {i.usedBy.length === 0 &&
                    (confirm === i.src ? (
                      <button type="button" className="rounded-lg bg-caution px-2.5 py-1 font-medium text-paper" onClick={() => remove(i.src)}>
                        Yes, remove
                      </button>
                    ) : (
                      <button type="button" className="rounded-lg border border-rule-strong px-2.5 py-1 font-medium text-caution hover:bg-paper-2" onClick={() => setConfirm(i.src)}>
                        Remove
                      </button>
                    ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
