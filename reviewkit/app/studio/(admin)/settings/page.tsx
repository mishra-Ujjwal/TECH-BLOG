import { PageHeader } from "@/components/studio/page-header";
import { SettingsForm } from "@/components/studio/settings-form";
import { requireAdmin } from "@/lib/admin-auth";
import { getSite } from "@/lib/site";

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Global settings"
        description="Site identity, homepage SEO, search engine verification, navigation, social profiles and ads. Saved to content/site.json and applied to every page."
      />
      <SettingsForm initial={JSON.parse(JSON.stringify(getSite()))} />
    </>
  );
}
