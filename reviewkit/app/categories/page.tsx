import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { getCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse by area: phones, computing, gaming and EVs, all tested hands-on.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesIndex() {
  const categories = getCategories();
  return (
    <Wrap>
      <Kicker
        trail={[
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
        ]}
      />
      <h1 className="t-display mt-3">Categories</h1>
      <ul className="mt-10 border-t border-rule">
        {categories.map((c) => (
          <li key={c.slug} className="border-b border-rule py-5">
            <h2 className="text-h3">
              <Link href={`/categories/${c.slug}`} className="hover:text-accent">
                {c.name}
              </Link>
            </h2>
            <p className="mt-1.5 text-small text-ink-2">{c.description}</p>
            {c.topics.length > 0 && (
              <p className="mt-2 text-micro text-ink-3">{c.topics.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
        ])}
      />
    </Wrap>
  );
}
