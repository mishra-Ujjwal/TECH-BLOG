import fs from "node:fs";
import path from "node:path";
import { copy, del, list, put } from "@vercel/blob";
import { listRawDocs } from "./content/store";

/**
 * Pictures live in one of two places:
 *   public/images/   on disk, committed with the repo (npm run dev)
 *   Vercel Blob      when BLOB_READ_WRITE_TOKEN is set, so uploads work on a
 *                    serverless host. Stored under images/<folder>/, served from a
 *                    *.public.blob.vercel-storage.com URL.
 * Posts reference either form; both pass the content contract's imageRef.
 */

export const blobEnabled = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** True for a URL in this project's Blob store (or any public Blob store). */
export function isBlobUrl(src: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(src);
}

const IMAGE_REF = /"(\/images\/[^"]+|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^"]+)"/gi;

/** Which posts use each image, from every stored document (drafts included). */
export async function imageUsage(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const f of await listRawDocs()) {
    const raw = f.raw as { slug?: string } | null;
    const blob = JSON.stringify(f.raw ?? {});
    for (const m of blob.matchAll(IMAGE_REF)) {
      const list = map.get(m[1]) ?? [];
      const slug = raw?.slug ?? f.sourcePath;
      if (!list.includes(slug)) list.push(slug);
      map.set(m[1], list);
    }
  }
  return map;
}

export type MediaItem = { src: string; folder: string; name: string; kb: number; modified: string; usedBy: string[] };

function diskImages(): Omit<MediaItem, "usedBy">[] {
  const root = path.join(process.cwd(), "public", "images");
  const out: Omit<MediaItem, "usedBy">[] = [];
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
        });
      }
    }
  };
  walk(root);
  return out;
}

async function blobImages(): Promise<Omit<MediaItem, "usedBy">[]> {
  if (!blobEnabled()) return [];
  const out: Omit<MediaItem, "usedBy">[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "images/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const parts = b.pathname.split("/");
      out.push({
        src: b.url,
        folder: parts.slice(1, -1).join("/") || "(top level)",
        name: parts[parts.length - 1],
        kb: Math.max(1, Math.round(b.size / 1024)),
        modified: new Date(b.uploadedAt).toISOString().slice(0, 10),
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Every image on disk and in Blob, newest first. */
export async function listMedia(): Promise<MediaItem[]> {
  const usage = await imageUsage();
  const all = [...diskImages(), ...(await blobImages())];
  return all
    .map((m) => ({ ...m, usedBy: usage.get(m.src) ?? [] }))
    .sort((a, b) => b.modified.localeCompare(a.modified) || a.src.localeCompare(b.src));
}

/** Count and total size of every image, for the dashboard. */
export async function imageStats(): Promise<{ count: number; kb: number }> {
  const all = [...diskImages(), ...(await blobImages())];
  return { count: all.length, kb: all.reduce((n, m) => n + m.kb, 0) };
}

/** Store a processed upload in Blob. A random suffix keeps names from colliding. */
export async function putBlobImage(folder: string, name: string, body: Buffer): Promise<string> {
  const res = await put(`images/${folder}/${name}`, body, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000,
  });
  return res.url;
}

/** Move a Blob image under trash/ rather than erasing it, so it can be put back. */
export async function trashBlobImage(src: string): Promise<void> {
  const pathname = new URL(src).pathname.replace(/^\//, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await copy(src, `trash/${stamp}/${pathname}`, { access: "public", addRandomSuffix: false });
  await del(src);
}
