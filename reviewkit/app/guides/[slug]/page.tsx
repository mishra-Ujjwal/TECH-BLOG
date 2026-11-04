import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import {
  Byline,
  Contents,
  Faq,
  IndexRow,
  SectionBlock,
  SourcesList,
  UpdateLog,
} from "@/components/review-parts";
import { getPillar, listReviews, sitemapEntries } from "@/lib/content";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { categoryName, seoTitle, openGraphFor } from "@/lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  const entries = await sitemapEntries();
  return entries.filter((e) => e.type === "pillar").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pillar = await getPillar(slug);
  if (!pillar) return { title: "Not found" };
  return {
    title: seoTitle(pillar.title),
    description: pillar.metaDescription,
    alternates: { canonical: pillar.seo.canonical ?? `/guides/${pillar.slug}` },
    robots: pillar.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: openGraphFor({
      type: "article",
      title: pillar.title,
      description: pillar.metaDescription,
      url: `/guides/${pillar.slug}`,
      publishedTime: pillar.dates.published,
      modifiedTime: pillar.dates.updated,
    }),
  };
}

export default async function PillarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pillar = await getPillar(slug);
  if (!pillar) notFound();

  const cluster = await listReviews({ pillar: pillar.slug });
  const bySlug = new Map(cluster.map((c) => [c.slug, c]));
  const trail = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: pillar.title, path: `/guides/${pillar.slug}` },
  ];

  return (
    <Wrap>
      <Kicker trail={trail} />
      <h1 className="t-display mt-3">{pillar.headline ?? pillar.title}</h1>
      <p className="standfirst mt-5">{pillar.excerpt}</p>
      <Byline doc={pillar} />

      {pillar.picks.length > 0 && (
        <section aria-labelledby="picks" className="panel panel--verdict my-10">
          <h2 id="picks" className="text-micro text-ink-3">
            Our picks
          </h2>
          <ol className="mt-1 divide-y divide-rule">
            {pillar.picks.map((pick) => {
              const review = bySlug.get(pick.reviewSlug);
              return (
                <li key={pick.reviewSlug} className="py-4 first:pt-3 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-h3">
                      <Link href={`/reviews/${pick.reviewSlug}`} className="hover:text-accent">
                        {review?.title ?? pick.reviewSlug.replace(/-/g, " ")}
                      </Link>
                    </h3>
                    {review?.score != null && (
                      <p className="text-h3 font-semibold num text-accent">{review.score}</p>
                    )}
                  </div>
                  <p className="mt-1 text-small font-medium">{pick.award}</p>
                  <p className="mt-1 text-small text-ink-2">{pick.oneLiner}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Contents
        sections={pillar.sections}
        id="contents-inline"
        className="panel panel--quiet my-9"
      />

      {pillar.sections.map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}

      {cluster.length > 0 && (
        <section aria-labelledby="cluster" className="my-10">
          <h2 id="cluster" className="text-h2">
            The reviews behind this guide
          </h2>
          <div className="index mt-5">
            {cluster.map((r) => (
              <IndexRow key={r.slug} item={r} categoryLabel={categoryName(r.category)} />
            ))}
          </div>
        </section>
      )}

      <Faq items={pillar.faq} />
      <SourcesList sources={pillar.sources} />
      <UpdateLog
        updates={pillar.editorial.updates}
        locale={pillar.locale}
        aiAssisted={pillar.editorial.aiAssisted}
      />

      <JsonLd data={articleJsonLd(pillar, `/guides/${pillar.slug}`)} />
      <JsonLd data={faqJsonLd(pillar.faq)} />
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </Wrap>
  );
}
