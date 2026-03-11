import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end configuration for the dashboard QA suite.
 *
 * The suite runs against a production build (`next build && next start`) rather
 * than `next dev`, because the caching and revalidation behaviour it asserts on
 * only exists in a production server. Set `QA_APP_ORIGIN` to point at a server
 * you are already running instead.
 */
const port = Number(process.env.QA_PORT ?? 3100);
const baseURL = process.env.QA_APP_ORIGIN ?? `http://localhost:${port}`;

/** Admin-only credentials, which belong to the suites and not to the server. */
const ADMIN_ONLY_VARS = ["SUPABASE_SERVICE_ROLE_KEY", "SEED_ADMIN_EMAIL"];

/** This process's environment with those removed. */
function serverEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || ADMIN_ONLY_VARS.includes(name)) continue;
    env[name] = value;
  }
  return env;
}

export default defineConfig({
  testDir: "./tests/e2e",
  // The suite mutates shared database rows, so it runs in one worker in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.QA_APP_ORIGIN
    ? undefined
    : {
        command: `npx next start --port ${port}`,
        url: baseURL,
        // `npm run test:e2e` loads ../backend/.env.local so the fixtures can
        // create a throwaway administrator. The server under test must not
        // inherit that: SUPABASE_SERVICE_ROLE_KEY bypasses row level security,
        // and the application never reads it. It runs on frontend/.env.local,
        // which `next start` loads for itself.
        env: serverEnv(),
        // A stale server would silently serve the previous build and make a
        // fixed bug still look broken. Opt in explicitly when iterating.
        reuseExistingServer: Boolean(process.env.QA_REUSE_SERVER),
        timeout: 120_000,
      },
});
