import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-auth";
import { docExists, type DocType } from "@/lib/content/store";
import { DOC_TYPES, publicPath, saveDoc, studioEnabled } from "@/lib/studio";
import { getCategories } from "@/lib/site";
import { plain, slugify } from "@/lib/studio-shared";

/**
 * Add posts from JSON: the same documents the form produces, checked by the same
 * saveDoc as the form's Save and Publish buttons.
 *
 *   POST {
 *     docs: [ {...}, {...} ],
 *     status: "keep" | "draft" | "published",   // keep = use each file's own status
 *     overwrite: boolean                         // replace a post with the same slug
 *   }
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  let body: { docs?: unknown[]; status?: string; overwrite?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.docs) || body.docs.length === 0) {
    return Response.json({ error: "no posts found in the JSON" }, { status: 400 });
  }

  const saved: { slug: string; type: string; status: string; url: string | null; warnings: string[] }[] = [];
  const failed: { index: number; slug: string; errors: string[] }[] = [];

  for (const [index, input] of body.docs.slice(0, 500).entries()) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      failed.push({ index, slug: "", errors: ["not a JSON object"] });
      continue;
    }
    const doc = { ...(input as Record<string, unknown>) };
    if (body.status === "draft" || body.status === "published") doc.status = body.status;
    if (doc.schemaVersion === undefined) doc.schemaVersion = 1;
    if (doc.status === undefined) doc.status = "draft";

    const type = doc.type as DocType;
    const slug = typeof doc.slug === "string" ? doc.slug : "";
    const exists = DOC_TYPES.includes(type) && slug !== "" && (await docExists(type, slug));
    if (exists && !body.overwrite) {
      failed.push({ index, slug, errors: [`a ${type} called "${slug}" already exists; tick "Replace existing" to update it`] });
      continue;
    }

    const moved = fixCategory(doc);

    const r = await saveDoc(doc, exists ? slug : undefined);
    if (r.ok) {
      saved.push({
        slug: r.doc.slug,
        type: r.doc.type,
        status: r.doc.status,
        url: r.url,
        warnings: [...(moved ? [moved] : []), ...r.warnings.map((w) => `${w.path}: ${w.message}`)],
      });
      revalidatePath(publicPath(r.doc));
    } else {
      failed.push({ index, slug, errors: r.errors.map((e) => `${e.path || "document"}: ${plain(e.message)}`) });
    }
  }

  if (saved.length) {
    for (const p of ["/", "/reviews", "/articles", "/guides", "/categories", "/sitemap.xml"]) revalidatePath(p);
  }
  return Response.json({ saved, failed });
}

const FILLER = new Set(["and", "the", "of", "for", "with", "to", "in", "a", "home", "budget", "mid", "range", "accessories", "storage"]);
/** Lower-case words with a plural "s" dropped, so "phones" and "phone" agree. */
const words = (v: string) =>
  slugify(v)
    .split("-")
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * Imported JSON often names a brand, model or topic ("samsung-galaxy", "nothing-phone",
 * "laptops") where a category slug belongs. File it under the category whose name,
 * brands and topics share the most words with it, and say so. A tie or no overlap is
 * left for saveDoc to reject, so nothing lands in a guessed category silently.
 */
function fixCategory(doc: Record<string, unknown>): string | null {
  if (typeof doc.category !== "string") return null;
  const categories = getCategories();
  if (categories.some((c) => c.slug === doc.category)) return null;
  const given = new Set(words(doc.category));
  const scored = categories
    .map((c) => {
      const keys = new Set([c.slug, c.name, ...c.brands, ...c.topics].flatMap(words));
      return { c, score: [...given].filter((w) => keys.has(w)).length };
    })
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.score === 0 || (next && next.score === best.score)) return null;
  const from = doc.category;
  doc.category = best.c.slug;
  return `category: "${from}" is not a category, so the post was filed under ${best.c.name}`;
}
