import type { Metadata } from "next";
import { Kicker, Wrap } from "@/components/primitives";
import { IndexRow } from "@/components/review-parts";
import Link from "next/link";
import { listCategory, listLatest, search } from "@/lib/content";
import { categoryName, getCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every review, how-to, comparison and buying guide on the site by product, brand or topic.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const results = term ? await search(term) : [];

  // When nothing matches, point somewhere useful instead of an empty page: the
  // category this brand or topic belongs to (from the menus), then the newest posts.
  const lower = term.toLowerCase();
  const home =
    term && results.length === 0
      ? getCategories().find(
          (c) =>
            c.name.toLowerCase() === lower ||
            c.brands.some((b) => b.toLowerCase() === lower) ||
            c.topics.some((t) => t.toLowerCase() === lower),
        )
      : undefined;
  const fallback =
    results.length > 0
      ? []
      : home
        ? (await listCategory(home.slug)).slice(0, 5)
        : await listLatest(5);

  return (
    <Wrap>
      <Kicker trail={[{ name: "Home", path: "/" }, { name: "Search", path: "/search" }]} />
      <h1 className="t-display mt-3">Search</h1>

      <form action="/search" method="get" className="mt-8 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search reviews and guides
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={term}
          placeholder="Search reviews and guides"
          className="min-w-0 flex-1 rounded-lg border border-rule-strong bg-paper px-3 py-2 text-base placeholder:text-ink-3"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-paper hover:bg-accent-2"
        >
          Search
        </button>
      </form>

      {term && (
        <p className="mt-8 text-small text-ink-3">
          {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{term}&rdquo;
        </p>
      )}

      <div className="index mt-4">
        {results.map((r) => (
          <IndexRow
            key={`${r.type}-${r.slug}`}
            item={r}
            categoryLabel={categoryName(r.category)}
            showKind
          />
        ))}
      </div>

      {results.length === 0 && (
        <section aria-labelledby="instead" className="mt-6 border-t border-rule pt-6">
          {term && (
            <p className="text-base text-ink-2">
              We have not published anything about &ldquo;{term}&rdquo; yet. We only write about
              things we have used ourselves, so coverage grows as we test.
            </p>
          )}
          {home && (
            <p className="mt-3 text-base">
              <Link href={`/categories/${home.slug}`} className="link">
                See everything in {home.name}
              </Link>
            </p>
          )}
          {fallback.length > 0 && (
            <>
              <h2 id="instead" className="mt-10 text-h2">
                {home ? `Latest in ${home.name}` : "Latest from the site"}
              </h2>
              <div className="index mt-4">
                {fallback.map((r) => (
                  <IndexRow
                    key={`${r.type}-${r.slug}`}
                    item={r}
                    categoryLabel={categoryName(r.category)}
                    showKind
                  />
                ))}
              </div>
            </>
          )}
          <h2 className={`${fallback.length > 0 ? "mt-12" : "mt-10"} text-h2`} id={fallback.length > 0 ? undefined : "instead"}>
            Browse by category
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {getCategories().map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="tag tag--plain hover:text-accent">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Wrap>
  );
}
