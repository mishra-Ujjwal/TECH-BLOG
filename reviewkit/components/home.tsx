import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { FORMAT_LABELS, type DocSummary } from "@/lib/content/schema";
import { canOptimize, docPath } from "@/lib/paths";
import { categoryName } from "@/lib/site";

/**
 * Homepage building blocks: a lead story, a grid of secondary stories, a running
 * "Latest" stream and topic sections. Layout borrowed from news front pages; the
 * look stays this site's own (tokens, type, hairlines, dates rather than "2h ago").
 */

export function kindLabel(d: DocSummary): string {
  if (d.type === "article" && d.format) return FORMAT_LABELS[d.format];
  if (d.type === "pillar") return "Buying guide";
  return "Review";
}

/** Kind and category, separated the way the rest of the site separates meta. */
function Meta({ d, className = "" }: { d: DocSummary; className?: string }) {
  const parts = [kindLabel(d), d.category ? categoryName(d.category) : null].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <p className={`text-micro text-ink-3 ${className}`}>
      {parts.map((p, i) => (
        <span key={p}>
          {i > 0 && (
            <span className="mx-2 text-rule-strong" aria-hidden="true">
              |
            </span>
          )}
          {p}
        </span>
      ))}
    </p>
  );
}

function DateLine({ d }: { d: DocSummary }) {
  return (
    <time dateTime={d.publishedAt} className="text-micro text-ink-3">
      {formatDate(d.publishedAt, d.locale)}
    </time>
  );
}

/**
 * The picture for a story, or, when there is none, the thing we would rather show
 * anyway: the score for a review, the format for anything else. Never a stock image.
 */
function Thumb({
  d,
  sizes,
  className = "",
  priority = false,
}: {
  d: DocSummary;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-rule bg-paper-2 ${className}`}
    >
      {d.image && !canOptimize(d.image.src) ? (
        // Other remote hosts need a remotePatterns entry for next/image; a plain img always works.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.image.src}
          alt={d.image.alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : d.image ? (
        <Image
          src={d.image.src}
          alt={d.image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-2 text-center">
          {d.score !== null ? (
            <span className="num text-h2 font-semibold tracking-[-0.03em]">{d.score}</span>
          ) : (
            <span className="text-micro font-medium text-ink-3">{kindLabel(d)}</span>
          )}
        </div>
      )}
      {d.image && d.score !== null && (
        <span className="num absolute bottom-2 left-2 rounded-[4px] bg-paper px-1.5 py-0.5 text-small font-semibold">
          {d.score}
        </span>
      )}
    </div>
  );
}

/* ================================================================== lead == */

export function LeadStory({ d }: { d: DocSummary }) {
  const href = docPath(d);
  return (
    <article className="relative">
      <Thumb
        d={d}
        priority
        sizes="(max-width: 1024px) 100vw, 46rem"
        className="aspect-[16/9] w-full"
      />
      <div className="mt-5">
        <Meta d={d} />
        <h2 className="mt-2 text-[clamp(1.875rem,1.2rem+2.4vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.032em]">
          <Link href={href} className="hover:text-accent">
            <span className="absolute inset-0" aria-hidden="true" />
            {d.title}
          </Link>
        </h2>
        <p className="standfirst mt-3">{d.excerpt}</p>
        <p className="mt-3">
          <DateLine d={d} />
        </p>
      </div>
    </article>
  );
}

/* ================================================================= tiles == */

/** Secondary stories: square thumbnail, headline, meta. Two columns from `sm`. */
export function StoryGrid({ items }: { items: DocSummary[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10 grid border-t border-rule sm:grid-cols-2 sm:gap-x-8">
      {items.map((d) => (
        <article
          key={`${d.type}-${d.slug}`}
          className="relative grid grid-cols-[5rem_minmax(0,1fr)] gap-4 border-b border-rule py-5"
        >
          <Thumb d={d} sizes="5rem" className="aspect-square w-20" />
          <div>
            <h3 className="font-semibold leading-snug tracking-[-0.015em]">
              <Link href={docPath(d)} className="hover:text-accent">
                <span className="absolute inset-0" aria-hidden="true" />
                {d.title}
              </Link>
            </h3>
            <Meta d={d} className="mt-1.5" />
          </div>
        </article>
      ))}
    </div>
  );
}

/* ================================================================ latest == */

/** The running stream down the right: everything, newest first, dated. */
export function LatestStream({ items }: { items: DocSummary[] }) {
  return (
    <section aria-labelledby="latest-stream">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
        <h2 id="latest-stream" className="text-h3">
          Latest
        </h2>
        <Link href="/search" className="link text-small">
          Search everything
        </Link>
      </div>
      <ol>
        {items.map((d) => (
          <li key={`${d.type}-${d.slug}`} className="relative border-b border-rule py-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-micro font-medium text-ink-2">{kindLabel(d)}</span>
              <DateLine d={d} />
            </p>
            <h3 className="mt-1 font-semibold leading-snug">
              <Link href={docPath(d)} className="hover:text-accent">
                <span className="absolute inset-0" aria-hidden="true" />
                {d.title}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-small text-ink-2">{d.excerpt}</p>
          </li>
        ))}
      </ol>
      {items.length === 0 && <p className="py-4 text-small text-ink-2">Nothing published yet.</p>}
    </section>
  );
}

/* ============================================================== sections == */

/** A topic band: heavy rule, "Name / what it covers", then up to four stories. */
export function TopicSection({
  id,
  title,
  tagline,
  href,
  items,
}: {
  id: string;
  title: string;
  tagline: string;
  href: string;
  items: DocSummary[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t-2 border-ink pt-3">
        <h2 id={id} className="text-h2">
          <Link href={href} className="hover:text-accent">
            {title}
          </Link>{" "}
          <span className="font-normal text-ink-3">
            <span aria-hidden="true">/ </span>
            {tagline}
          </span>
        </h2>
        <Link href={href} className="link shrink-0 text-small">
          See all
        </Link>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((d) => (
          <article key={`${d.type}-${d.slug}`} className="relative">
            <Thumb
              d={d}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 17rem"
              className="aspect-[4/3] w-full"
            />
            <Meta d={d} className="mt-3" />
            <h3 className="mt-1 font-semibold leading-snug tracking-[-0.015em]">
              <Link href={docPath(d)} className="hover:text-accent">
                <span className="absolute inset-0" aria-hidden="true" />
                {d.title}
              </Link>
            </h3>
            <p className="mt-1.5">
              <DateLine d={d} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
