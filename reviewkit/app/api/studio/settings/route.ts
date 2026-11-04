import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { adminGuard } from "@/lib/admin-auth";
import { siteSchema } from "@/lib/content/schema";
import { CONFIG_READ_ONLY_MESSAGE, configEditable, studioEnabled } from "@/lib/studio";
import { clean, plain } from "@/lib/studio-shared";

/**
 * Save content/site.json from the Global settings page. The whole file is checked
 * against the same schema the site uses, so a bad value is refused rather than
 * breaking every page.
 */
export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  if (!configEditable()) {
    return Response.json({ ok: false, errors: [{ path: "", message: CONFIG_READ_ONLY_MESSAGE }] }, { status: 409 });
  }

  let body: { site?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, errors: [{ path: "", message: "expected JSON" }] }, { status: 400 });
  }

  const parsed = siteSchema.safeParse(clean(body.site));
  if (!parsed.success) {
    return Response.json(
      { ok: false, errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: plain(i.message) })) },
      { status: 422 },
    );
  }

  const file = path.join(process.cwd(), "content", "site.json");
  fs.writeFileSync(file, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
  // Every page shows the name, header and footer, so refresh them all.
  revalidatePath("/", "layout");
  return Response.json({ ok: true, site: parsed.data });
}
