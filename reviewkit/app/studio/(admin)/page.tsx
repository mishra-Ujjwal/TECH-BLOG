import Link from "next/link";
import { btnPrimary, btnSecondary, PageHeader, Panel } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { imageStats } from "@/lib/media";
import { getAuthors, getCategories, getSite } from "@/lib/site";
import { studioRows } from "./rows";

/**
 * Dashboard: what is on the site, what is waiting, and what still needs setting up
 * before the site is ready for readers and AdSense. Every figure is read from the
 * stored posts and images, nothing is estimated.
 */

export default async function Dashboard() {
  await requireAdmin();
  const site = getSite();
  const rows = (await studioRows());
  const posts = rows.filter((r) => r.type !== "page");
  const pages = rows.filter((r) => r.type === "page");
  const published = posts.filter((r) => r.status === "published");
  const drafts = posts.filter((r) => r.status !== "published");
  const images = await imageStats();

  const byCategory = getCategories().map((c) => ({
    slug: c.slug,
    name: c.name,
    count: published.filter((r) => r.category === c.slug).length,
  }));
  const max = Math.max(1, ...byCategory.map((c) => c.count));

  const livePages = new Set(pages.filter((p) => p.status === "published").map((p) => p.slug));
  const author = getAuthors()[0];
  const checks: { ok: boolean; label: string; fix: string; href: string }[] = [
    {
      ok: livePages.has("privacy-policy") && livePages.has("terms"),
      label: "Privacy policy and terms are published",
      fix: "AdSense requires both",
      href: "/studio/pages",
    },
    {
      ok: livePages.has("about") && livePages.has("contact"),
      label: "About us and Contact are published",
      fix: "Readers and reviewers look for them",
      href: "/studio/pages",
    },
    {
      ok: !/example\./i.test(site.publisher.email),
      label: "A real contact email is set",
      fix: `Currently ${site.publisher.email}`,
      href: "/studio/settings",
    },
    {
      ok: Boolean(author && !/TODO/.test(author.name + author.bio + author.about)),
      label: "Author profile is complete",
      fix: "Bylines and author pages show it",
      href: "/studio/authors",
    },
    {
      ok: published.length >= 15,
      label: "At least 15 published posts",
      fix: `${published.length} so far; thin sites are often refused by AdSense`,
      href: "/studio/posts",
    },
    {
      ok: site.social.length > 0,
      label: "Social profiles added",
      fix: "Shown in the footer and to Google",
      href: "/studio/settings",
    },
  ];
  const done = checks.filter((c) => c.ok).length;

  const stats = [
    { label: "Published posts", value: published.length, href: "/studio/posts" },
    { label: "Drafts", value: drafts.length, href: "/studio/posts" },
    { label: "Static pages live", value: livePages.size, href: "/studio/pages" },
    { label: "Images", value: images.count, note: `${images.kb} KB in total`, href: "/studio/media" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`An overview of ${site.name}: what is live, what is waiting, and what still needs setting up.`}
        actions={
          <>
            <Link href="/studio/import" className={btnSecondary}>
              Import JSON
            </Link>
            <Link href="/studio/new" className={btnPrimary}>
              New post
            </Link>
          </>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block rounded-[14px] border border-rule bg-paper p-5 hover:border-accent">
              <span className="block text-small text-ink-2">{s.label}</span>
              <span className="num mt-1 block text-[2rem] font-bold leading-tight tracking-[-0.03em]">{s.value}</span>
              {s.note && <span className="block text-micro text-ink-3">{s.note}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Recent posts" description="The latest posts by date, drafts included.">
          <ul className="divide-y divide-rule">
            {posts.slice(0, 7).map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/studio/edit/${r.type}/${r.slug}`} className="block truncate text-small font-semibold hover:text-accent">
                    {r.title}
                  </Link>
                  <span className="text-micro text-ink-3">
                    {r.typeLabel}
                    {r.categoryLabel ? `, ${r.categoryLabel}` : ""}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-micro font-semibold ${
                    r.status === "published" ? "bg-measured-wash text-measured" : "bg-paper-2 text-ink-2"
                  }`}
                >
                  {r.status === "published" ? "Published" : "Draft"}
                </span>
              </li>
            ))}
            {posts.length === 0 && <li className="py-3 text-small text-ink-2">No posts yet.</li>}
          </ul>
          <Link href="/studio/posts" className="link mt-3 inline-block text-small">
            See all posts
          </Link>
        </Panel>

        <Panel title="Site readiness" description={`${done} of ${checks.length} done`}>
          <ul className="space-y-2.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-small">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-micro font-bold ${
                    c.ok ? "bg-measured-wash text-measured" : "bg-caution-wash text-caution"
                  }`}
                >
                  {c.ok ? "✓" : "!"}
                </span>
                <span>
                  <span className="font-medium">{c.label}</span>
                  {!c.ok && (
                    <>
                      <span className="block text-micro text-ink-3">{c.fix}</span>
                      <Link href={c.href} className="link text-micro">
                        Fix this
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Published posts by category" className="mt-6">
        <ul className="space-y-2.5">
          {byCategory.map((c) => (
            <li key={c.slug} className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-small">
              <Link href="/studio/categories" className="truncate hover:text-accent">
                {c.name}
              </Link>
              <span className="h-2.5 overflow-hidden rounded-full bg-paper-2">
                <span
                  className="block h-full rounded-full bg-brand-orange"
                  style={{ width: `${(c.count / max) * 100}%` }}
                />
              </span>
              <span className="num text-right font-semibold">{c.count}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
