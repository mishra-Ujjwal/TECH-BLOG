import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-auth";
import { readRawDoc, type DocType } from "@/lib/content/files";
import { DOC_TYPES, publicPath, saveDoc, studioEnabled, trashDoc } from "@/lib/studio";

/**
 * Change the status of several documents at once from the studio list.
 *
 *   POST { items: [{ type, slug }], status: "published" | "draft" }
 *   POST { items: [{ type, slug }], action: "delete" }
 *
 * Delete moves each file to content/.trash/ (see trashDoc), so it can be restored.
 * Each document goes through saveDoc, the same validation and publishing checks as
 * the editor's Publish button, so a bulk publish cannot skip anything. Documents
 * that fail are reported back and left unchanged.
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  let body: { items?: { type?: string; slug?: string }[]; status?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected JSON" }, { status: 400 });
  }
  const remove = body.action === "delete";
  const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : null;
  if ((!status && !remove) || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "send items and a status of published or draft" }, { status: 400 });
  }

  const done: string[] = [];
  const failed: { slug: string; reason: string }[] = [];

  for (const item of body.items.slice(0, 500)) {
    const type = item.type as DocType;
    const slug = String(item.slug ?? "");
    if (!DOC_TYPES.includes(type) || !slug) {
      failed.push({ slug: slug || "(missing)", reason: "unknown document" });
      continue;
    }
    if (remove) {
      const r = trashDoc(type, slug);
      if (r.ok) {
        done.push(slug);
        revalidatePath(publicPath({ type, slug }));
      }
      else failed.push({ slug, reason: r.reason });
      continue;
    }
    const raw = readRawDoc(type, slug) as Record<string, unknown> | null;
    if (!raw) {
      failed.push({ slug, reason: "file not found" });
      continue;
    }
    if (raw.status === status) {
      done.push(slug);
      continue;
    }
    const result = saveDoc({ ...raw, status }, slug);
    if (result.ok) done.push(slug);
    else failed.push({ slug, reason: result.errors.map((e) => `${e.path ? `${e.path}: ` : ""}${e.message}`).join("; ") });
  }

  if (done.length) {
    for (const p of ["/", "/reviews", "/articles", "/guides", "/categories", "/sitemap.xml"]) revalidatePath(p);
  }
  return Response.json({ done, failed });
}
