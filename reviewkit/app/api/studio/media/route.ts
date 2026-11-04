import fs from "node:fs";
import path from "node:path";
import { adminGuard } from "@/lib/admin-auth";
import { studioEnabled } from "@/lib/studio";
import { imageUsage, isBlobUrl, trashBlobImage } from "@/lib/media";

/**
 * Remove an image that no post uses. It is moved, not erased, so it can be put back:
 * to content/.trash/images/ on disk, or under trash/ in the Blob store.
 *   POST { src: "/images/..." | "https://....public.blob.vercel-storage.com/..." }
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  const { src } = (await request.json().catch(() => ({}))) as { src?: string };
  const blob = Boolean(src && isBlobUrl(src));
  if (!src || (!blob && !/^\/images\/[a-z0-9._/-]+$/i.test(src)) || src.includes("..")) {
    return Response.json({ error: "not an image path" }, { status: 400 });
  }
  const users = (await imageUsage()).get(src) ?? [];
  if (users.length) return Response.json({ error: `still used by ${users.join(", ")}` }, { status: 409 });
  if (blob) {
    try {
      await trashBlobImage(src);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
    return Response.json({ ok: true });
  }
  const from = path.join(process.cwd(), "public", src);
  if (!fs.existsSync(from)) return Response.json({ error: "file not found" }, { status: 404 });
  const to = path.join(process.cwd(), "content", ".trash", src);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return Response.json({ ok: true });
}
