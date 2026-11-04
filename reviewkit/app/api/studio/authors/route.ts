import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-auth";
import { loadAllDocs } from "@/lib/content/files";
import { authorsFileSchema } from "@/lib/content/schema";
import { studioEnabled } from "@/lib/studio";
import { clean, plain } from "@/lib/studio-shared";

/**
 * Save content/authors.json. Refuses to drop a profile that posts still use, so a
 * byline never points at an author who no longer exists.
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { file?: unknown };
  const parsed = authorsFileSchema.safeParse(clean(body.file));
  if (!parsed.success) {
    return Response.json(
      { ok: false, errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: plain(i.message) })) },
      { status: 422 },
    );
  }

  const slugs = new Set(parsed.data.authors.map((a) => a.slug));
  if (slugs.size !== parsed.data.authors.length) {
    return Response.json({ ok: false, errors: [{ path: "", message: "two profiles have the same slug" }] }, { status: 422 });
  }
  const orphaned = new Set(
    loadAllDocs()
      .map((l) => l.doc)
      .filter((d) => d.type !== "page" && !slugs.has(d.author.slug))
      .map((d) => d.author.slug),
  );
  if (orphaned.size) {
    return Response.json(
      { ok: false, errors: [{ path: "", message: `posts still use ${[...orphaned].join(", ")}; keep that profile or move the posts first` }] },
      { status: 422 },
    );
  }

  fs.writeFileSync(path.join(process.cwd(), "content", "authors.json"), `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
