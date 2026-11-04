import Link from "next/link";
import { DocTable } from "@/components/studio/doc-table";
import { btnPrimary, PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { studioRows, tableOptions } from "../rows";

/** About, contact, policies: the static pages linked from the header and footer. */
export default async function StaticPagesPage() {
  await requireAdmin();
  const rows = studioRows().filter((r) => r.type === "page");
  return (
    <>
      <PageHeader
        title="Static pages"
        description="About us, Contact, How we test, Affiliate disclosure, Privacy policy and Terms. Published pages appear in the header and footer automatically. Keep the privacy policy and terms published: AdSense requires them."
        actions={
          <Link href="/studio/new?type=page" className={btnPrimary}>
            New page
          </Link>
        }
      />
      <div className="rounded-[14px] border border-rule bg-paper p-4 sm:p-6">
        <DocTable rows={rows} {...tableOptions()} />
      </div>
    </>
  );
}
