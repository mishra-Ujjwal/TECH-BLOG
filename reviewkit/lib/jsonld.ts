import { toPlainText } from "./markdown";
import { absoluteUrl, getAuthor, getSite } from "./site";
import { leadImage, type Article, type Page, type Pillar, type Review } from "./content/schema";

/**
 * Structured data. Keep it truthful: everything here is generated from the
 * authored document, so it cannot claim a rating or a date the page does not show.
 */

export function organisationJsonLd() {
  const site = getSite();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: absoluteUrl("/"),
    email: site.publisher.email,
    ...(site.publisher.logo ? { logo: absoluteUrl(site.publisher.logo) } : {}),
    ...(site.social.length > 0 ? { sameAs: site.social.map((s) => s.url) } : {}),
  };
}

export function webSiteJsonLd() {
  const site = getSite();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: absoluteUrl("/"),
    inLanguage: site.defaultLocale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * The author as a Person. With a profile in content/authors.json it carries the
 * profile page URL and sameAs links, which is how search engines tie a byline to
 * a real, checkable person.
 */
export function personJsonLd(author: { slug: string; name: string }) {
  const profile = getAuthor(author.slug);
  if (!profile) return { "@type": "Person", name: author.name };
  return {
    "@type": "Person",
    name: profile.name,
    url: absoluteUrl(`/authors/${profile.slug}`),
    jobTitle: profile.role,
    ...(profile.sameAs.length > 0 ? { sameAs: profile.sameAs } : {}),
  };
}

export function profilePageJsonLd(slug: string) {
  const profile = getAuthor(slug);
  if (!profile) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl(`/authors/${profile.slug}`),
    mainEntity: {
      ...personJsonLd(profile),
      description: profile.bio,
      ...(profile.avatar ? { image: absoluteUrl(profile.avatar.src) } : {}),
      ...(profile.expertise.length > 0 ? { knowsAbout: profile.expertise } : {}),
    },
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export function reviewJsonLd(review: Review) {
  const site = getSite();
  const cheapest = [...review.prices].sort((a, b) => a.amount - b.amount)[0];

  return {
    "@context": "https://schema.org",
    "@type": "Review",
    headline: review.title,
    url: absoluteUrl(`/reviews/${review.slug}`),
    datePublished: review.dates.published,
    ...(review.dates.updated ? { dateModified: review.dates.updated } : {}),
    inLanguage: review.locale,
    author: personJsonLd(review.author),
    publisher: { "@type": "Organization", name: site.name },
    reviewBody: toPlainText(review.verdict.summary),
    ...(review.verdict.score !== undefined
      ? {
          reviewRating: {
            "@type": "Rating",
            ratingValue: review.verdict.score,
            bestRating: review.verdict.scoreMax,
            worstRating: 0,
          },
        }
      : {}),
    positiveNotes: {
      "@type": "ItemList",
      itemListElement: review.verdict.pros.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.text,
      })),
    },
    negativeNotes: {
      "@type": "ItemList",
      itemListElement: review.verdict.cons.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.text,
      })),
    },
    itemReviewed: {
      "@type": "Product",
      name: review.product.name,
      ...(review.product.brand ? { brand: { "@type": "Brand", name: review.product.brand } } : {}),
      ...(review.product.model ? { model: review.product.model } : {}),
      ...(review.product.image ? { image: absoluteUrl(review.product.image.src) } : {}),
      ...(cheapest
        ? {
            offers: {
              "@type": "Offer",
              price: cheapest.amount,
              priceCurrency: cheapest.currency,
              ...(cheapest.url ? { url: cheapest.url } : {}),
              // No availability: we record a price and the date we checked it, not
              // stock levels, so claiming InStock would be a statement we never verified.
            },
          }
        : {}),
    },
  };
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  if (faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: toPlainText(f.a) },
    })),
  };
}

export function articleJsonLd(doc: Pillar | Page | Article, pathname: string) {
  const site = getSite();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: doc.title,
    description: doc.metaDescription,
    url: absoluteUrl(pathname),
    datePublished: doc.dates.published,
    ...(doc.dates.updated ? { dateModified: doc.dates.updated } : {}),
    inLanguage: doc.locale,
    author: personJsonLd(doc.author),
    ...(doc.type !== "page" && doc.type !== "pillar" && leadImage(doc)
      ? { image: absoluteUrl(leadImage(doc)!.src) }
      : "media" in doc && doc.media[0]
        ? { image: absoluteUrl(doc.media[0].src) }
        : {}),
    publisher: { "@type": "Organization", name: site.name },
  };
}
