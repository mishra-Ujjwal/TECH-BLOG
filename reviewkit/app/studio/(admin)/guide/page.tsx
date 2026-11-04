import { PageHeader } from "@/components/studio/page-header";
import { StudioGuide } from "@/components/studio/guide";
import { requireAdmin } from "@/lib/admin-auth";

export default async function GuidePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Writing guide" description="What goes in each part of a post, how to post with JSON, and what each kind of post needs before it can be published." />
      <div className="rounded-[14px] border border-rule bg-paper">
        <StudioGuide open />
      </div>
    </>
  );
}
