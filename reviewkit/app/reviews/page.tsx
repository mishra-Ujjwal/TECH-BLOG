import type { Metadata } from "next";
import { JsonLd, Kicker, Wrap } from "@/components/primitives";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { IndexRow } from "@/components/review-parts";
import { listReviews } from "@/lib/content";
import { categoryName } from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const empty = (await listReviews({ limit: 1 })).length === 0;
  return {
    ...metadata,
    // An empty list is a thin page: keep it out of search until it has reviews.
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

const metadata: Metadata = {
  title: "Phone, laptop and gaming reviews",
  description:
    "Every review on the site, newest first. Each one is based on a product we used ourselves, with our own measurements and a dated price.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsIndex() {
  const reviews = await listReviews();
  return (
    <Wrap>
      <Kicker
        trail={[
          { name: "Home", path: "/" },
          { name: "Reviews", path: "/reviews" },
        ]}
      />
      <h1 className="t-display mt-3">All reviews</h1>
      <p className="standfirst mt-5">
        {reviews.length} review{reviews.length === 1 ? "" : "s"}, newest first. The number on the
        left is our score out of ten.
      </p>
      <div className="index mt-10">
        {reviews.map((r) => (
          <IndexRow key={r.slug} item={r} categoryLabel={categoryName(r.category)} />
        ))}
      </div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Reviews", path: "/reviews" },
        ])}
      />
    </Wrap>
  );
}
