import { revalidatePath } from "next/cache";

/**
 * Refresh cached pages after an import, without a redeploy.
 *
 *   curl -X POST "$SITE/api/revalidate" \
 *     -H "content-type: application/json" \
 *     -d '{"secret":"...","paths":["/","/reviews/notely-3-review"]}'
 *
 * Omit `paths` to refresh the listings and the home page.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "REVALIDATE_SECRET is not set" }, { status: 500 });
  }

  let body: { secret?: string; paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (body.secret !== secret) {
    return Response.json({ error: "bad secret" }, { status: 401 });
  }

  const paths =
    body.paths && body.paths.length > 0
      ? body.paths
      : ["/", "/reviews", "/guides", "/categories"];

  for (const path of paths) revalidatePath(path);

  return Response.json({ revalidated: paths, at: new Date().toISOString() });
}
