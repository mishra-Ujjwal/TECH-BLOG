import { PageHeader } from "@/components/studio/page-header";
import { JsonImport } from "@/components/studio/json-import";
import { requireAdmin } from "@/lib/admin-auth";

/** Add posts as JSON, the same documents the form produces. */
export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Import JSON"
        description="Anything you can write with the form, you can add here as JSON: one post or many at once."
      />
      <div>
        <JsonImport />
      </div>
    </>
  );
}
