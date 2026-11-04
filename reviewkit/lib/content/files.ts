import fs from "node:fs";
import path from "node:path";
import { docSchema, type Doc } from "./schema";

/**
 * File driver: reads content/*.json straight off disk.
 * Used for local development, for CI, and whenever DATABASE_URL is absent, so a
 * build never depends on a live database.
 */

const CONTENT_ROOT = path.join(process.cwd(), "content");
const DOC_DIRS = ["reviews", "articles", "pillars", "pages"] as const;

export type LoadedDoc = { doc: Doc; sourcePath: string };
export type DocType = Doc["type"];

/** Folder for each document type. */
export const DIR_FOR: Record<DocType, (typeof DOC_DIRS)[number]> = {
  review: "reviews",
  article: "articles",
  pillar: "pillars",
  page: "pages",
};

/**
 * Cached until a file is added, removed or edited. The key is every file's path and
 * modification time, so a post saved from /studio (or by hand) shows on the next
 * request without restarting the server.
 */
let cache: { key: string; docs: LoadedDoc[] } | null = null;

function cacheKey(files: string[]): string {
  return files.map((f) => `${f}:${fs.statSync(f).mtimeMs}`).join("|");
}

export function contentFilePaths(): string[] {
  const out: string[] = [];
  for (const dir of DOC_DIRS) {
    const full = path.join(CONTENT_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full)) {
      if (entry.endsWith(".json")) out.push(path.join(full, entry));
    }
  }
  return out.sort();
}

/** Parse and validate one file. Throws with the file name on failure. */
export function loadDocFile(filePath: string): LoadedDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`${path.relative(process.cwd(), filePath)}: invalid JSON (${String(err)})`);
  }
  const parsed = docSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `    ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(
      `${path.relative(process.cwd(), filePath)}: does not match the content contract\n${lines.join("\n")}`,
    );
  }
  return { doc: parsed.data, sourcePath: path.relative(process.cwd(), filePath) };
}

export function loadAllDocs(): LoadedDoc[] {
  const files = contentFilePaths();
  const key = cacheKey(files);
  if (cache && cache.key === key) return cache.docs;
  cache = { key, docs: files.map(loadDocFile) };
  return cache.docs;
}

/** Where a document of this type and slug lives on disk. */
export function docFilePath(type: DocType, slug: string): string {
  return path.join(CONTENT_ROOT, DIR_FOR[type], `${slug}.json`);
}

/** Write one document as formatted JSON. The caller validates it first. */
export function writeDocFile(doc: Doc): string {
  const file = docFilePath(doc.type, doc.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { schemaVersion, type, ...rest } = doc;
  const ordered = { schemaVersion, type, ...rest };
  fs.writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
  cache = null;
  return path.relative(process.cwd(), file);
}

/** Read one document's raw JSON, valid or not, for editing. */
export function readRawDoc(type: DocType, slug: string): unknown | null {
  const file = docFilePath(type, slug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Every document file with its raw JSON, including ones that fail validation. */
export function listRawDocs(): { sourcePath: string; raw: unknown; error?: string }[] {
  return contentFilePaths().map((file) => {
    const sourcePath = path.relative(process.cwd(), file);
    try {
      loadDocFile(file);
      return { sourcePath, raw: JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch (e) {
      let raw: unknown = null;
      try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {}
      return { sourcePath, raw, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

export function clearCache(): void {
  cache = null;
}
