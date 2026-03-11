"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Anything the repository throws that is not a validation problem lands here:
 * a dropped database connection, a revoked key, a policy change.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="dashPanel" role="alert">
      <h1 className="dashPanelTitle">That did not load</h1>
      <p className="dashPanelNote">
        {error.message ||
          "The dashboard could not reach its data. Check the Supabase project is running and your environment variables are set."}
      </p>
      <div className="dashHeaderActions">
        <button type="button" className="dashButton dashButtonPrimary" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="dashButton dashButtonGhost">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
