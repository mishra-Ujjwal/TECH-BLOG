/**
 * Shrink the images in public/images so pages load quickly.
 *
 *   npm run images:optimise
 *
 * Any image wider than MAX_WIDTH, or larger than MAX_BYTES, is converted to WebP at
 * that width (never enlarged), with camera and location data stripped. The original
 * is kept in image-originals/ (not served, not deployed), and every post in content/
 * that pointed at the old file is updated to the new path and size.
 *
 * Safe to run repeatedly: already-small WebP files are left alone.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const IMAGES = path.join(PUBLIC, "images");
const BACKUP = path.join(ROOT, "image-originals");
const MAX_WIDTH = 1600;
const MAX_BYTES = 250 * 1024;
const QUALITY = 80;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

type Change = { from: string; to: string; width: number; height: number };

async function optimise(file: string): Promise<Change | null> {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".avif"].includes(ext)) return null;
  const meta = await sharp(file).metadata();
  const size = fs.statSync(file).size;
  const tooWide = (meta.width ?? 0) > MAX_WIDTH;
  if (!tooWide && size <= MAX_BYTES && ext === ".webp") return null;
  if (!tooWide && size <= MAX_BYTES && ext !== ".png") return null;

  const out = file.replace(/\.[a-z0-9]+$/i, ".webp");
  const target = out === file ? `${file}.tmp` : out;
  const info = await sharp(file)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(target);

  // Keep the original outside public/.
  const backup = path.join(BACKUP, path.relative(PUBLIC, file));
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(file, backup);
  if (target !== out) fs.renameSync(target, out);
  else if (out !== file) fs.rmSync(file);

  const before = Math.round(size / 1024);
  const after = Math.round(fs.statSync(out).size / 1024);
  console.log(`${path.relative(ROOT, file)}: ${before}KB -> ${after}KB (${info.width}x${info.height})`);
  return {
    from: `/${path.relative(PUBLIC, file).split(path.sep).join("/")}`,
    to: `/${path.relative(PUBLIC, out).split(path.sep).join("/")}`,
    width: info.width,
    height: info.height,
  };
}

/** Point every reference in content/ at the new file and size. */
function updateContent(changes: Change[]) {
  const byFrom = new Map(changes.map((c) => [c.from, c]));
  const files = walk(path.join(ROOT, "content")).filter(
    (f) => f.endsWith(".json") && !f.includes(`${path.sep}.trash${path.sep}`),
  );
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    let touched = false;
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && byFrom.has(v)) {
          const c = byFrom.get(v)!;
          obj[k] = c.to;
          if (k === "src") {
            obj.width = c.width;
            obj.height = c.height;
          }
          touched = true;
        } else visit(v);
      }
    };
    visit(doc);
    if (touched) {
      fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      console.log(`updated ${path.relative(ROOT, file)}`);
    }
  }
}

async function main() {
  const changes: Change[] = [];
  for (const file of walk(IMAGES)) {
    const c = await optimise(file);
    if (c) changes.push(c);
  }
  if (changes.length) updateContent(changes);
  console.log(changes.length ? `\nOptimised ${changes.length} image(s). Originals are in image-originals/.` : "Nothing to optimise.");
}

main();
