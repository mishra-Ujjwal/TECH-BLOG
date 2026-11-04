import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AnswerPanel,
  ArticleRecord,
  ComparedProducts,
  Requirements,
  Steps,
} from "@/components/article-parts";
import { Figure, JsonLd, Kicker } from "@/components/primitives";
import {
  Byline,
  Contents,
  Faq,
  Measurements,
  PriceTable,
  SectionBlock,
  SourcesList,
  TestConditions,
  UpdateLog,
} from "@/components/review-parts";
import { getArticle, pricesFor, sitemapEntries } from "@/lib/content";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { categoryName, getSite, seoTitle, openGraphFor } from "@/lib/site";
import { leadImage } from "@/lib/content/schema";

export const revalidate = 3600;

export async function generateStaticParams() {
  const entries = await sitemapEntries();
  return entries.filter((e) => e.type === "article").map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Not found" };
  const path = `/articles/${article.slug}`;
  return {
    title: seoTitle(article.title),
    description: article.metaDescription,
    alternates: {
      canonical: article.seo.canonical ?? path,
      ...(article.seo.alternates.length > 0
        ? {
            languages: Object.fromEntries(article.seo.alternates.map((a) => [a.locale, a.path])),
          }
        : {}),
    },
    robots: article.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: openGraphFor({
      type: "article",
      title: article.title,
      description: article.metaDescription,
      url: path,
      publishedTime: article.dates.published,
      modifiedTime: article.dates.updated,
      images: article.seo.ogImage ?? leadImage(article)?.src,
    }),
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const site = getSite();
  const prices = await pricesFor(article);
  const path = `/articles/${article.slug}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: categoryName(article.category), path: `/categories/${article.category}` },
    { name: article.title, path },
  ];
  const contents = [
    ...(article.steps.length > 0 ? [{ id: "steps", heading: "Step by step" }] : []),
    ...article.sections,
  ];

  return (
    <div className="mx-auto grid w-full max-w-[72rem] gap-x-12 px-5 xl:grid-cols-[12rem_46rem] xl:justify-center">
      <aside className="hidden xl:block">
        <Contents
          sections={contents}
          id="contents-margin"
          className="sticky top-12 border-l border-rule pl-5"
        />
      </aside>

      <article className="min-w-0">
        <Kicker trail={trail} />
        <h1 className="t-display mt-3">{article.headline ?? article.title}</h1>
        <p className="standfirst mt-5">{article.excerpt}</p>
        <Byline doc={article} />
        <ArticleRecord article={article} prices={prices} />

        <AnswerPanel article={article} />

        {article.media[0] && <Figure media={article.media[0]} priority />}

        <Contents
          sections={contents}
          id="contents-inline"
          className="panel panel--quiet my-9 xl:hidden"
        />

        <ComparedProducts products={article.products} />
        {article.testing && <Measurements testing={article.testing} />}
        {article.testing && <TestConditions testing={article.testing} />}
        <Requirements article={article} />
        <Steps steps={article.steps} />

        {article.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}

        {article.media.slice(1).map((m) => (
          <Figure key={m.src} media={m} />
        ))}

        <PriceTable
          prices={prices}
          locale={article.locale}
          disclosure={site.affiliate.disclosure}
        />
        <Faq items={article.faq} />
        <SourcesList sources={article.sources} />
        <UpdateLog
          updates={article.editorial.updates}
          locale={article.locale}
          aiAssisted={article.editorial.aiAssisted}
          noun={article.format === "how-to" ? "guide" : "article"}
        />

        <JsonLd data={articleJsonLd(article, path)} />
        <JsonLd data={faqJsonLd(article.faq)} />
        <JsonLd data={breadcrumbJsonLd(trail)} />
      </article>
    </div>
  );
}
