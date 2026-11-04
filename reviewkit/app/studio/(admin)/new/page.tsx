import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";
import { Editor } from "@/components/studio/editor";
import { FORMAT_LABELS } from "@/lib/content/schema";
import { blankDoc, DOC_TYPES, formSchemaFor, isArticleFormat, TYPE_LABELS } from "@/lib/studio";
import type { DocType } from "@/lib/content/files";
import { PageHeader } from "@/components/studio/page-header";
import { ARTICLE_FORMATS } from "@/lib/content/schema";
import { contentDriver, studioOptions } from "../options";

const NOTES: Record<string, string> = {
  comparison: "Two to four products side by side",
  "how-to": "Numbered steps with screenshots",
  troubleshooting: "A problem and the fixes that worked",
  explainer: "How something works, plainly",
  "news-analysis": "What a launch or change means",
};

/** No type chosen yet: show the choices. */
function Chooser() {
  const options = [
    ...ARTICLE_FORMATS.map((f) => ({ href: `/studio/new?type=article&format=${f}`, label: FORMAT_LABELS[f], note: NOTES[f] })),
    { href: "/studio/new?type=review", label: "Review", note: "One product, tested, with a verdict" },
    { href: "/studio/new?type=pillar", label: "Buying guide", note: "Picks from your own reviews" },
    { href: "/studio/new?type=page", label: "Static page", note: "About, contact, policies" },
    { href: "/studio/import", label: "Import JSON", note: "Paste or upload posts as JSON" },
  ];
  return (
    <>
      <PageHeader title="New post" description="Choose what you are writing. Each one opens a form with exactly the fields that kind of post needs." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <li key={o.href}>
            <Link href={o.href} className="block h-full rounded-[14px] border border-rule bg-paper p-5 hover:border-accent">
              <span className="block font-semibold">{o.label}</span>
              <span className="mt-1 block text-small text-ink-2">{o.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function NewDoc({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; format?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  if (!sp.type) return <Chooser />;
  const type: DocType = DOC_TYPES.includes(sp.type as DocType) ? (sp.type as DocType) : "article";
  const format = isArticleFormat(sp.format) ? sp.format : "explainer";
  const label = type === "article" ? FORMAT_LABELS[format] : TYPE_LABELS[type];

  return (
    <>
      <p className="text-small">
        <Link href="/studio/new" className="link">
          New post
        </Link>
      </p>
      <h1 className="mt-2 text-h1 font-bold tracking-[-0.025em]">New {label.toLowerCase()}</h1>
      <div className="mt-6">
        <Editor
          schema={formSchemaFor(type) as never}
          initial={blankDoc(type, format)}
          options={await studioOptions()}
          typeLabel={TYPE_LABELS[type]}
          driver={contentDriver()}
        />
      </div>
    </>
  );
}
