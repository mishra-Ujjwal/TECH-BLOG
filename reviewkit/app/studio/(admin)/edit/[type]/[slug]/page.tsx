import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Editor } from "@/components/studio/editor";
import { readRawDoc, type DocType } from "@/lib/content/store";
import { DOC_TYPES, formSchemaFor, publicPath, TYPE_LABELS } from "@/lib/studio";
import { contentDriver, studioOptions } from "../../../options";

export default async function EditDoc({ params }: { params: Promise<{ type: string; slug: string }> }) {
  await requireAdmin();
  const { type, slug } = await params;
  if (!DOC_TYPES.includes(type as DocType)) notFound();
  const raw = (await readRawDoc(type as DocType, slug)) as Record<string, unknown> | null;
  if (!raw) notFound();

  return (
    <>
      <p className="text-small">
        <Link href={type === "page" ? "/studio/pages" : "/studio/posts"} className="link">
          {type === "page" ? "Static pages" : "All posts"}
        </Link>
        {raw.status === "published" && (
          <>
            {", "}
            <Link href={publicPath({ type: type as DocType, slug })} className="link" target="_blank">
              view on site
            </Link>
          </>
        )}
        {", "}
        <Link href={`/studio/assistant?post=${type}/${slug}`} className="link">
          ask the assistant about this {type === "page" ? "page" : "post"}
        </Link>
      </p>
      <h1 className="mt-2 text-h1 font-bold tracking-[-0.025em]">{String(raw.title || "Untitled")}</h1>
      <div className="mt-6">
        <Editor
          key={slug}
          schema={formSchemaFor(type as DocType) as never}
          initial={raw}
          originalSlug={slug}
          options={await studioOptions()}
          typeLabel={TYPE_LABELS[type as DocType]}
          driver={contentDriver()}
        />
      </div>
    </>
  );
}
