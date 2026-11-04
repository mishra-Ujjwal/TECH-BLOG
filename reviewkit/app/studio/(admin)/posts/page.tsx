import Link from "next/link";
import { DocTable } from "@/components/studio/doc-table";
import { btnPrimary, btnSecondary, PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { contentDriver } from "@/lib/content";
import { studioRows, tableOptions } from "../rows";

/** Every post in content/, with filters and bulk actions. */
export default async function PostsPage() {
  await requireAdmin();
  const rows = (await studioRows()).filter((r) => r.type !== "page");
  return (
    <>
      <PageHeader
        title="All posts"
        description="Articles, reviews and buying guides, drafts included. Filter, select and publish, unpublish, download or delete in bulk."
        actions={
          <>
            <Link href="/studio/import" className={btnSecondary}>
              Import JSON
            </Link>
            <Link href="/studio/new" className={btnPrimary}>
              New post
            </Link>
          </>
        }
      />
      {contentDriver() === "neon" && (
        <p className="mb-4 text-small text-ink-3">
          Posts are saved to the live database. Run <code>npm run content:pull</code> on your computer to copy them
          into content/ for git.
        </p>
      )}
      <div className="rounded-[14px] border border-rule bg-paper p-4 sm:p-6">
        <DocTable rows={rows} {...tableOptions()} />
      </div>
    </>
  );
}
