import type { Metadata } from "next";
import Link from "next/link";
import { Wrap } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That address does not match anything on the site.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Wrap>
      <h1 className="t-display">Page not found</h1>
      <p className="standfirst mt-5">
        That address does not match anything on the site. It may have moved, or the link may
        have been mistyped.
      </p>
      <ul className="mt-8 space-y-2.5 border-t border-rule pt-6">
        <li>
          <Link href="/articles" className="link">
            All articles
          </Link>
        </li>
        <li>
          <Link href="/categories" className="link">
            Browse by category
          </Link>
        </li>
        <li>
          <Link href="/" className="link">
            Home
          </Link>
        </li>
      </ul>
    </Wrap>
  );
}
