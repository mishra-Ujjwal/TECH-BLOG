import { checkPost, checkSite, type Check, type PostReport, type Sibling } from "./adsense-check";
import { listRawDocs } from "./content/store";
import { getAuthors, getSite } from "./site";

/**
 * Reads every document and runs the AdSense checks over the whole site.
 * Server only. Free rules, no API calls, so the studio page can run it on every load.
 */

export type AuditRow = {
  type: string;
  slug: string;
  title: string;
  status: string;
  report: PostReport;
};

type Raw = Record<string, unknown>;

async function rawDocs(): Promise<Raw[]> {
  return (await listRawDocs())
    .map((f) => f.raw)
    .filter((r): r is Raw => Boolean(r) && typeof r === "object" && typeof (r as Raw).slug === "string");
}

/** Titles of every post, for the duplicate check. */
export async function siblings(): Promise<Sibling[]> {
  return (await rawDocs())
    .filter((d) => d.type !== "page")
    .map((d) => ({ slug: String(d.slug), title: String(d.title ?? "") }));
}

function pageText(doc: Raw): string {
  const sections = Array.isArray(doc.sections) ? (doc.sections as { heading?: string; body?: string }[]) : [];
  return [doc.title, doc.excerpt, ...sections.flatMap((s) => [s.heading, s.body])].filter(Boolean).join("\n");
}

export async function auditSite(): Promise<{ site: Check[]; posts: AuditRow[] }> {
  const docs = await rawDocs();
  const sibs = await siblings();
  const posts: AuditRow[] = docs
    .filter((d) => d.type !== "page")
    .map((d) => ({
      type: String(d.type),
      slug: String(d.slug),
      title: String(d.title ?? d.slug),
      status: String(d.status ?? "draft"),
      report: checkPost(d, sibs),
    }));

  const pages = new Map(
    docs.filter((d) => d.type === "page" && d.status === "published").map((d) => [String(d.slug), pageText(d)]),
  );

  const site = checkSite({
    site: getSite(),
    pages,
    authors: getAuthors(),
    published: posts.filter((p) => p.status === "published"),
  });
  return { site, posts };
}
