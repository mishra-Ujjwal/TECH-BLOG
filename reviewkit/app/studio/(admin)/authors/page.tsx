import fs from "node:fs";
import path from "node:path";
import { AuthorsForm } from "@/components/studio/authors-form";
import { PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { loadAllDocs } from "@/lib/content/files";
import { authorsFileSchema } from "@/lib/content/schema";

export default async function AuthorsPage() {
  await requireAdmin();
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "authors.json"), "utf8"));
  const file = authorsFileSchema.parse(raw);
  const usage: Record<string, number> = {};
  for (const { doc } of loadAllDocs()) if (doc.type !== "page") usage[doc.author.slug] = (usage[doc.author.slug] ?? 0) + 1;
  return (
    <>
      <PageHeader
        title="Authors"
        description="The profiles behind every byline and author page. A named, credible author is one of the strongest trust signals for readers and for AdSense."
      />
      <AuthorsForm initial={JSON.parse(JSON.stringify(file))} usage={usage} />
    </>
  );
}
