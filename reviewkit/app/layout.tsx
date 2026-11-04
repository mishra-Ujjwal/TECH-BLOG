import type { Metadata } from "next";
import "./globals.css";
import { sans, serif } from "./fonts";
import { Masthead, SiteFooter } from "@/components/chrome";
import { AdScript, ConsentBanner } from "@/components/consent";
import { JsonLd } from "@/components/primitives";
import { MainArea, PublicOnly } from "@/components/public-only";
import { organisationJsonLd, webSiteJsonLd } from "@/lib/jsonld";
import { getSite, siteUrl } from "@/lib/site";

export function generateMetadata(): Metadata {
  const site = getSite();
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: site.homeTitle,
      template: `%s | ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.defaultLocale.replace("-", "_"),
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    verification: {
      ...(site.verification.google ? { google: site.verification.google } : {}),
      ...(site.verification.bing ? { other: { "msvalidate.01": site.verification.bing } } : {}),
    },
    // No default canonical here: each page sets its own, so a page that forgets
    // gets none rather than one that points search engines at the homepage.
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getSite();
  return (
    <html lang={site.defaultLocale} className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper text-ink">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PublicOnly>
          <Masthead />
        </PublicOnly>
        <MainArea>{children}</MainArea>
        <PublicOnly>
          <SiteFooter />
          <ConsentBanner />
        </PublicOnly>
        <AdScript publisherId={site.adsense.publisherId} enabled={site.adsense.enabled} />
        <JsonLd data={organisationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
      </body>
    </html>
  );
}
