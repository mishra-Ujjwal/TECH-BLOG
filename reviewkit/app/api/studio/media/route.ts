import fs from "node:fs";
import path from "node:path";
import { adminGuard } from "@/lib/admin-auth";
import { studioEnabled } from "@/lib/studio";
import { imageUsage } from "@/lib/media";

/**
 * Remove an image that no post uses. It is moved to content/.trash/images/, not
 * erased, so it can be put back.
 *   POST { src: "/images/..." }
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  const { src } = (await request.json().catch(() => ({}))) as { src?: string };
  if (!src || !/^\/images\/[a-z0-9._/-]+$/i.test(src) || src.includes("..")) {
    return Response.json({ error: "not an image path" }, { status: 400 });
  }
  const users = imageUsage().get(src) ?? [];
  if (users.length) return Response.json({ error: `still used by ${users.join(", ")}` }, { status: 409 });
  const from = path.join(process.cwd(), "public", src);
  if (!fs.existsSync(from)) return Response.json({ error: "file not found" }, { status: 404 });
  const to = path.join(process.cwd(), "content", ".trash", src);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return Response.json({ ok: true });
}
