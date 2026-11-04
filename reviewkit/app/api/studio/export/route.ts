import { adminGuard } from "@/lib/admin-auth";
import { listRawDocs, readRawDoc, type DocType } from "@/lib/content/store";
import { DOC_TYPES, studioEnabled } from "@/lib/studio";

/**
 * Posts as JSON, in the shape the import page accepts.
 *   POST { items: [{ type, slug }] }   selected posts
 *   POST { all: true }                 every post
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { items?: { type?: string; slug?: string }[]; all?: boolean };
  const docs = body.all
    ? (await listRawDocs()).map((f) => f.raw).filter(Boolean)
    : (
        await Promise.all(
          (body.items ?? [])
            .filter((i) => DOC_TYPES.includes(i.type as DocType) && i.slug)
            .map((i) => readRawDoc(i.type as DocType, String(i.slug))),
        )
      ).filter(Boolean);
  return Response.json({ docs });
}
