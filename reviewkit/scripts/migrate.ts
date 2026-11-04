/**
 * Applies lib/db/migrations/*.sql in order, once each.
 *
 *   npm run db:migrate
 *
 * Uses DATABASE_URL_ADMIN (the Neon owner role). The Neon HTTP driver runs one
 * statement per round trip, so each file is split into statements first.
 */
import fs from "node:fs";
import path from "node:path";
import { sqlAdmin } from "../lib/db/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local, rely on the real environment */
}

const DIR = path.join(process.cwd(), "lib/db/migrations");

/** Split a SQL file into statements, ignoring semicolons in comments and strings. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (!inSingle && ch === "-" && next === "-") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (!inSingle && ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = !inSingle;
      buf += ch;
      i++;
      continue;
    }
    if (ch === ";" && !inSingle) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

async function main() {
  const sql = sqlAdmin();

  await sql.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const applied = new Set(
    ((await sql.query("SELECT name FROM _migrations")) as { name: string }[]).map((r) => r.name),
  );

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  = ${file} (already applied)`);
      continue;
    }
    const statements = splitStatements(fs.readFileSync(path.join(DIR, file), "utf8"));
    console.log(`  + ${file} (${statements.length} statements)`);
    for (const [idx, statement] of statements.entries()) {
      try {
        await sql.query(statement);
      } catch (e) {
        console.error(`\nFailed in ${file}, statement ${idx + 1}:\n${statement}\n`);
        throw e;
      }
    }
    await sql.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    ran++;
  }

  console.log(ran === 0 ? "\nNothing to do." : `\nApplied ${ran} migration(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
