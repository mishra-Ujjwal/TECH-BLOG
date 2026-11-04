/**
 * Loads content/*.json into Neon.
 *
 *   npm run content:import             upsert everything
 *   npm run content:import -- --prune  also delete rows whose file is gone
 *   npm run content:import -- --dry-run
 *   npm run content:import -- --force  overwrite posts edited in the live studio
 *
 * This script makes Postgres match the files. A row saved by the live studio after
 * its file last changed is skipped, so an import never silently undoes an edit made
 * on the site; run `npm run content:pull` first, or pass --force.
 * Prices are appended to price_snapshots, so you keep a dated history of what you
 * published rather than overwriting it.
 */
import fs from "node:fs";
import { loadDocFile, contentFilePaths } from "../lib/content/files";
import { contentHash, upsertDoc } from "../lib/content/neon-write";
import { sqlAdmin } from "../lib/db/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* fall back to the real environment */
}

const PRUNE = process.argv.includes("--prune");
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

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

  const existing = new Map(
    (
      (await sql`SELECT type, slug, content_hash, imported_at FROM content`) as {
        type: string;
        slug: string;
        content_hash: string;
        imported_at: string;
      }[]
    ).map((r) => [`${r.type}:${r.slug}`, r]),
  );

  let upserted = 0;
  let prices = 0;
  let skipped = 0;
  const errors: { file: string; message: string }[] = [];

  for (const { doc, sourcePath } of docs) {
    try {
      const row = existing.get(`${doc.type}:${doc.slug}`);
      const fileTime = fs.statSync(sourcePath).mtime.getTime();
      if (!FORCE && row && row.content_hash !== contentHash(doc) && new Date(row.imported_at).getTime() > fileTime) {
        skipped++;
        console.log(`  ! ${doc.type}/${doc.slug} was changed on the site after ${sourcePath}; skipped (content:pull, or --force)`);
        continue;
      }
      prices += (await upsertDoc(sql, doc, sourcePath)).prices;
      upserted++;
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
      SELECT id, type, slug, source_path FROM content
      WHERE (type || ':' || slug) <> ALL(${keep}::text[])
    `) as { id: string; type: string; slug: string; source_path: string | null }[];
    for (const s of stale) {
      // Written by the live studio and never pulled: there is no file because it is new.
      if (!FORCE && s.source_path?.startsWith("db:")) {
        console.log(`  ! kept ${s.type}/${s.slug}, written on the site (content:pull, or --force)`);
        continue;
      }
      await sql`DELETE FROM content WHERE id = ${s.id}`;
      console.log(`  - removed ${s.type}/${s.slug}`);
      removed++;
    }
  }

  await sql`
    UPDATE import_log
    SET finished_at = now(), upserted = ${upserted}, skipped = ${skipped}, removed = ${removed},
        errors = ${JSON.stringify(errors)}::jsonb
    WHERE id = ${log.id}
  `;

  console.log(
    `\n${upserted} upserted, ${skipped} skipped, ${prices} new price snapshot(s), ${removed} removed, ${errors.length} error(s).`,
  );
  if (!PRUNE) console.log("Pass --prune to delete rows for files you have deleted.");
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
