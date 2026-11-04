import { adminGuard } from "@/lib/admin-auth";
import fs from "node:fs";
import path from "node:path";
import sharp, { type OutputInfo } from "sharp";
import { blobEnabled, putBlobImage } from "@/lib/media";
import { studioEnabled } from "@/lib/studio";

/**
 * Store one of your own images and return its address and size: under
 * public/images/<folder>/ on disk, or in Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (see lib/media.ts). Every upload is compressed on the way in: turned upright, resized to at
 * most MAX_WIDTH pixels wide (never enlarged), saved as WebP, and stripped of camera
 * and location data. Animated GIFs stay animated. Up to 20 MB in.
 */
const TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_WIDTH = 1600;
const QUALITY = 80;

const safe = (v: string) =>
  v
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";

export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  const form = await request.formData();
  const file = form.get("file");
  const folder = safe(String(form.get("folder") ?? "uploads"));
  if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });

  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "use PNG, JPEG, WebP, AVIF or GIF" }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "larger than 20 MB" }, { status: 413 });

  // Everything is saved as WebP, usually a fraction of the original size.
  const base = safe(file.name);
  let data: Buffer;
  let info: OutputInfo;
  try {
    ({ data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { animated: ext === ".gif" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    return Response.json({ error: "could not read that image" }, { status: 422 });
  }

  let src: string;
  if (blobEnabled()) {
    try {
      src = await putBlobImage(folder, `${base}.webp`, data);
    } catch (err) {
      return Response.json({ error: `could not store the image: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
    }
  } else {
    const dir = path.join(process.cwd(), "public", "images", folder);
    fs.mkdirSync(dir, { recursive: true });
    let name = `${base}.webp`;
    for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${base}-${n}.webp`;
    fs.writeFileSync(path.join(dir, name), data);
    src = `/images/${folder}/${name}`;
  }

  return Response.json({
    src,
    width: info.width,
    // For an animated image sharp reports the height of all frames stacked.
    height: info.pageHeight ?? info.height,
    bytes: info.size,
    originalBytes: file.size,
  });
}
