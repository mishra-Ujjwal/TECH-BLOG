import { AdminShell } from "@/components/studio/admin-shell";
import { requireAdmin } from "@/lib/admin-auth";
import { getSite } from "@/lib/site";
import { logout } from "../actions";

/**
 * Everything in the studio except the login page, inside the admin panel frame.
 * Each page also calls requireAdmin() itself, because a layout is not re-run on
 * every client-side navigation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <AdminShell siteName={getSite().shortName ?? getSite().name} logout={logout}>
      {children}
    </AdminShell>
  );
}
