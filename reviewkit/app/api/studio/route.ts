import { adminGuard } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { publicPath, saveDoc, studioEnabled } from "@/lib/studio";

/**
 * Save one document from /studio into content/. Validation is the same contract
 * `npm run content:validate` uses, so a file saved here passes there.
 *
 *   POST { doc, originalSlug? }   originalSlug renames the file when the slug changed
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  let body: { doc?: unknown; originalSlug?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, errors: [{ path: "", message: "expected JSON" }] }, { status: 400 });
  }

  const result = await saveDoc(body.doc, body.originalSlug || undefined);
  if (!result.ok) return Response.json(result, { status: 422 });

  // Refresh every page that can list this document.
  for (const p of ["/", "/reviews", "/articles", "/guides", "/categories", "/sitemap.xml"]) {
    revalidatePath(p);
  }
  if ("category" in result.doc) revalidatePath(`/categories/${result.doc.category}`);
  revalidatePath(publicPath(result.doc));
  revalidatePath(`/authors/${result.doc.author.slug}`);

  return Response.json(result);
}
