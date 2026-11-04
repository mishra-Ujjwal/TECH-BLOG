import type { Metadata } from "next";
import Link from "next/link";
import { LatestStream, LeadStory, StoryGrid, TopicSection } from "@/components/home";
import { latestEvidence, listLatest } from "@/lib/content";
import { getCategories, getSite } from "@/lib/site";

export const revalidate = 3600;

// Title and description come from the layout defaults (site.json homeTitle and
// description); only the canonical is set here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Front page, laid out like a news front: one lead story, four secondary stories,
 * a dated "Latest" stream on the right, then a band per topic. Evidence from the
 * most recent tests sits between the two, because measured figures are the reason
 * to read this site rather than another.
 */
export default async function HomePage() {
  const site = getSite();
  const [latest, evidence] = await Promise.all([listLatest(40), latestEvidence(3)]);

  // Lead with the newest story that has a picture of its own; fall back to the newest.
  const lead = latest.find((d) => d.image) ?? latest[0];
  const rest = latest.filter((d) => d !== lead);
  const secondary = rest.slice(0, 4);

  const topics = getCategories()
    .map((c) => ({
      category: c,
      items: latest.filter((d) => d.category === c.slug).slice(0, 4),
    }))
    .filter((t) => t.items.length > 0);
  const guides = latest.filter((d) => d.type === "pillar").slice(0, 4);
  const howTos = latest.filter((d) => d.type === "article").slice(0, 4);

  if (!lead) {
    return (
      <div className="mx-auto w-full max-w-[72rem] px-5">
        <h1 className="t-display">{site.tagline}</h1>
        <p className="mt-6 border-t border-rule pt-5 text-small text-ink-2">
          Nothing published yet. Add a JSON file to <code>content/reviews/</code> or{" "}
          <code>content/articles/</code>, run <code>npm run content:validate</code>, and it will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[72rem] px-5">
      {/* The page's h1 is the site's promise; story headlines are h2 and below. */}
      <h1 className="sr-only">
        {site.name}: {site.tagline}
      </h1>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0">
          <LeadStory d={lead} />
          <StoryGrid items={secondary} />
        </div>
        <aside className="lg:border-l lg:border-rule lg:pl-10">
          <div className="lg:sticky lg:top-6">
            <LatestStream items={latest.slice(0, 8)} />
          </div>
        </aside>
      </div>

      {evidence.length > 0 && (
        <section aria-labelledby="evidence" className="mt-16 border-y border-rule py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="evidence" className="text-small font-semibold">
              Recorded in our most recent tests
            </h2>
            <Link href="/how-we-test" className="link text-small">
              How we test
            </Link>
          </div>
          <dl className="mt-4 grid gap-6 sm:grid-cols-3">
            {evidence.map((e) => (
              <div key={`${e.slug}-${e.label}`}>
                <dt className="text-small text-ink-2">{e.label}</dt>
                <dd className="mt-1">
                  <span className="t-figure num">{e.value}</span>
                  {e.unit && (
                    <span className="ml-1 text-base font-medium text-ink-3">{e.unit}</span>
                  )}
                  <span className="mt-2 block text-micro text-ink-3">
                    <Link href={`/reviews/${e.slug}`} className="hover:text-accent hover:underline">
                      {e.product}
                    </Link>
                    {e.method ? `, ${e.method.charAt(0).toLowerCase()}${e.method.slice(1)}` : ""}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <TopicSection
        id="howtos"
        title="How-tos and explainers"
        tagline="steps we performed ourselves"
        href="/articles"
        items={howTos}
      />

      {topics.map(({ category, items }) => (
        <TopicSection
          key={category.slug}
          id={`topic-${category.slug}`}
          title={category.name}
          tagline={category.tagline ?? category.topics.slice(0, 2).join(", ")}
          href={`/categories/${category.slug}`}
          items={items}
        />
      ))}

      <TopicSection
        id="guides"
        title="Buying guides"
        tagline="only products we have reviewed"
        href="/guides"
        items={guides}
      />
    </div>
  );
}
