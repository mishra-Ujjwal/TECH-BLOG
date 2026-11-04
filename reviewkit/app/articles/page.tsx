import type { Metadata } from "next";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { IndexRow } from "@/components/review-parts";
import { listArticles } from "@/lib/content";
import { ARTICLE_FORMATS, FORMAT_LABELS } from "@/lib/content/schema";
import { categoryName } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "How-tos, explainers and comparisons",
  description:
    "Step-by-step how-tos we performed ourselves, fixes for problems we actually hit, comparisons of products we used, and plain explanations of how tech works.",
  alternates: { canonical: "/articles" },
};

const INTRO: Record<(typeof ARTICLE_FORMATS)[number], string> = {
  comparison: "Two to four products we used side by side, with the figures we measured.",
  "how-to": "Steps we performed ourselves, with the exact version they were done on.",
  troubleshooting: "Problems we hit, and the fixes that worked, least drastic first.",
  explainer: "How a piece of technology actually works, in plain language.",
  "news-analysis": "What a launch or change means for people who use the thing.",
};

export default async function ArticlesIndex() {
  const articles = await listArticles();
  const groups = ARTICLE_FORMATS.map((format) => ({
    format,
    items: articles.filter((a) => a.format === format),
  })).filter((g) => g.items.length > 0);

  return (
    <Wrap>
      <Kicker
        trail={[
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
        ]}
      />
      <h1 className="t-display mt-3">How-tos, explainers and comparisons</h1>
      <p className="standfirst mt-5">
        Everything that is not a single-product review. Each one is built from something we did
        ourselves, and says when and on what.
      </p>

      {groups.map((g) => (
        <section key={g.format} aria-labelledby={`f-${g.format}`} className="mt-14">
          <h2 id={`f-${g.format}`} className="text-h2">
            {FORMAT_LABELS[g.format]}
          </h2>
          <p className="mt-1.5 text-small text-ink-2">{INTRO[g.format]}</p>
          <div className="index mt-5">
            {g.items.map((a) => (
              <IndexRow key={a.slug} item={a} categoryLabel={categoryName(a.category)} />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="mt-10 border-t border-rule pt-5 text-small text-ink-2">
          Nothing published yet. Add a file to <code>content/articles/</code>.
        </p>
      )}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
        ])}
      />
    </Wrap>
  );
}
