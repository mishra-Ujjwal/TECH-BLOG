import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { listPillars } from "@/lib/content";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const empty = (await listPillars({ limit: 1 })).length === 0;
  return {
    ...metadata,
    // An empty list is a thin page: keep it out of search until it has guides.
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

const metadata: Metadata = {
  title: "Buying guides",
  description:
    "Our buying guides, each built from reviews of products we tested ourselves rather than a round-up of other people's opinions.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesIndex() {
  const guides = await listPillars();
  return (
    <Wrap>
      <Kicker
        trail={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ]}
      />
      <h1 className="t-display mt-3">Buying guides</h1>
      <p className="standfirst mt-5">
        Each guide links to the full review behind every pick, so you can check the testing for
        yourself.
      </p>
      <ul className="mt-10 border-t border-rule">
        {guides.map((g) => (
          <li key={g.slug} className="border-b border-rule py-5">
            <h2 className="text-h3">
              <Link href={`/guides/${g.slug}`} className="hover:text-accent">
                {g.title}
              </Link>
            </h2>
            <p className="mt-1.5 text-small text-ink-2">{g.excerpt}</p>
          </li>
        ))}
      </ul>
      {guides.length === 0 && (
        <p className="mt-10 border-t border-rule pt-5 text-small text-ink-2">
          No guides yet. Add a file to <code>content/pillars/</code>.
        </p>
      )}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ])}
      />
    </Wrap>
  );
}
