/**
 * Loads content/*.json into Neon.
 *
 *   npm run content:import             upsert everything
 *   npm run content:import -- --prune  also delete rows whose file is gone
 *   npm run content:import -- --dry-run
 *
 * The JSON files stay the source of truth. This script makes Postgres match them.
 * Prices are appended to price_snapshots, so you keep a dated history of what you
 * published rather than overwriting it.
 */
import crypto from "node:crypto";
import { loadDocFile, contentFilePaths } from "../lib/content/files";
import { toSummary, type Doc } from "../lib/content/schema";
import { sqlAdmin } from "../lib/db/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* fall back to the real environment */
}

const PRUNE = process.argv.includes("--prune");
const DRY = process.argv.includes("--dry-run");

function hash(doc: Doc): string {
  return crypto.createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}

async function main() {
  const files = contentFilePaths();
  const docs = files.map(loadDocFile); // throws on the first invalid file
  console.log(`${docs.length} document(s) loaded from content/`);

  if (DRY) {
    for (const { doc, sourcePath } of docs) {
      console.log(`  would upsert ${doc.type}/${doc.slug} (${doc.status}) from ${sourcePath}`);
    }
    console.log("\nDry run, nothing written.");
    return;
  }

  const sql = sqlAdmin();

  const [log] = (await sql`
    INSERT INTO import_log (files_seen) VALUES (${docs.length}) RETURNING id
  `) as { id: string }[];

  let upserted = 0;
  let prices = 0;
  const errors: { file: string; message: string }[] = [];

  for (const { doc, sourcePath } of docs) {
    try {
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
          ${sourcePath}, ${hash(doc)}, now()
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
      upserted++;

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

      console.log(`  + ${doc.type}/${doc.slug} (${doc.status})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ file: sourcePath, message });
      console.log(`  x ${sourcePath}: ${message}`);
    }
  }

  /* remove rows whose file no longer exists */
  let removed = 0;
  if (PRUNE) {
    const keep = docs.map(({ doc }) => `${doc.type}:${doc.slug}`);
    const stale = (await sql`
      SELECT id, type, slug FROM content
      WHERE (type || ':' || slug) <> ALL(${JSON.stringify(keep)}::text[])
    `) as { id: string; type: string; slug: string }[];
    for (const s of stale) {
      await sql`DELETE FROM content WHERE id = ${s.id}`;
      console.log(`  - removed ${s.type}/${s.slug}`);
      removed++;
    }
  }

  await sql`
    UPDATE import_log
    SET finished_at = now(), upserted = ${upserted}, removed = ${removed},
        errors = ${JSON.stringify(errors)}::jsonb
    WHERE id = ${log.id}
  `;

  console.log(
    `\n${upserted} upserted, ${prices} new price snapshot(s), ${removed} removed, ${errors.length} error(s).`,
  );
  if (!PRUNE) console.log("Pass --prune to delete rows for files you have deleted.");
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
