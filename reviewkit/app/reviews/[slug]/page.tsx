import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Figure, JsonLd, Kicker } from "@/components/primitives";
import {
  Alternatives,
  Byline,
  Contents,
  Faq,
  Measurements,
  PriceTable,
  ProsCons,
  SectionBlock,
  SourcesList,
  SpecTable,
  TestConditions,
  TestRecord,
  UpdateLog,
  VerdictPanel,
} from "@/components/review-parts";
import { getReview, pricesFor, sitemapEntries } from "@/lib/content";
import { breadcrumbJsonLd, faqJsonLd, reviewJsonLd } from "@/lib/jsonld";
import { categoryName, getSite, seoTitle, openGraphFor } from "@/lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  const entries = await sitemapEntries();
  return entries.filter((e) => e.type === "review").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const review = await getReview(slug);
  if (!review) return { title: "Not found" };
  const path = `/reviews/${review.slug}`;
  return {
    title: seoTitle(review.title),
    description: review.metaDescription,
    alternates: {
      canonical: review.seo.canonical ?? path,
      ...(review.seo.alternates.length > 0
        ? {
            languages: Object.fromEntries(review.seo.alternates.map((a) => [a.locale, a.path])),
          }
        : {}),
    },
    robots: review.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: openGraphFor({
      type: "article",
      title: review.title,
      description: review.metaDescription,
      url: path,
      publishedTime: review.dates.published,
      modifiedTime: review.dates.updated,
      images: review.seo.ogImage ?? review.product.image?.src,
    }),
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const review = await getReview(slug);
  if (!review) notFound();

  const site = getSite();
  const prices = await pricesFor(review);
  const trail = [
    { name: "Home", path: "/" },
    { name: categoryName(review.category), path: `/categories/${review.category}` },
    { name: review.product.name, path: `/reviews/${review.slug}` },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[72rem] gap-x-12 px-5 xl:grid-cols-[12rem_46rem] xl:justify-center">
      <aside className="hidden xl:block">
        <Contents
          sections={review.sections}
          id="contents-margin"
          className="sticky top-12 border-l border-rule pl-5"
        />
      </aside>

      <article className="min-w-0">
        <Kicker trail={trail} />
        <h1 className="t-display mt-3">{review.headline ?? review.title}</h1>
        <p className="standfirst mt-5">{review.excerpt}</p>
        <Byline doc={review} />
        <TestRecord review={review} prices={prices} />

        {/* Verdict before the photograph: it is what the reader came for. */}
        <VerdictPanel review={review} prices={prices} />

        {review.product.image && <Figure media={review.product.image} priority />}

        <Contents
          sections={review.sections}
          id="contents-inline"
          className="panel panel--quiet my-9 xl:hidden"
        />

        <Measurements testing={review.testing} />
        <TestConditions testing={review.testing} />

        {review.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}

        <ProsCons review={review} />
        <PriceTable prices={prices} locale={review.locale} disclosure={site.affiliate.disclosure} />
        <SpecTable specs={review.specs} />
        <Alternatives items={review.alternatives} />
        <Faq items={review.faq} />
        <SourcesList sources={review.sources} />
        <UpdateLog
          updates={review.editorial.updates}
          locale={review.locale}
          aiAssisted={review.editorial.aiAssisted}
        />

        <JsonLd data={reviewJsonLd(review)} />
        <JsonLd data={faqJsonLd(review.faq)} />
        <JsonLd data={breadcrumbJsonLd(trail)} />
      </article>
    </div>
  );
}
