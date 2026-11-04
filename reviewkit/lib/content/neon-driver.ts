import { sqlRead } from "../db/client";
import { docSchema, type Doc, type DocSummary } from "./schema";

/**
 * Neon driver. Only ever reads published rows, and filters in SQL so a category
 * page does not pull every document across the wire.
 */

type Row = { doc: unknown };

function parseDoc(row: Row, where: string): Doc {
  const parsed = docSchema.safeParse(row.doc);
  if (!parsed.success) {
    throw new Error(
      `Row from ${where} does not match the content contract. Re-run content:import. ` +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return parsed.data;
}

export async function getDoc(type: Doc["type"], slug: string): Promise<Doc | null> {
  const sql = sqlRead();
  const rows = (await sql`
    SELECT doc FROM content
    WHERE type = ${type} AND slug = ${slug} AND status = 'published'
    LIMIT 1
  `) as Row[];
  if (rows.length === 0) return null;
  return parseDoc(rows[0], `${type}/${slug}`);
}

export async function listSummaries(opts: {
  type?: Doc["type"];
  category?: string;
  pillar?: string;
  limit?: number;
}): Promise<DocSummary[]> {
  const sql = sqlRead();
  const { type = null, category = null, pillar = null, limit = 500 } = opts;
  const rows = (await sql`
    SELECT summary FROM content
    WHERE status = 'published'
      AND (${type}::text     IS NULL OR type     = ${type})
      AND (${category}::text IS NULL OR category = ${category})
      AND (${pillar}::text   IS NULL OR pillar   = ${pillar})
    ORDER BY published_at DESC, id DESC
    LIMIT ${limit}
  `) as { summary: DocSummary }[];
  return rows.map((r) => r.summary);
}

export async function listSitemapEntries(): Promise<
  { type: Doc["type"]; slug: string; updatedAt: string }[]
> {
  const sql = sqlRead();
  const rows = (await sql`
    SELECT type, slug,
           to_char(coalesce(updated_at, published_at), 'YYYY-MM-DD') AS updated_at
    FROM content
    WHERE status = 'published'
    ORDER BY type, slug
  `) as { type: Doc["type"]; slug: string; updated_at: string }[];
  return rows.map((r) => ({ type: r.type, slug: r.slug, updatedAt: r.updated_at }));
}

export async function searchContent(query: string, limit = 25): Promise<DocSummary[]> {
  const sql = sqlRead();
  const rows = (await sql`
    SELECT summary
    FROM content
    WHERE status = 'published'
      AND search @@ websearch_to_tsquery('english', ${query})
    ORDER BY ts_rank(search, websearch_to_tsquery('english', ${query})) DESC
    LIMIT ${limit}
  `) as { summary: DocSummary }[];
  return rows.map((r) => r.summary);
}

/** Latest price per retailer, from the snapshot history. */
export async function latestPrices(
  type: Doc["type"],
  slug: string,
): Promise<
  { retailer: string; amount: number; currency: string; url: string | null; affiliate: boolean; checkedAt: string; note: string | null }[]
> {
  const sql = sqlRead();
  const rows = (await sql`
    SELECT DISTINCT ON (p.retailer)
           p.retailer, p.amount, p.currency, p.url, p.affiliate,
           to_char(p.checked_at, 'YYYY-MM-DD') AS checked_at, p.note
    FROM price_snapshots p
    JOIN content c ON c.id = p.content_id
    WHERE c.type = ${type} AND c.slug = ${slug} AND c.status = 'published'
    ORDER BY p.retailer, p.checked_at DESC
  `) as {
    retailer: string;
    amount: string | number;
    currency: string;
    url: string | null;
    affiliate: boolean;
    checked_at: string;
    note: string | null;
  }[];
  return rows.map((r) => ({
    retailer: r.retailer,
    amount: Number(r.amount),
    currency: r.currency,
    url: r.url,
    affiliate: r.affiliate,
    checkedAt: r.checked_at,
    note: r.note,
  }));
}
