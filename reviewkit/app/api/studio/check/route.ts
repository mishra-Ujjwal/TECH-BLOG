import { checkPost } from "@/lib/adsense-check";
import { siblings } from "@/lib/adsense-audit";
import { adminGuard } from "@/lib/admin-auth";
import { studioEnabled } from "@/lib/studio";
import { claudeCheck, claudeConfigured, docToSegments, localCheck } from "@/lib/writing-check";

/**
 * Writing check for one post.
 *   GET            -> { claude: boolean }  whether a Claude key is configured
 *   POST { doc, useClaude } -> { local, adsense, claude?, claudeError? }
 * Advice only: the post is not saved or changed.
 */
export const maxDuration = 120;

export async function GET() {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  return Response.json({ claude: claudeConfigured() });
}

export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;

  const { doc, useClaude } = (await request.json().catch(() => ({}))) as {
    doc?: Record<string, unknown>;
    useClaude?: boolean;
  };
  if (!doc || typeof doc !== "object") return Response.json({ error: "no post sent" }, { status: 400 });

  const segments = docToSegments(doc);
  if (segments.length === 0) {
    return Response.json({ error: "There is no text to check yet." }, { status: 422 });
  }
  const local = localCheck(segments);
  const adsense = checkPost(doc, await siblings());

  if (!useClaude || !claudeConfigured()) return Response.json({ local, adsense });
  try {
    const kind = doc.type === "article" && typeof doc.format === "string" ? `${doc.format} article` : String(doc.type ?? "post");
    const claude = await claudeCheck(segments, { title: typeof doc.title === "string" ? doc.title : undefined, kind });
    return Response.json({ local, adsense, claude });
  } catch (err) {
    return Response.json({ local, adsense, claudeError: err instanceof Error ? err.message : String(err) });
  }
}
