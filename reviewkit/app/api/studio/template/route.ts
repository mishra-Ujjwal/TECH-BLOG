import { adminGuard } from "@/lib/admin-auth";
import type { DocType } from "@/lib/content/files";
import { blankDoc, DOC_TYPES, isArticleFormat, studioEnabled } from "@/lib/studio";

/** A blank, ready-to-fill document: GET ?type=article&format=how-to */
export async function GET(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as DocType;
  if (!DOC_TYPES.includes(type)) return Response.json({ error: "unknown type" }, { status: 400 });
  const format = url.searchParams.get("format");
  return Response.json(blankDoc(type, isArticleFormat(format) ? format : "explainer"));
}
