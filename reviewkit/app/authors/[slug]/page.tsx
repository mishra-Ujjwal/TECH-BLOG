import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Figure, JsonLd, Kicker, Prose, Wrap } from "@/components/primitives";
import { IndexRow } from "@/components/review-parts";
import { listLatest } from "@/lib/content";
import { breadcrumbJsonLd, profilePageJsonLd } from "@/lib/jsonld";
import { categoryName, getAuthor, getAuthors, seoTitle, openGraphFor } from "@/lib/site";

/**
 * One page per author: who they are, what they cover, and everything they have
 * published. A byline that leads somewhere checkable is a large part of why a
 * reader, or a search engine, should trust a review.
 */

export const revalidate = 3600;

export function generateStaticParams() {
  return getAuthors().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) return { title: "Not found" };
  return {
    title: seoTitle(`${author.name}, ${author.role.toLowerCase()}`),
    description: author.bio,
    alternates: { canonical: `/authors/${author.slug}` },
    openGraph: openGraphFor({ type: "profile", title: author.name, description: author.bio }),
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) notFound();

  const work = (await listLatest(500)).filter((d) => d.authorSlug === author.slug);
  const trail = [
    { name: "Home", path: "/" },
    { name: author.name, path: `/authors/${author.slug}` },
  ];

  return (
    <Wrap>
      <Kicker trail={trail} />
      <h1 className="t-display mt-3">{author.name}</h1>
      <p className="mt-2 text-small text-ink-3">{author.role}</p>
      <p className="standfirst mt-5">{author.bio}</p>

      {author.avatar && <Figure media={author.avatar} />}

      <dl className="record mt-8">
        <div>
          <dt className="record__k">Published here</dt>
          <dd className="record__v">{work.length}</dd>
        </div>
        <div>
          <dt className="record__k">Reviews</dt>
          <dd className="record__v">{work.filter((d) => d.type === "review").length}</dd>
        </div>
        <div>
          <dt className="record__k">How-tos and articles</dt>
          <dd className="record__v">{work.filter((d) => d.type === "article").length}</dd>
        </div>
        <div>
          <dt className="record__k">Buying guides</dt>
          <dd className="record__v">{work.filter((d) => d.type === "pillar").length}</dd>
        </div>
      </dl>

      <section aria-labelledby="about-author">
        <h2 id="about-author" className="mt-14 text-h2">
          About {author.name}
        </h2>
        <Prose markdown={author.about} className="mt-4" />
      </section>

      {author.expertise.length > 0 && (
        <section aria-labelledby="covers" className="mt-10">
          <h2 id="covers" className="text-micro text-ink-3">
            Covers
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {author.expertise.map((e) => (
              <li key={e} className="tag tag--plain">
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {author.sameAs.length > 0 && (
        <section aria-labelledby="elsewhere" className="mt-8">
          <h2 id="elsewhere" className="text-micro text-ink-3">
            Elsewhere
          </h2>
          <ul className="mt-2 space-y-1 text-small">
            {author.sameAs.map((u) => (
              <li key={u}>
                <a href={u} rel="me noopener" target="_blank" className="link">
                  {new URL(u).hostname.replace(/^www\./, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="work">
        <h2 id="work" className="mt-14 text-h2">
          Everything by {author.name}
        </h2>
        <div className="index mt-5">
          {work.map((d) => (
            <IndexRow
              key={`${d.type}-${d.slug}`}
              item={d}
              categoryLabel={categoryName(d.category)}
              showKind
            />
          ))}
        </div>
        {work.length === 0 && (
          <p className="mt-5 border-t border-rule pt-5 text-small text-ink-2">
            Nothing published yet.
          </p>
        )}
      </section>

      <JsonLd data={profilePageJsonLd(author.slug)} />
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </Wrap>
  );
}
