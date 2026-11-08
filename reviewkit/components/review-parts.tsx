import Image from "next/image";
import Link from "next/link";
import { formatDate, formatMoney, priceIsStale } from "@/lib/format";
import { FORMAT_LABELS, type ArticleFormat, type DocSummary } from "@/lib/content/schema";
import { canOptimize, docPath } from "@/lib/paths";
import { getAuthor } from "@/lib/site";
import type {
  Alternative,
  Media,
  Price,
  Review,
  Section,
  SpecGroup,
} from "@/lib/content/schema";
import { BlockHeading, Figure, Prose, SectionHeading, Tag } from "./primitives";

type Locale = Review["locale"];

/* ============================================================ test record ==
   The site's signature component. Evidence before prose: what was tested, for
   how long, on which version, and when the price was last checked. A reader who
   reads nothing else can tell in two seconds whether this is first-hand. */

export function TestRecord({
  review,
  prices,
}: {
  review: Review;
  prices: Price[];
}) {
  const t = review.testing;
  const lastPrice = [...prices].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];

  // A research review summarises other people's testing, so it must not claim a test date.
  const research = /^not tested/i.test(t.duration);
  const fields: { k: string; v: string }[] = research
    ? [
        { k: "Researched", v: formatDate(t.testedOn, review.locale) },
        { k: "Type", v: "Research review, not tested hands-on" },
      ]
    : [
        { k: "Tested", v: formatDate(t.testedOn, review.locale) },
        { k: "Length of test", v: t.duration },
      ];
  if (t.versionTested) fields.push({ k: "Version tested", v: t.versionTested });
  if (lastPrice) {
    fields.push({ k: "Price checked", v: formatDate(lastPrice.checkedAt, review.locale) });
  }

  return (
    <dl className="record mt-7">
      {fields.map((f) => (
        <div key={f.k}>
          <dt className="record__k">{f.k}</dt>
          <dd className="record__v">{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ================================================================ verdict ==
   The one loud element on the page. Score as a large figure, a measuring rule
   across the full width, then the paragraph and the buy/skip decision. */

export function VerdictPanel({ review, prices }: { review: Review; prices: Price[] }) {
  const { verdict } = review;
  const cheapest = [...prices].sort((a, b) => a.amount - b.amount)[0];
  const pct = verdict.score !== undefined ? (verdict.score / verdict.scoreMax) * 100 : null;

  return (
    <section aria-labelledby="verdict" className="panel panel--verdict my-9">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div>
          <h2 id="verdict" className="text-micro text-ink-3">
            Our verdict
          </h2>
          {verdict.score !== undefined ? (
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="t-figure text-accent">{verdict.score}</span>
              <span className="text-base text-ink-3 num">out of {verdict.scoreMax}</span>
            </p>
          ) : (
            <p className="mt-1 text-h3">Not scored</p>
          )}
        </div>

        {cheapest && (
          <p className="text-small text-ink-2 sm:text-right">
            <span className="block text-h3 font-semibold text-ink num">
              {formatMoney(cheapest.amount, cheapest.currency, review.locale)}
            </span>
            <span className="mt-0.5 block">
              at {cheapest.retailer}
              {cheapest.note ? `, ${cheapest.note}` : ""}
            </span>
            <span className="block text-ink-3">
              checked {formatDate(cheapest.checkedAt, review.locale)}
            </span>
          </p>
        )}
      </div>

      {pct !== null && (
        <div
          className="scale mt-5"
          style={{ ["--score-pct" as string]: `${pct}%` }}
          role="img"
          aria-label={`Scored ${verdict.score} out of ${verdict.scoreMax}`}
        >
          <span className="scale__ticks" aria-hidden="true" />
          <span className="scale__track" aria-hidden="true" />
          <span className="scale__fill" aria-hidden="true" />
          <span className="scale__pin" aria-hidden="true" />
        </div>
      )}

      <Prose markdown={verdict.summary} className="prose--tight mt-5 max-w-none" />

      <div className="mt-6 grid gap-x-8 gap-y-5 border-t border-rule pt-5 sm:grid-cols-2 sm:divide-x sm:divide-rule">
        <div>
          <h3 className="text-small font-semibold">Buy it if</h3>
          <ul className="mt-2 space-y-1.5 text-small text-ink-2">
            {verdict.bestFor.map((b) => (
              <li key={b} className="grid grid-cols-[0.9rem_minmax(0,1fr)]">
                <span aria-hidden="true" className="text-ink-3">
                  +
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:pl-8">
          <h3 className="text-small font-semibold">Skip it if</h3>
          <ul className="mt-2 space-y-1.5 text-small text-ink-2">
            {verdict.skipIf.map((s) => (
              <li key={s} className="grid grid-cols-[0.9rem_minmax(0,1fr)]">
                <span aria-hidden="true" className="text-ink-3">
                  &minus;
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {review.scores.length > 0 && <SubScores scores={review.scores} />}
    </section>
  );
}

function SubScores({ scores }: { scores: { label: string; value: number }[] }) {
  return (
    <div className="mt-6 border-t border-rule pt-5">
      <h3 className="text-micro text-ink-3">Scored by area</h3>
      <dl className="mt-3 space-y-3">
        {scores.map((s) => (
          <div
            key={s.label}
            className="grid grid-cols-[minmax(5rem,8rem)_minmax(0,1fr)_1.75rem] items-center gap-4"
          >
            <dt className="text-small text-ink-2">{s.label}</dt>
            <dd className="contents">
              <span className="h-[3px] bg-rule" aria-hidden="true">
                <span
                  className="block h-[3px] bg-accent"
                  style={{ width: `${(s.value / 10) * 100}%` }}
                />
              </span>
              <span className="text-right text-small font-semibold num">
                {s.value}
                <span className="sr-only"> out of 10</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* =========================================================== measurements ==
   Numbers we took ourselves, which is the whole argument of the site. */

export function Measurements({ testing }: { testing: Review["testing"] }) {
  const rows = testing.measurements;
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="measured" className="my-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BlockHeading id="measured">What we measured</BlockHeading>
        <Tag tone="measured">our own figures</Tag>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Measurement</th>
              <th scope="col">Result</th>
              <th scope="col">Method</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.label}>
                <th scope="row" className="font-normal text-ink">
                  {m.label}
                </th>
                <td>
                  <span className="v">{m.value}</span>
                  {m.unit && <span className="u"> {m.unit}</span>}
                  {m.comparison && (
                    <span className="mt-0.5 block text-micro text-ink-3">{m.comparison}</span>
                  )}
                </td>
                <td className="text-ink-2">{m.method ?? "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Setup and, just as importantly, the limits of the test. */
export function TestConditions({ testing: t }: { testing: Review["testing"] }) {
  return (
    <section aria-labelledby="conditions" className="panel my-9">
      <BlockHeading id="conditions">How we tested</BlockHeading>
      <p className="mt-3 text-small leading-relaxed text-ink-2">{t.setup}</p>
      {t.notTested.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <h3 className="text-small font-semibold">What we did not test</h3>
          <ul className="mt-2 space-y-1 text-small text-ink-2">
            {t.notTested.map((n) => (
              <li key={n} className="grid grid-cols-[0.9rem_minmax(0,1fr)]">
                <span aria-hidden="true" className="text-ink-3">
                  &middot;
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ============================================================== pros/cons ==
   Deliberately monochrome. Colour on this site means "measured" or "treat with
   caution", so a red/green traffic light here would dilute it. The evidence line
   under each point is the part that matters. */

export function ProsCons({ review }: { review: Review }) {
  return (
    <section aria-labelledby="balance" className="my-9">
      <BlockHeading id="balance">The case for and against</BlockHeading>
      <div className="mt-4 grid gap-x-10 gap-y-7 border-t border-rule pt-5 md:grid-cols-2 md:divide-x md:divide-rule">
        <div>
          <h3 className="text-small font-semibold">In its favour</h3>
          <ul className="mt-3 space-y-4">
            {review.verdict.pros.map((p) => (
              <li key={p.text}>
                <p className="font-medium">{p.text}</p>
                {p.evidence && <p className="mt-1 text-small text-ink-3">{p.evidence}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:pl-10">
          <h3 className="text-small font-semibold">Against it</h3>
          <ul className="mt-3 space-y-4">
            {review.verdict.cons.map((c) => (
              <li key={c.text}>
                <p className="font-medium">{c.text}</p>
                {c.evidence && <p className="mt-1 text-small text-ink-3">{c.evidence}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ================================================================= prices == */

export function PriceTable({
  prices,
  locale,
  disclosure,
}: {
  prices: Price[];
  locale: Locale;
  disclosure: string;
}) {
  if (prices.length === 0) return null;
  const hasAffiliate = prices.some((p) => p.affiliate);

  return (
    <section aria-labelledby="price" className="my-9">
      <BlockHeading id="price">Price and where to buy</BlockHeading>
      <div className="mt-4 overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Seller</th>
              <th scope="col">Price</th>
              <th scope="col">Checked</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p, i) => (
              <tr key={`${p.retailer}-${p.amount}-${i}`}>
                <th scope="row" className="font-normal text-ink">
                  {p.url ? (
                    <a
                      href={p.url}
                      className="link"
                      rel={p.affiliate ? "sponsored nofollow noopener" : "noopener"}
                      target="_blank"
                    >
                      {p.retailer}
                    </a>
                  ) : (
                    p.retailer
                  )}
                  {p.affiliate && (
                    <>
                      {" "}
                      <Tag tone="plain">affiliate</Tag>
                    </>
                  )}
                  {p.note && <span className="mt-0.5 block text-micro text-ink-3">{p.note}</span>}
                </th>
                <td>
                  <span className="v">{formatMoney(p.amount, p.currency, locale)}</span>
                </td>
                <td className="text-ink-2">
                  {formatDate(p.checkedAt, locale)}
                  {priceIsStale(p.checkedAt) && (
                    <span className="mt-1 block">
                      <Tag tone="caution">may be out of date</Tag>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-small text-ink-3">
        These are the prices we saw on the dates shown. Check the seller&rsquo;s own price
        before you buy.
      </p>
      {hasAffiliate && (
        <p className="mt-3 border-l-2 border-caution bg-caution-wash px-4 py-3 text-small text-ink-2">
          {disclosure}
        </p>
      )}
    </section>
  );
}

/* ================================================================== specs == */

export function SpecTable({ specs }: { specs: SpecGroup[] }) {
  if (specs.length === 0) return null;
  const anyUnverified = specs.some((g) => g.items.some((i) => !i.verified));

  return (
    <section aria-labelledby="specs" className="my-9">
      <BlockHeading id="specs">Specifications</BlockHeading>
      <div className="mt-4 space-y-7">
        {specs.map((group) => (
          <div key={group.group} className="overflow-x-auto">
            <table className="data data--kv">
              <caption>{group.group}</caption>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.label}>
                    <th scope="row">{item.label}</th>
                    <td>
                      {item.value}
                      {item.verified ? (
                        <>
                          {" "}
                          <Tag tone="measured">checked</Tag>
                        </>
                      ) : (
                        <>
                          {" "}
                          <Tag tone="caution">maker&rsquo;s figure</Tag>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {anyUnverified && (
        <p className="mt-3 text-small text-ink-3">
          &ldquo;Maker&rsquo;s figure&rdquo; means we read it from the manufacturer and did
          not confirm it ourselves.
        </p>
      )}
    </section>
  );
}

/* =============================================================== sections == */

export function SectionBlock({ section }: { section: Section }) {
  return (
    <section>
      <SectionHeading id={section.id}>
        {section.heading}
        {section.opinion && (
          <>
            {" "}
            <Tag>Opinion</Tag>
          </>
        )}
      </SectionHeading>
      <Prose markdown={section.body} className="mt-4" />
      {section.table && (
        <div className="mt-6 overflow-x-auto">
          <table className="data">
            {section.table.caption && <caption>{section.table.caption}</caption>}
            <thead>
              <tr>
                {section.table.columns.map((c) => (
                  <th scope="col" key={c}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th scope="row" key={j} className="font-normal text-ink">
                        {cell}
                      </th>
                    ) : (
                      <td key={j} className="v">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.media?.map((m) => (
        <Figure key={m.src} media={m} />
      ))}
    </section>
  );
}

/* =========================================================== alternatives == */

export function Alternatives({ items }: { items: Alternative[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="alts" className="my-9">
      <BlockHeading id="alts">What else to consider</BlockHeading>
      <ul className="mt-4 border-t border-rule">
        {items.map((a) => (
          <li key={a.name} className="border-b border-rule py-4">
            <p className="font-semibold">
              {a.reviewSlug ? (
                <Link href={`/reviews/${a.reviewSlug}`} className="link">
                  {a.name}
                </Link>
              ) : a.url ? (
                <a href={a.url} target="_blank" rel="noopener" className="link">
                  {a.name}
                </a>
              ) : (
                a.name
              )}
            </p>
            <p className="mt-1 text-small text-ink-2">{a.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ==================================================================== faq == */

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="faq" className="my-9">
      <BlockHeading id="faq">Questions people ask</BlockHeading>
      <div className="mt-4 border-t border-rule">
        {items.map((f) => (
          <details key={f.q} className="group border-b border-rule">
            <summary className="flex cursor-pointer list-none items-start gap-3 py-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="mt-[0.35em] text-ink-3 transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
              <span>{f.q}</span>
            </summary>
            <Prose markdown={f.a} className="prose--tight pb-5 pl-6 text-ink-2" />
          </details>
        ))}
      </div>
    </section>
  );
}

/* ================================================================ sources == */

export function SourcesList({
  sources,
}: {
  sources: {
    id: string;
    name: string;
    url?: string;
    licence: string;
    licenceUrl?: string;
    attribution?: string | null;
    fetchedAt?: string;
  }[];
}) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="sources" className="my-9">
      <BlockHeading id="sources">Where the facts came from</BlockHeading>
      <ul className="mt-4 space-y-3 text-small text-ink-2">
        {sources.map((s) => (
          <li key={s.id}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener" className="link">
                {s.name}
              </a>
            ) : (
              s.name
            )}
            <span className="block text-ink-3">
              {s.licenceUrl ? (
                <a href={s.licenceUrl} target="_blank" rel="noopener" className="link">
                  {s.licence}
                </a>
              ) : (
                s.licence
              )}
              {s.fetchedAt ? `, read ${s.fetchedAt}` : ""}
            </span>
            {s.attribution ? <span className="block italic">{s.attribution}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* =============================================================== contents == */

/** Sits in the left margin on wide screens, inline on narrow ones. */
export function Contents({
  sections,
  className = "",
  id = "contents",
}: {
  sections: { id: string; heading: string }[];
  className?: string;
  id?: string;
}) {
  if (sections.length < 3) return null;
  return (
    <nav aria-labelledby={id} className={className}>
      <h2 id={id} className="text-micro text-ink-3">
        On this page
      </h2>
      <ol className="mt-3 space-y-2 text-small">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-ink-2 hover:text-accent hover:underline">
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ================================================================= byline == */

export function Byline({
  doc,
}: {
  doc: {
    author: { name: string; slug: string; url?: string };
    locale: Locale;
    dates: { published: string; updated?: string };
  };
}) {
  // A profile in content/authors.json wins: its page, and its spelling of the name.
  const profile = getAuthor(doc.author.slug);
  const name = profile?.name ?? doc.author.name;
  const href = profile ? `/authors/${profile.slug}` : doc.author.url;
  return (
    <p className="mt-5 text-small text-ink-3">
      By{" "}
      {href ? (
        <a href={href} rel="author" className="text-ink-2 hover:text-accent hover:underline">
          {name}
        </a>
      ) : (
        <span className="text-ink-2">{name}</span>
      )}
      <span className="mx-2 text-rule-strong" aria-hidden="true">
        |
      </span>
      Published{" "}
      <time dateTime={doc.dates.published}>{formatDate(doc.dates.published, doc.locale)}</time>
      {doc.dates.updated && (
        <>
          <span className="mx-2 text-rule-strong" aria-hidden="true">
            |
          </span>
          Updated{" "}
          <time dateTime={doc.dates.updated}>{formatDate(doc.dates.updated, doc.locale)}</time>
        </>
      )}
    </p>
  );
}

/* ============================================================ update log == */

export function UpdateLog({
  updates,
  locale,
  aiAssisted,
  noun = "review",
}: {
  updates: { date: string; note: string }[];
  locale: Locale;
  aiAssisted: boolean;
  /** What the page is, for the heading: "review", "how-to", "article". */
  noun?: string;
}) {
  if (updates.length === 0 && !aiAssisted) return null;
  return (
    <section className="my-9 border-t border-rule pt-5 text-small">
      {updates.length > 0 && (
        <>
          <h2 className="font-semibold">Updates to this {noun}</h2>
          <ul className="mt-2 space-y-1 text-ink-2">
            {updates.map((u) => (
              <li key={u.date}>
                <time dateTime={u.date} className="text-ink-3">
                  {formatDate(u.date, locale)}
                </time>{" "}
                {u.note}
              </li>
            ))}
          </ul>
        </>
      )}
      {aiAssisted && (
        <p className={`${updates.length > 0 ? "mt-4 " : ""}text-ink-3`}>
          The testing, measurements and judgements here are ours. An AI assistant helped
          structure the draft from our notes, and a named editor checked it against those
          notes before publication.{" "}
          <Link href="/how-we-test" className="link">
            How we test
          </Link>
          .
        </p>
      )}
    </section>
  );
}

/* ================================================================== index == */

/** A listing row. Score in a fixed left column gives the list its rhythm. */
export function IndexRow({
  item,
  categoryLabel,
  showKind = false,
}: {
  item: {
    type?: string;
    format?: ArticleFormat | null;
    slug: string;
    title: string;
    excerpt: string;
    score: number | null;
    publishedAt: string;
    locale: Locale;
    image: Media | null;
  };
  categoryLabel?: string;
  /** Name the kind of post, for lists that mix reviews, guides and articles. */
  showKind?: boolean;
}) {
  const kindName =
    item.type === "article" && item.format
      ? FORMAT_LABELS[item.format]
      : item.type === "pillar"
        ? "Buying guide"
        : "Review";
  const kind = kindName;
  const meta = [showKind ? kindName : null, categoryLabel].filter((x): x is string => Boolean(x));
  const href = docPath({ type: (item.type ?? "review") as DocSummary["type"], slug: item.slug });
  return (
    <article className="index__row">
      {/* A thumbnail of the post's picture; reviews keep their score as a badge. */}
      <div className="index__thumb" aria-hidden="true">
        {item.image ? (
          canOptimize(item.image.src) ? (
            <Image src={item.image.src} alt="" fill sizes="(min-width: 640px) 10rem, 6.5rem" className="object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image.src} alt="" loading="lazy" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="flex h-full w-full items-center justify-center p-2 text-center">
            {item.score !== null ? (
              <span className="num text-h3 font-semibold tracking-[-0.03em] text-ink">{item.score}</span>
            ) : (
              <span className="text-micro font-medium text-ink-3">{kind ?? "Article"}</span>
            )}
          </span>
        )}
        {item.image && item.score !== null && (
          <span className="num absolute bottom-1.5 left-1.5 rounded-[4px] bg-paper px-1.5 py-0.5 text-micro font-semibold text-ink">
            {item.score}
          </span>
        )}
      </div>
      <div>
        <h3 className="index__title">
          <Link href={href}>
            <span className="absolute inset-0" aria-hidden="true" />
            {item.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-small text-ink-2">{item.excerpt}</p>
        <p className="mt-2 text-micro text-ink-3">
          {meta.map((m) => (
            <span key={m}>
              {m}
              <span className="mx-2 text-rule-strong" aria-hidden="true">
                |
              </span>
            </span>
          ))}
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, item.locale)}</time>
        </p>
      </div>
    </article>
  );
}
