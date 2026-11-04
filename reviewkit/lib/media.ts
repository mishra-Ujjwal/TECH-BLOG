import fs from "node:fs";
import path from "node:path";
import { listRawDocs } from "./content/files";

/** Which posts use each image path, from every file in content/ (drafts included). */
export function imageUsage(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of listRawDocs()) {
    const raw = f.raw as { slug?: string } | null;
    const blob = JSON.stringify(f.raw ?? {});
    for (const m of blob.matchAll(/"(\/images\/[^"]+)"/g)) {
      const list = map.get(m[1]) ?? [];
      const slug = raw?.slug ?? f.sourcePath;
      if (!list.includes(slug)) list.push(slug);
      map.set(m[1], list);
    }
  }
  return map;
}

export type MediaItem = { src: string; folder: string; name: string; kb: number; modified: string; usedBy: string[] };

/** Every image under public/images, newest first. */
export function listMedia(): MediaItem[] {
  const root = path.join(process.cwd(), "public", "images");
  const usage = imageUsage();
  const out: MediaItem[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(e.name)) {
        const src = `/${path.relative(path.join(process.cwd(), "public"), full).split(path.sep).join("/")}`;
        const st = fs.statSync(full);
        out.push({
          src,
          folder: path.relative(root, dir).split(path.sep).join("/") || "(top level)",
          name: e.name,
          kb: Math.max(1, Math.round(st.size / 1024)),
          modified: st.mtime.toISOString().slice(0, 10),
          usedBy: usage.get(src) ?? [],
        });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => b.modified.localeCompare(a.modified) || a.src.localeCompare(b.src));
}
