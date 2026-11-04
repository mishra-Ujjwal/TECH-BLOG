import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioEnabled } from "@/lib/studio";

/** The studio is a private tool: never indexed, and absent unless enabled. */
export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!studioEnabled()) notFound();
  return <>{children}</>;
}
