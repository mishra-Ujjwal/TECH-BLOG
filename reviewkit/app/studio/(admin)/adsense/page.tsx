import Link from "next/link";
import { CheckList, RiskBadge, sortChecks } from "@/components/studio/adsense-parts";
import { PageHeader, Panel } from "@/components/studio/page-header";
import type { Risk } from "@/lib/adsense-check";
import { auditSite } from "@/lib/adsense-audit";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * AdSense readiness: the site-level things a reviewer looks at, and every post
 * ranked worst first. Rule-based checks only, read from content/ on each load, so
 * it is free to open. The Claude review is per post, in the editor.
 */

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };

export default async function AdsensePage() {
  await requireAdmin();
  const { site, posts } = await auditSite();

  const mustFix = site.filter((c) => c.level === "fail").length;
  const shouldFix = site.filter((c) => c.level === "warn").length;
  const ranked = [...posts].sort(
    (a, b) =>
      RISK_ORDER[a.report.risk] - RISK_ORDER[b.report.risk] ||
      b.report.aiScore - a.report.aiScore ||
      a.title.localeCompare(b.title),
  );
  const published = posts.filter((p) => p.status === "published");
  const counts = (["high", "medium", "low"] as Risk[]).map((r) => ({
    risk: r,
    n: published.filter((p) => p.report.risk === r).length,
  }));

  const headline =
    mustFix > 0
      ? `${mustFix} thing${mustFix === 1 ? "" : "s"} to fix before you apply`
      : shouldFix > 0
        ? `No blockers found; ${shouldFix} thing${shouldFix === 1 ? "" : "s"} would strengthen your application`
        : "Ready to apply, as far as these checks can tell";

  return (
    <>
      <PageHeader
        title="AdSense readiness"
        description="What an AdSense reviewer looks at, checked against your content, with a fix for each problem. For a deeper review of one post, open it and use Check with Claude."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Site checks" description={headline}>
          <CheckList checks={site} />
        </Panel>

        <div className="space-y-6">
          <Panel title="Published posts by risk">
            <ul className="grid grid-cols-3 gap-3">
              {counts.map((c) => (
                <li key={c.risk} className="rounded-[10px] border border-rule p-3">
                  <RiskBadge risk={c.risk} />
                  <span className="num mt-1.5 block text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">{c.n}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="About these checks">
            <div className="space-y-2 text-small text-ink-2">
              <p>
                Google does not refuse sites for using AI. It refuses <strong>low value content</strong>: thin posts,
                generic text with nothing first-hand, missing policy pages, and too little content overall.
              </p>
              <p>
                The AI-like score counts stock phrases that machine-written text overuses. It is a guide to what to
                rewrite, not proof of who wrote it. Words flagged under policies are for you to read in context; a
                guide to blocking spyware will mention spyware.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Every post, worst first"
        description="Drafts are included so you can fix them before publishing. Open a post to see each issue next to the field it is in."
        className="mt-6"
      >
        <div id="posts" className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[44rem] text-left text-small">
            <thead className="border-b border-rule text-micro text-ink-3">
              <tr>
                <th className="px-5 py-2 font-semibold sm:px-6">Post</th>
                <th className="px-3 py-2 font-semibold">Risk</th>
                <th className="px-3 py-2 text-right font-semibold">AI-like</th>
                <th className="px-3 py-2 text-right font-semibold">Words</th>
                <th className="px-5 py-2 font-semibold sm:px-6">What to fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ranked.map((p) => {
                const issues = sortChecks(p.report.checks).filter((c) => c.level === "fail" || c.level === "warn");
                return (
                  <tr key={`${p.type}/${p.slug}`} className="align-top">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`/studio/edit/${p.type}/${p.slug}`} className="font-semibold hover:text-accent">
                        {p.title}
                      </Link>
                      <span className="block text-micro text-ink-3">{p.status === "published" ? "Published" : "Draft"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge risk={p.report.risk} />
                    </td>
                    <td className={`num px-3 py-3 text-right ${p.report.aiScore >= 30 ? "font-semibold text-caution" : ""}`}>
                      {p.report.aiScore}
                    </td>
                    <td className={`num px-3 py-3 text-right ${p.report.words < 600 ? "font-semibold text-caution" : ""}`}>
                      {p.report.words.toLocaleString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-micro text-ink-2 sm:px-6">
                      {issues.length === 0 ? (
                        <span className="text-measured">Nothing flagged</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {issues.slice(0, 4).map((c) => (
                            <li key={c.id}>
                              <span className={c.level === "fail" ? "font-semibold text-caution" : ""}>{c.label}</span>
                            </li>
                          ))}
                          {issues.length > 4 && <li className="text-ink-3">and {issues.length - 4} more</li>}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
