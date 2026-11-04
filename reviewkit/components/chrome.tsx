import Link from "next/link";
import { listFooterPages } from "@/lib/content";
import type { SocialNetwork } from "@/lib/content/schema";
import { getCategories, getSite } from "@/lib/site";
import { ConsentResetLink } from "./consent";
import { CategoryStrip, MainNav } from "./nav";

/**
 * The TechnoWorld360 wordmark: the supplied artwork with its background removed, so
 * it sits on any surface. The masthead keeps a light palette in both themes and uses
 * the navy version; elsewhere (the footer) a light-lettered version takes over in
 * dark mode.
 */
export function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/technoworld360-logo.png"
      alt=""
      width={997}
      height={88}
      className={lg ? "h-auto w-[13.5rem]" : "h-[1.3rem] w-auto max-w-none sm:h-[1.75rem]"}
    />
  );
  return (
    <span className="inline-flex py-2.5 sm:py-3">
      {lg ? (
        <picture>
          <source srcSet="/brand/technoworld360-logo-dark.png" media="(prefers-color-scheme: dark)" />
          {img}
        </picture>
      ) : (
        img
      )}
    </span>
  );
}

/** Site sections that always exist; any other single-segment link is a static page. */
const ROUTES = new Set(["/", "/reviews", "/articles", "/guides", "/categories", "/search"]);

export async function Masthead() {
  const site = getSite();
  // Only link to static pages that are published, so the menu never leads to a 404.
  const live = new Set((await listFooterPages()).map((p) => `/${p.slug}`));
  const nav = site.nav.filter((n) => ROUTES.has(n.href) || !/^\/[^/]+$/.test(n.href) || live.has(n.href));
  const categories = getCategories().map((c) => ({
    slug: c.slug,
    name: c.name,
    brands: c.brands,
    topics: c.topics,
  }));
  return (
    <header id="top" className="border-b border-rule">
      <div className="brand-bar">
      <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3.5">
        <Link href="/" aria-label={`${site.name}, home`} className="min-w-0 flex-1 lg:flex-none">
          <BrandLogo />
        </Link>
        <MainNav items={nav} />
      </div>
      </div>
      <CategoryStrip categories={categories} />
    </header>
  );
}

/**
 * Footer links to static pages are listed here with short labels, and each one
 * renders only when that page is published, so the footer never links to a 404.
 * A published page with `footer: true` that is not listed here is added to
 * "About us" automatically.
 */
const ABOUT_PAGES: { slug: string; label: string }[] = [
  { slug: "about", label: "About us" },
  { slug: "how-we-test", label: "How we test" },
  { slug: "contact", label: "Contact" },
  { slug: "affiliate-disclosure", label: "Affiliate disclosure" },
];

const LEGAL_PAGES: { slug: string; label: string }[] = [
  { slug: "privacy-policy", label: "Privacy policy" },
  { slug: "terms", label: "Terms of use" },
];

export async function SiteFooter() {
  const site = getSite();
  const pages = await listFooterPages();
  const categories = getCategories();
  const live = new Set(pages.map((p) => p.slug));
  const listed = new Set([...ABOUT_PAGES, ...LEGAL_PAGES].map((p) => p.slug));

  // Company: the about pages that are published, plus any other footer page.
  const companyLinks = [
    ...ABOUT_PAGES.filter((p) => p.slug !== "contact" && live.has(p.slug)),
    ...pages.filter((p) => !listed.has(p.slug)).map((p) => ({ slug: p.slug, label: p.title })),
  ];
  const legalLinks = LEGAL_PAGES.filter((p) => live.has(p.slug));
  // The categories, split into two even columns.
  const half = Math.ceil(categories.length / 2);
  const topicsA = categories.slice(0, half);
  const topicsB = categories.slice(half);

  return (
    <footer className="mt-16 border-t border-rule bg-paper">
      <div className="mx-auto w-full max-w-[72rem] px-5 pb-8 pt-12 sm:pt-14">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
          {/* Brand, description, social */}
          <div className="max-w-[22rem]">
            <Link href="/" aria-label={`${site.name}, home`} className="inline-flex">
              <BrandLogo size="lg" />
            </Link>
            <p className="mt-5 text-small leading-relaxed text-ink-2">{site.description}</p>
            {site.social.length > 0 && (
              <ul className="mt-6 flex items-center gap-5" aria-label="Follow us">
                {site.social.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      rel="me noopener"
                      target="_blank"
                      aria-label={SOCIAL_LABELS[s.network]}
                      className="block text-ink hover:text-accent"
                    >
                      <SocialIcon network={s.network} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-4">
            <FooterList title="Company">
              {companyLinks.map((p) => (
                <FooterLink key={p.slug} href={`/${p.slug}`}>
                  {p.label}
                </FooterLink>
              ))}
            </FooterList>

            <FooterList title="Categories">
              {topicsA.map((c) => (
                <FooterLink key={c.slug} href={`/categories/${c.slug}`}>
                  {c.name}
                </FooterLink>
              ))}
            </FooterList>

            <FooterList title="More topics">
              {topicsB.map((c) => (
                <FooterLink key={c.slug} href={`/categories/${c.slug}`}>
                  {c.name}
                </FooterLink>
              ))}
            </FooterList>

            <FooterList title="Contact us">
              <li>
                <a
                  href={`mailto:${site.publisher.email}`}
                  className="flex items-center gap-2.5 text-ink hover:text-accent"
                >
                  <MailIcon />
                  <span className="break-all">{site.publisher.email}</span>
                </a>
              </li>
              {live.has("contact") && (
                <li>
                  <Link href="/contact" className="flex items-center gap-2.5 text-ink hover:text-accent">
                    <ChatIcon />
                    Contact page
                  </Link>
                </li>
              )}
            </FooterList>
          </div>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-3 px-5 py-6 text-small text-ink md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.publisher.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {legalLinks.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="hover:text-accent hover:underline">
                  {p.label}
                </Link>
              </li>
            ))}
            <li>
              <ConsentResetLink className="hover:text-accent hover:underline" />
            </li>
            <li>
              <a href="/sitemap.xml" className="hover:text-accent hover:underline">
                Site map
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Small line icons for the contact column, in the accent colour. */
function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  x: "X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  facebook: "Facebook",
};

/** Plain line icons, drawn in currentColor so they follow the theme. */
function SocialIcon({ network }: { network: SocialNetwork }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (network) {
    case "x":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <path d="M17.5 6.5h.01" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
          <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
  }
}

function FooterList({
  title,
  children,
  className = "",
  listClassName = "space-y-3.5",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  listClassName?: string;
}) {
  return (
    <nav aria-label={title} className={className}>
      <h2 className="text-[1.0625rem] font-bold">{title}</h2>
      <ul className={`mt-5 text-small ${listClassName}`}>{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink hover:text-accent">
        {children}
      </Link>
    </li>
  );
}
