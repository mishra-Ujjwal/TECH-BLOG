/**
 * Copies every post from Neon into content/, the reverse of content:import.
 *
 *   npm run content:pull             write each row to its JSON file
 *   npm run content:pull -- --dry-run
 *
 * The live studio saves into the database, so run this to bring those posts into
 * the repo before committing. Files with no row are listed, never deleted: a post
 * removed on the site sits in content_trash and can be restored from there.
 */
import fs from "node:fs";
import { contentFilePaths, docFilePath, writeDocFile } from "../lib/content/files";
import { docSchema } from "../lib/content/schema";
import { sqlAdmin } from "../lib/db/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* fall back to the real environment */
}

const DRY = process.argv.includes("--dry-run");

async function main() {
  const rows = (await sqlAdmin()`SELECT type, slug, doc FROM content ORDER BY type, slug`) as {
    type: string;
    slug: string;
    doc: unknown;
  }[];
  console.log(`${rows.length} document(s) in the database`);

  let written = 0;
  let same = 0;
  let invalid = 0;
  const seen = new Set<string>();

  for (const r of rows) {
    const parsed = docSchema.safeParse(r.doc);
    if (!parsed.success) {
      invalid++;
      console.log(`  x ${r.type}/${r.slug}: does not match the content contract, left alone`);
      continue;
    }
    const file = docFilePath(parsed.data.type, parsed.data.slug);
    seen.add(file);
    const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    if (before && JSON.stringify(docSchema.parse(before)) === JSON.stringify(parsed.data)) {
      same++;
      continue;
    }
    if (DRY) console.log(`  would write ${r.type}/${r.slug}`);
    else console.log(`  + ${writeDocFile(parsed.data)}`);
    written++;
  }

  const orphans = contentFilePaths().filter((f) => !seen.has(f));
  for (const f of orphans) console.log(`  ? ${f.replace(`${process.cwd()}/`, "")} has no row (deleted on the site, or never imported)`);

  console.log(`\n${written} ${DRY ? "to write" : "written"}, ${same} unchanged, ${invalid} invalid, ${orphans.length} file(s) with no row.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
