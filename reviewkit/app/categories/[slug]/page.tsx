import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { IndexRow } from "@/components/review-parts";
import { listCategory } from "@/lib/content";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { getCategories, getCategory, seoTitle } from "@/lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Not found" };
  const empty = (await listCategory(slug)).length === 0;
  return {
    title: seoTitle(category.seoTitle ?? category.name),
    description: category.metaDescription ?? category.description,
    alternates: { canonical: `/categories/${category.slug}` },
    // An empty category is a thin page: keep it out of search until it has posts.
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const items = await listCategory(slug);
  const trail = [
    { name: "Home", path: "/" },
    { name: category.name, path: `/categories/${category.slug}` },
  ];

  return (
    <Wrap>
      <Kicker trail={trail} />
      <h1 className="t-display mt-3">{category.name}</h1>
      <p className="standfirst mt-5">{category.description}</p>
      {category.topics.length > 0 && (
        <section aria-labelledby="covers" className="mt-8">
          <h2 id="covers" className="text-micro text-ink-3">
            What this covers
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {category.topics.map((t) => (
              <li key={t} className="tag tag--plain">
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="index mt-10">
        {items.map((r) => (
          <IndexRow key={`${r.type}-${r.slug}`} item={r} showKind />
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-10 border-t border-rule pt-5 text-small text-ink-2">
          Nothing published in this category yet.
        </p>
      )}
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </Wrap>
  );
}
