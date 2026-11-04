import { AssistantChat } from "@/components/studio/assistant-chat";
import { PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { assistantConfigured } from "@/lib/assistant";
import { readRawDoc, type DocType } from "@/lib/content/store";
import { DOC_TYPES } from "@/lib/studio";

/**
 * The studio assistant: a chat with Claude about the site's content. With
 * ?post=<type>/<slug> it starts focused on one post (the editor links here).
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  await requireAdmin();
  const { post } = await searchParams;

  let focus: { type: string; slug: string; title: string } | undefined;
  const [type, slug] = (post ?? "").split("/");
  if (type && slug && DOC_TYPES.includes(type as DocType)) {
    const raw = (await readRawDoc(type as DocType, slug)) as Record<string, unknown> | null;
    if (raw) focus = { type, slug, title: String(raw.title ?? slug) };
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Ask Claude what is wrong with your content and how to fix it. It reads your posts and runs the AdSense checks; every edit it suggests waits for you to apply it."
      />
      {/* A new key per focus, so moving between posts starts a fresh chat view. */}
      <AssistantChat key={focus ? `${focus.type}/${focus.slug}` : "site"} configured={assistantConfigured()} focus={focus} />
    </>
  );
}
