import { PageHeader } from "@/components/studio/page-header";
import { SettingsForm } from "@/components/studio/settings-form";
import { requireAdmin } from "@/lib/admin-auth";
import { getSite } from "@/lib/site";
import { CONFIG_READ_ONLY_MESSAGE, configEditable } from "@/lib/studio";

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Global settings"
        description={`Site identity, homepage SEO, search engine verification, navigation, social profiles and ads. Saved to content/site.json and applied to every page.${configEditable() ? "" : ` ${CONFIG_READ_ONLY_MESSAGE}`}`}
      />
      <SettingsForm initial={JSON.parse(JSON.stringify(getSite()))} />
    </>
  );
}
