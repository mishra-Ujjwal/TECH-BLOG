import type Anthropic from "@anthropic-ai/sdk";
import { adminGuard } from "@/lib/admin-auth";
import { assistantConfigured, runTurn, type AssistantEvent } from "@/lib/assistant";
import { studioEnabled } from "@/lib/studio";

/**
 * Studio assistant.
 *   GET                 -> { configured: boolean }
 *   POST { messages }   -> newline-delimited JSON events (see AssistantEvent)
 * `messages` is the whole conversation, kept by the browser, ending with the new
 * user message. The assistant only proposes edits; see ./apply for saving one.
 */
export const maxDuration = 300;

export async function GET() {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  return Response.json({ configured: assistantConfigured() });
}

export async function POST(request: Request) {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const denied = await adminGuard();
  if (denied) return denied;
  if (!assistantConfigured()) {
    return Response.json({ error: "Add ANTHROPIC_API_KEY to .env.local and restart npm run dev." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { messages?: Anthropic.Beta.BetaMessageParam[] } | null;
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "expected a conversation ending with your message" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // The browser has gone; runTurn stops through the abort signal.
        }
      };
      await runTurn(messages, emit, request.signal);
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
