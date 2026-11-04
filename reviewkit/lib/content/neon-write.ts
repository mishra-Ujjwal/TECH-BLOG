import crypto from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { toSummary, type Doc } from "./schema";

/**
 * Writing one document into Postgres. Shared by `npm run content:import` and the
 * studio on a database-backed site, so a post saved either way lands in exactly the
 * same shape. Uses the owner connection (sqlAdmin); the site's reader never writes.
 */

type Sql = NeonQueryFunction<false, false>;

export function contentHash(doc: Doc): string {
  return crypto.createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}

/** Upsert the document, its sources and any new price snapshots. Returns new price rows. */
export async function upsertDoc(sql: Sql, doc: Doc, sourcePath: string): Promise<{ prices: number }> {
  const summary = toSummary(doc);
  const category = "category" in doc ? doc.category : null;
  const pillar = doc.type === "review" || doc.type === "article" ? (doc.pillar ?? null) : null;
  const score = doc.type === "review" ? (doc.verdict.score ?? null) : null;

  const [row] = (await sql`
    INSERT INTO content (
      type, slug, locale, status, title, excerpt, category, pillar, score,
      published_at, updated_at, last_checked, tags, doc, summary,
      source_path, content_hash, imported_at
    ) VALUES (
      ${doc.type}, ${doc.slug}, ${doc.locale}, ${doc.status}, ${doc.title}, ${doc.excerpt},
      ${category}, ${pillar}, ${score},
      ${doc.dates.published}, ${doc.dates.updated ?? null}, ${doc.dates.lastChecked ?? null},
      ${JSON.stringify(doc.tags)}::jsonb, ${JSON.stringify(doc)}::jsonb,
      ${JSON.stringify(summary)}::jsonb,
      ${sourcePath}, ${contentHash(doc)}, now()
    )
    ON CONFLICT (type, slug) DO UPDATE SET
      locale = EXCLUDED.locale,
      status = EXCLUDED.status,
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      category = EXCLUDED.category,
      pillar = EXCLUDED.pillar,
      score = EXCLUDED.score,
      published_at = EXCLUDED.published_at,
      updated_at = EXCLUDED.updated_at,
      last_checked = EXCLUDED.last_checked,
      tags = EXCLUDED.tags,
      doc = EXCLUDED.doc,
      summary = EXCLUDED.summary,
      source_path = EXCLUDED.source_path,
      content_hash = EXCLUDED.content_hash,
      imported_at = now()
    RETURNING id
  `) as { id: string }[];
  const contentId = row.id;

  /* licence audit trail */
  const sources = doc.type === "page" ? [] : doc.sources;
  for (const s of sources) {
    await sql`
      INSERT INTO sources (id, name, url, licence, licence_url, attribution)
      VALUES (${s.id}, ${s.name}, ${s.url ?? null}, ${s.licence}, ${s.licenceUrl ?? null}, ${s.attribution ?? null})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        url = EXCLUDED.url,
        licence = EXCLUDED.licence,
        licence_url = EXCLUDED.licence_url,
        attribution = EXCLUDED.attribution,
        last_seen = now()
    `;
    await sql`
      INSERT INTO content_sources (content_id, source_id, fetched_at)
      VALUES (${contentId}, ${s.id}, ${s.fetchedAt ?? null})
      ON CONFLICT (content_id, source_id) DO UPDATE SET fetched_at = EXCLUDED.fetched_at
    `;
  }

  /* dated price history */
  let prices = 0;
  if (doc.type === "review" || doc.type === "article") {
    for (const p of doc.prices) {
      const res = (await sql`
        INSERT INTO price_snapshots
          (content_id, retailer, amount, currency, url, affiliate, checked_at, note)
        VALUES (${contentId}, ${p.retailer}, ${p.amount}, ${p.currency},
                ${p.url ?? null}, ${p.affiliate}, ${p.checkedAt}, ${p.note ?? null})
        ON CONFLICT (content_id, retailer, amount, currency, checked_at) DO NOTHING
        RETURNING id
      `) as { id: string }[];
      if (res.length > 0) prices++;
    }
  }
  return { prices };
}
