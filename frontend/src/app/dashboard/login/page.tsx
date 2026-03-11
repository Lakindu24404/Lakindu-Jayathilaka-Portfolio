import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/dashboard/login/LoginForm";
import { SupabaseSetupNotice } from "@/components/dashboard/ConfigError";
import { getAdminSession } from "@/lib/auth";
import { safeDashboardPath } from "@/lib/safe-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

export default async function DashboardLoginPage(
  props: PageProps<"/dashboard/login">,
) {
  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  if (await getAdminSession()) redirect("/dashboard");

  const { next } = await props.searchParams;
  const target = safeDashboardPath(typeof next === "string" ? next : null);

  return (
    <main
      style={{
        display: "grid",
        minHeight: "100svh",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "min(400px, 100%)" }}>
        <div style={{ marginBottom: 24 }}>
          <p className="dashBrandNote">Portfolio admin</p>
          <h1 className="dashTitle" style={{ marginTop: 6 }}>
            Sign in to the dashboard
          </h1>
          <p className="dashSubtitle">
            Manage the Stack Orbit and the project case studies. Only accounts
            with administrator access can sign in here.
          </p>
        </div>

        <div className="dashPanel">
          <LoginForm next={target ?? undefined} />
        </div>

        <p className="dashHint" style={{ marginTop: 16, textAlign: "center" }}>
          <Link href="/" className="dashNavLink" style={{ display: "inline-flex" }}>
            Back to the portfolio
          </Link>
        </p>
      </div>
    </main>
  );
}
