import type { StudioRow } from "@/components/studio/doc-table";
import { listRawDocs, type DocType } from "@/lib/content/store";
import { ARTICLE_FORMATS, FORMAT_LABELS } from "@/lib/content/schema";
import { categoryName, getCategories } from "@/lib/site";
import { publicPath, TYPE_LABELS } from "@/lib/studio";

/** Every document, shaped for the studio tables and the dashboard. */
export async function studioRows(): Promise<(StudioRow & { aiAssisted: boolean; format: string | null })[]> {
  return (await listRawDocs())
    .map((f) => {
      const raw = (f.raw ?? {}) as Record<string, unknown>;
      const type = raw.type as DocType | undefined;
      const slug = String(raw.slug ?? "");
      const status = String(raw.status ?? "draft");
      const format = (raw.format as string | undefined) ?? null;
      const category = (raw.category as string | undefined) ?? null;
      return {
        key: f.sourcePath,
        type: type ?? null,
        kind: type === "article" && format ? `article:${format}` : (type ?? "unknown"),
        category,
        aiAssisted: Boolean((raw.editorial as { aiAssisted?: boolean } | undefined)?.aiAssisted),
        format,
        slug,
        title: String(raw.title ?? f.sourcePath),
        sourcePath: f.sourcePath,
        categoryLabel: category ? categoryName(category) : "",
        typeLabel: `${type ? TYPE_LABELS[type] : "Unknown"}${
          format ? `, ${FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}` : ""
        }`,
        status,
        date: String((raw.dates as { published?: string } | undefined)?.published ?? ""),
        error: Boolean(f.error),
        viewHref: type && slug && status === "published" && !f.error ? publicPath({ type, slug }) : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function tableOptions() {
  return {
    categories: getCategories().map((c) => ({ slug: c.slug, name: c.name })),
    kinds: [
      ...ARTICLE_FORMATS.map((f) => ({ value: `article:${f}`, label: `Article: ${FORMAT_LABELS[f]}` })),
      { value: "review", label: TYPE_LABELS.review },
      { value: "pillar", label: TYPE_LABELS.pillar },
      { value: "page", label: TYPE_LABELS.page },
    ],
  };
}
