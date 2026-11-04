import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-auth";
import { previewEdit } from "@/lib/assistant";
import { publicPath, saveDoc, studioEnabled } from "@/lib/studio";

/**
 * Apply one edit the assistant proposed and the editor approved.
 *   POST { type, slug, path, oldText, newText } -> { ok, url } or { ok: false, error }
 * The edit is re-checked against the file as it is now, then saved through saveDoc,
 * so the same validation runs as for the editor's Save. Status never changes.
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fields = ["type", "slug", "path", "oldText", "newText"] as const;
  if (!body || fields.some((f) => typeof body[f] !== "string")) {
    return Response.json({ ok: false, error: "incomplete edit" }, { status: 400 });
  }
  const edit = { type: String(body.type), slug: String(body.slug), path: String(body.path), oldText: String(body.oldText), newText: String(body.newText) };

  const check = previewEdit(edit);
  if (!check.ok) return Response.json({ ok: false, error: check.reason }, { status: 409 });

  const result = saveDoc(check.doc, edit.slug);
  if (!result.ok) {
    const first = result.errors[0];
    return Response.json({ ok: false, error: first ? `${first.path}: ${first.message}` : "could not save" }, { status: 422 });
  }

  for (const p of ["/", "/reviews", "/articles", "/guides", "/categories", "/sitemap.xml"]) revalidatePath(p);
  if ("category" in result.doc) revalidatePath(`/categories/${result.doc.category}`);
  revalidatePath(publicPath(result.doc));

  return Response.json({ ok: true, url: result.url, warnings: result.warnings });
}
