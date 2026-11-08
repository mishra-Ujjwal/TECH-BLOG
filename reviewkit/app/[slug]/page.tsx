import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { Byline, SectionBlock } from "@/components/review-parts";
import {
  getPage,
  listArticles,
  listPillars,
  listReviews,
  sitemapEntries,
  type Page,
} from "@/lib/content";
import { formatDate } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { fillSiteTokens, getCategories, seoTitle } from "@/lib/site";

/**
 * Static pages (about, how we test, privacy, terms, disclosure) sit at the root so
 * their URLs stay short. Real routes such as /reviews take precedence.
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const entries = await sitemapEntries();
  return entries.filter((e) => e.type === "page").map((e) => ({ slug: e.slug }));
}

/** Resolve {{publisher.name}} and friends in every reader-facing string. */
async function loadPage(slug: string): Promise<Page | null> {
  const page = await getPage(slug);
  if (!page) return null;
  return {
    ...page,
    title: fillSiteTokens(page.title),
    headline: page.headline ? fillSiteTokens(page.headline) : undefined,
    excerpt: fillSiteTokens(page.excerpt),
    metaDescription: fillSiteTokens(page.metaDescription),
    author: { ...page.author, name: fillSiteTokens(page.author.name) },
    sections: page.sections.map((s) => ({
      ...s,
      heading: fillSiteTokens(s.heading),
      body: fillSiteTokens(s.body),
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: seoTitle(page.seo.searchTitle ?? page.title),
    description: page.metaDescription,
    alternates: { canonical: page.seo.canonical ?? `/${page.slug}` },
    robots: page.seo.noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  const trail = [
    { name: "Home", path: "/" },
    { name: page.title, path: `/${page.slug}` },
  ];

  return (
    <Wrap>
      <Kicker trail={trail} />
      <h1 className="t-display mt-3">{page.headline ?? page.title}</h1>
      <p className="standfirst mt-5">{page.excerpt}</p>
      <Byline doc={page} />
      {page.slug === "about" && <SiteRecord locale={page.locale} />}
      {page.sections.map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}
      <JsonLd data={articleJsonLd(page, `/${page.slug}`)} />
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </Wrap>
  );
}

/**
 * The About page's record strip: counts taken from the published content, so the
 * page cannot overstate how much has been tested.
 */
async function SiteRecord({ locale }: { locale: Page["locale"] }) {
  const [reviews, articles, guides] = await Promise.all([
    listReviews(),
    listArticles(),
    listPillars(),
  ]);
  const categories = getCategories();
  const latest = reviews[0]?.publishedAt;
  const perCategory = categories.map((c) => ({
    ...c,
    count: [...reviews, ...articles].filter((r) => r.category === c.slug).length,
  }));

  return (
    <section aria-labelledby="site-record" className="mt-10">
      <h2 id="site-record" className="sr-only">
        This site in numbers
      </h2>
      <dl className="record">
        <div>
          <dt className="record__k">Reviews published</dt>
          <dd className="record__v">{reviews.length}</dd>
        </div>
        <div>
          <dt className="record__k">Buying guides</dt>
          <dd className="record__v">{guides.length}</dd>
        </div>
        <div>
          <dt className="record__k">How-tos and articles</dt>
          <dd className="record__v">{articles.length}</dd>
        </div>
        <div>
          <dt className="record__k">Latest review</dt>
          <dd className="record__v">{latest ? formatDate(latest, locale) : "None yet"}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-small">
        {perCategory.map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} className="link">
              {c.name}
            </Link>{" "}
            <span className="num text-ink-3">({c.count})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
