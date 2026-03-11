import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Shown instead of the dashboard when the Supabase environment variables are
 * missing. The public portfolio keeps working from bundled content in that
 * state, so this is a setup prompt rather than a failure.
 */
export function SupabaseSetupNotice() {
  const result = readSupabaseConfig();
  const missing = result.ok ? [] : result.missing;

  return (
    <main className="dashMain" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="dashHeader">
        <div>
          <h1 className="dashTitle">Connect Supabase to continue</h1>
          <p className="dashSubtitle">
            The dashboard stores content in Supabase. Until it is configured the
            portfolio renders the bundled content in{" "}
            <code>src/content/portfolio-seed.ts</code>, and this page stands in
            for the editor.
          </p>
        </div>
      </div>

      <div className="dashNotice dashNoticeWarn" role="alert">
        <strong>
          Missing environment variable{missing.length === 1 ? "" : "s"}:
        </strong>{" "}
        {missing.length > 0 ? missing.join(", ") : "Supabase configuration"}
      </div>

      <div className="dashPanel" style={{ marginTop: 16 }}>
        <h2 className="dashPanelTitle">Set it up</h2>
        <ol className="dashPanelNote" style={{ paddingLeft: 18, lineHeight: 1.9 }}>
          <li>
            Create a project at <strong>supabase.com</strong>.
          </li>
          <li>
            Run the three files in <code>supabase/migrations</code> in the
            Supabase SQL editor, in order.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in
            the project URL, the anon key and the service-role key.
          </li>
          <li>
            Create your admin user under Authentication → Users, set{" "}
            <code>SEED_ADMIN_EMAIL</code>, then run <code>npm run seed</code>.
          </li>
          <li>Restart the dev server and reload this page.</li>
        </ol>
        <p className="dashPanelNote" style={{ marginBottom: 0 }}>
          The full walkthrough is in <code>backend/README.md</code>.
        </p>
      </div>
    </main>
  );
}
