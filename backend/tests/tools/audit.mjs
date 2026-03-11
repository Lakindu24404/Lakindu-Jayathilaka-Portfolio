/**
 * Read-only inventory of the Supabase project behind the portfolio.
 *
 *   node --env-file=.env.local tests/tools/audit.mjs
 *
 * Prints the seeded content, the admin roster and both storage buckets, and
 * reports anything carrying the `qa-<timestamp>-` prefix a QA run leaves.
 *
 * Exit codes: 0 clean, 1 the audit failed or found leftovers, 2 the
 * environment is not configured. A failed request is never reported as an
 * empty, clean result — see `audit-core.mts`, which holds that logic so it can
 * be unit tested.
 *
 * Nothing here writes, so it is safe against production.
 */
import { createClient } from "@supabase/supabase-js";
import { projectSeed, stackSeed } from "../../../frontend/src/content/portfolio-seed.ts";
import {
  auditProblems,
  collectAudit,
  formatAudit,
  redact,
} from "./audit-core.mts";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `✗ ${name} is not set. Run this with --env-file=.env.local, or export it first.`,
    );
    process.exit(2);
  }
  return value;
}

const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

// The project host is public (it ships in the browser bundle); the key is not
// and is never printed.
let host = "the configured project";
try {
  host = new URL(url).host;
} catch {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  process.exit(2);
}

const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Auditing ${host} (read-only)\n`);

let report;
try {
  report = await collectAudit(db, {
    expected: {
      technologies: stackSeed.length,
      projects: projectSeed.length,
    },
  });
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`✗ Audit could not complete — ${redact(detail)}`);
  console.error(
    "  Nothing was verified. Do not read this as an empty or clean database.",
  );
  process.exit(1);
}

for (const line of formatAudit(report)) console.log(line);

const problems = auditProblems(report);
if (problems.length > 0) {
  console.error(`\n✗ Audit found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("\n✓ Seeded content intact, no QA leftovers.");
