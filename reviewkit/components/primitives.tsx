import Image from "next/image";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import type { Media } from "@/lib/content/schema";

export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** The standard reading column. Pages set their own width; nothing is global. */
export function Wrap({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-[46rem] px-5 ${className}`}>{children}</div>;
}

/** Markdown body. Content is first-party, see lib/markdown.ts. */
export function Prose({ markdown, className = "" }: { markdown: string; className?: string }) {
  return (
    <div
      className={`prose ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}

/**
 * next/image when the author recorded dimensions, a plain img otherwise. A credit is
 * shown only when it names someone else; our own pictures ("Own photo", "Own
 * screenshot") carry no line, since that is the default.
 */
export function Figure({ media, priority = false }: { media: Media; priority?: boolean }) {
  const hasSize = Boolean(media.width && media.height);
  const credit = media.credit && !/^own\b/i.test(media.credit.trim()) ? media.credit : null;
  return (
    <figure className="my-7">
      <div className="overflow-hidden rounded-lg border border-rule bg-paper-2">
        {hasSize ? (
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width!}
            height={media.height!}
            priority={priority}
            className="h-auto w-full"
            sizes="(max-width: 48rem) 100vw, 46rem"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.src} alt={media.alt} loading="lazy" className="h-auto w-full" />
        )}
      </div>
      {(media.caption || credit) && (
        <figcaption className="mt-2 text-small text-ink-3">
          {media.caption}
          {media.caption && credit ? " " : ""}
          {credit && <span className="text-ink-3">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/** A quiet kicker above the headline: where you are, not decoration. */
export function Kicker({ trail }: { trail: { name: string; path: string }[] }) {
  const steps = trail.slice(0, -1);
  return (
    <nav aria-label="Breadcrumb" className="text-small text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {steps.map((t) => (
          <li key={t.path} className="flex items-center gap-2">
            <Link href={t.path} className="hover:text-accent hover:underline">
              {t.name}
            </Link>
            <span aria-hidden="true" className="text-rule-strong">
              /
            </span>
          </li>
        ))}
        <li aria-current="page" className="text-ink-2">
          {trail[trail.length - 1]?.name}
        </li>
      </ol>
    </nav>
  );
}

export function Tag({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "measured" | "caution";
}) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 scroll-mt-24 text-h2">
      {children}
    </h2>
  );
}

/** Used above evidence blocks, which are not part of the prose flow. */
export function BlockHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-h3">
      {children}
    </h2>
  );
}
