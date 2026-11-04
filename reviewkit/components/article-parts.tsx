import Link from "next/link";
import { formatDate } from "@/lib/format";
import { FORMAT_LABELS, type Article, type Price } from "@/lib/content/schema";
import { BlockHeading, Figure, Prose } from "./primitives";

/* ========================================================= article record ==
   The TestRecord strip for articles: what kind of post this is, when the work was
   done and on which version, before a word of prose. */

export function ArticleRecord({ article, prices }: { article: Article; prices: Price[] }) {
  const t = article.testing;
  const lastPrice = [...prices].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  const doneLabel = article.format === "how-to" ? "Done on" : "Tested";

  const fields: { k: string; v: string }[] = [{ k: "Format", v: FORMAT_LABELS[article.format] }];
  if (t) fields.push({ k: doneLabel, v: formatDate(t.testedOn, article.locale) });
  if (t?.versionTested) fields.push({ k: "Version", v: t.versionTested });
  if (article.timeNeeded) fields.push({ k: "Time needed", v: article.timeNeeded });
  if (article.products.length > 0) {
    fields.push({ k: "Compared", v: `${article.products.length} products` });
  }
  if (t && fields.length < 4) fields.push({ k: "Length of test", v: t.duration });
  if (lastPrice && fields.length < 4) {
    fields.push({ k: "Price checked", v: formatDate(lastPrice.checkedAt, article.locale) });
  }

  return (
    <dl className="record mt-7">
      {fields.slice(0, 4).map((f) => (
        <div key={f.k}>
          <dt className="record__k">{f.k}</dt>
          <dd className="record__v">{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ================================================================ answer ==
   The answer to the title, first. Quiet on purpose: the verdict panel is the
   only element on the site allowed to shout. */

const ANSWER_HEADING: Record<Article["format"], string> = {
  comparison: "The real difference",
  "how-to": "What you will end up with",
  troubleshooting: "The fix, in short",
  explainer: "The short answer",
  "news-analysis": "What changed",
};

export function AnswerPanel({ article }: { article: Article }) {
  return (
    <section aria-labelledby="answer" className="panel my-9">
      <BlockHeading id="answer">{ANSWER_HEADING[article.format]}</BlockHeading>
      <Prose markdown={article.answer} className="prose--tight mt-3" />
    </section>
  );
}

/* ============================================================== compared == */

export function ComparedProducts({ products }: { products: Article["products"] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="compared" className="my-9">
      <BlockHeading id="compared">What we compared</BlockHeading>
      <ul className="mt-4 border-t border-rule">
        {products.map((p) => (
          <li
            key={p.name}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3"
          >
            <span className="font-medium">{p.name}</span>
            <span className="text-small">
              {p.reviewSlug ? (
                <Link href={`/reviews/${p.reviewSlug}`} className="link">
                  Our full review
                </Link>
              ) : p.url ? (
                <a href={p.url} target="_blank" rel="noopener" className="link">
                  Maker&apos;s page
                </a>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ========================================================== before start == */

export function Requirements({ article }: { article: Article }) {
  if (article.requirements.length === 0) return null;
  return (
    <section aria-labelledby="before-you-start" className="my-9">
      <BlockHeading id="before-you-start">Before you start</BlockHeading>
      <ul className="mt-4 space-y-2 border-t border-rule pt-4">
        {article.requirements.map((r) => (
          <li key={r} className="grid grid-cols-[1.25rem_minmax(0,1fr)]">
            <span aria-hidden="true" className="text-ink-3">
              +
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================================= steps ==
   Numbered in the same fixed left column the listings use for scores, so a
   step number reads as a figure, not a decoration. */

export function Steps({ steps }: { steps: Article["steps"] }) {
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="steps" className="my-9">
      <BlockHeading id="steps">Step by step</BlockHeading>
      <ol className="mt-4 border-t border-rule">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-b border-rule py-6"
          >
            <span aria-hidden="true" className="index__score">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 id={step.id} className="scroll-mt-24 text-h3">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <Prose markdown={step.body} className="mt-3" />
              {step.media?.map((m) => (
                <Figure key={m.src} media={m} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
