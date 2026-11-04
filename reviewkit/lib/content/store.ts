import fs from "node:fs";
import path from "node:path";
import { sqlAdmin } from "../db/client";
import { contentDriver } from "./index";
import {
  docFilePath,
  listRawDocs as listRawFiles,
  loadAllDocs as loadAllFiles,
  readRawDoc as readRawFile,
  writeDocFile,
  type DocType,
  type LoadedDoc,
} from "./files";
import { upsertDoc } from "./neon-write";
import { docSchema, type Doc } from "./schema";

/**
 * Where the studio reads and writes documents, drafts included.
 *
 *   files  content/*.json on disk (npm run dev)
 *   neon   the content table, through the owner role (the live site)
 *
 * The public pages go through lib/content/index.ts, which only ever sees published
 * rows. Everything here is for the studio and runs behind its login.
 */

export type RawEntry = { sourcePath: string; raw: unknown; error?: string };

const useNeon = () => contentDriver() === "neon";
const rowPath = (type: string, slug: string) => `db:${type}/${slug}`;
const TRASH_DIR = path.join(process.cwd(), "content", ".trash");

/** Every document with its raw JSON, including (on disk) ones that fail validation. */
export async function listRawDocs(): Promise<RawEntry[]> {
  if (!useNeon()) return listRawFiles();
  const rows = (await sqlAdmin()`
    SELECT type, slug, doc FROM content ORDER BY type, slug
  `) as { type: string; slug: string; doc: unknown }[];
  return rows.map((r) => {
    const parsed = docSchema.safeParse(r.doc);
    return {
      sourcePath: rowPath(r.type, r.slug),
      raw: r.doc,
      ...(parsed.success ? {} : { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }),
    };
  });
}

/** Every valid document, drafts included. */
export async function loadAllDocs(): Promise<LoadedDoc[]> {
  if (!useNeon()) return loadAllFiles();
  const out: LoadedDoc[] = [];
  for (const e of await listRawDocs()) {
    const parsed = docSchema.safeParse(e.raw);
    if (parsed.success) out.push({ doc: parsed.data, sourcePath: e.sourcePath });
  }
  return out;
}

/** One document's raw JSON for editing, or null. */
export async function readRawDoc(type: DocType, slug: string): Promise<unknown | null> {
  if (!useNeon()) return readRawFile(type, slug);
  const rows = (await sqlAdmin()`
    SELECT doc FROM content WHERE type = ${type} AND slug = ${slug} LIMIT 1
  `) as { doc: unknown }[];
  return rows[0]?.doc ?? null;
}

export async function docExists(type: DocType, slug: string): Promise<boolean> {
  if (!useNeon()) return fs.existsSync(docFilePath(type, slug));
  return (await readRawDoc(type, slug)) !== null;
}

/**
 * Store a validated document. When the slug changed, the old copy is kept rather
 * than erased: beside it as a .bak file on disk, or in content_trash in the database.
 * Returns where it was written.
 */
export async function writeDoc(doc: Doc, originalSlug?: string): Promise<string> {
  const renamed = Boolean(originalSlug && originalSlug !== doc.slug);
  if (!useNeon()) {
    const file = writeDocFile(doc);
    if (renamed) {
      const old = docFilePath(doc.type, originalSlug!);
      if (fs.existsSync(old)) fs.renameSync(old, `${old}.bak`);
    }
    return file;
  }
  const { schemaVersion, type, ...rest } = doc;
  const ordered = { schemaVersion, type, ...rest } as Doc;
  const sql = sqlAdmin();
  await upsertDoc(sql, ordered, rowPath(doc.type, doc.slug));
  if (renamed) await moveRowToTrash(doc.type, originalSlug!, "renamed");
  return rowPath(doc.type, doc.slug);
}

async function moveRowToTrash(type: DocType, slug: string, reason: "deleted" | "renamed"): Promise<boolean> {
  const sql = sqlAdmin();
  const moved = (await sql`
    WITH gone AS (
      DELETE FROM content WHERE type = ${type} AND slug = ${slug} RETURNING type, slug, doc
    )
    INSERT INTO content_trash (type, slug, doc, reason)
    SELECT type, slug, doc, ${reason} FROM gone
    RETURNING id
  `) as { id: string }[];
  return moved.length > 0;
}

/** Move a document to the trash. The caller checks nothing still links to it. */
export async function trashStoredDoc(type: DocType, slug: string): Promise<{ ok: true; movedTo: string } | { ok: false; reason: string }> {
  if (useNeon()) {
    return (await moveRowToTrash(type, slug, "deleted"))
      ? { ok: true, movedTo: `content_trash (${type}/${slug})` }
      : { ok: false, reason: "not found" };
  }
  const file = docFilePath(type, slug);
  if (!fs.existsSync(file)) return { ok: false, reason: "file not found" };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(TRASH_DIR, type);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${slug}--${stamp}.json`);
  fs.renameSync(file, dest);
  return { ok: true, movedTo: path.relative(process.cwd(), dest) };
}

export type { DocType, LoadedDoc };
