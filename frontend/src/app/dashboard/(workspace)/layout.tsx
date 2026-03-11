import { DashboardSidebar, DashboardTopbar } from "@/components/dashboard/Nav";
import { SupabaseSetupNotice } from "@/components/dashboard/ConfigError";
import { SORTABLE_HELP } from "@/components/dashboard/useSortable";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The dashboard is per-session by definition, so it is never prerendered — a
 * baked-in redirect from build time would be wrong for every real visitor.
 */
export const dynamic = "force-dynamic";

/**
 * Guard plus shell for every editing route.
 *
 * `requireAdmin()` runs here so no dashboard page can render without a
 * verified administrator, and it runs again inside each Server Action so a
 * direct POST is refused too.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  const { user } = await requireAdmin();

  return (
    <div className="dashShell">
      <DashboardSidebar email={user.email ?? "administrator"} />
      <div style={{ minWidth: 0 }}>
        <DashboardTopbar />
        <main className="dashMain">{children}</main>
      </div>
      <p id="dash-sortable-help" className="dashSrOnly">
        {SORTABLE_HELP}
      </p>
    </div>
  );
}
