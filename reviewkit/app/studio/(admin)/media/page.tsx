import { MediaGrid } from "@/components/studio/media-grid";
import { PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { listMedia } from "@/lib/media";

export default async function MediaPage() {
  await requireAdmin();
  const items = await listMedia();
  const kb = items.reduce((n, i) => n + i.kb, 0);
  return (
    <>
      <PageHeader
        title="Media library"
        description={`Every image in public/images: ${items.length} files, ${kb} KB in total. Upload images from the post editor; they are compressed automatically. Images no post uses can be removed (they move to content/.trash/).`}
      />
      <MediaGrid items={items} />
    </>
  );
}
