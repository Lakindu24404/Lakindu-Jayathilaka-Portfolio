/**
 * One self-contained QA run: build the app, serve that build once, point both
 * HTTP suites at it, then check the artifact it leaves behind.
 *
 *   npm run qa
 *
 * Written as a Node script rather than a shell one-liner so it behaves the same
 * on Windows, macOS and CI: no `&`, no `wait`, no `kill $!`. The server is a
 * direct child of this process and is always torn down — after a passing run, a
 * failing suite, or a Ctrl-C.
 *
 * Exporting `QA_APP_ORIGIN` also switches Playwright's own `webServer` off (see
 * `playwright.config.ts`), so exactly one Next.js server exists for the run
 * rather than a second one racing for the port.
 *
 * The build artifact is checked twice: once after the build, and once after the
 * server has stopped. The second check is fatal. `next start` rewrites
 * prerendered HTML when a Server Action revalidates a path, and that write-back
 * has been observed leaving the output pointing at CSS chunks the build never
 * emitted — pages then render with no stylesheet at all. This gate detects and
 * refuses that artifact; it does not fix whatever produces it.
 *
 * Flags: `--skip-build` reuses the existing `.next` for a faster loop.
 * Env: `QA_PORT` pins the port; otherwise the first free port from 3100 is used.
 */
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  finalizeRun,
  findMissingCssChunks,
  missingChunkMessage,
} from "../tests/tools/build-integrity.mts";
import {
  runToCompletion,
  startBackground,
  terminate,
  waitForHttp,
} from "../tests/tools/process-runner.mts";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(
  projectRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

const skipBuild = process.argv.includes("--skip-build");

function step(message) {
  console.log(`\n▶ ${message}`);
}

/**
 * Run a Node child to completion.
 *
 * `process.execPath` rather than `npm`/`npx`: no shell is involved, so there is
 * no intermediate cmd.exe to lose the exit code or leave a process behind.
 */
/**
 * Environment variables that must never reach the application under test.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` bypasses row level security. The suites need an
 * admin client, so they load `../backend/.env.local` in their own process; the
 * Next.js server is started without it, and the app never reads it anyway.
 * Stripping it here means an exported shell value cannot leak into the server
 * either.
 */
const ADMIN_ONLY_VARS = ["SUPABASE_SERVICE_ROLE_KEY", "SEED_ADMIN_EMAIL"];

/** `process.env` with the admin credentials removed. */
function envWithoutAdminSecrets() {
  const env = { ...process.env };
  for (const name of ADMIN_ONLY_VARS) delete env[name];
  return env;
}

function runNode(label, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  // The aggregate run is always strict, whatever the developer has exported.
  delete env.QA_API_ALLOW_SKIP;

  return runToCompletion(label, process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });
}

/** True when nothing is already listening on `port`. */
function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

async function choosePort() {
  const configured = process.env.QA_PORT?.trim();
  if (configured) {
    const port = Number(configured);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`QA_PORT is not a valid port: ${configured}`);
    }
    // A pinned port is honoured strictly: silently moving would run the suites
    // against whatever else is already on it.
    if (!(await isFree(port))) {
      throw new Error(`QA_PORT ${port} is already in use`);
    }
    return port;
  }

  for (let port = 3100; port < 3130; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error("no free port available between 3100 and 3129");
}

/** @type {import("../tests/tools/process-runner.mts").Background | null} */
let server = null;
let interrupted = false;
/** Set once the build has been shown to be self-consistent. */
let buildVerified = false;
/** @type {Error | null} */
let failure = null;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (interrupted) return;
    interrupted = true;
    console.log(`\nReceived ${signal} — stopping the server.`);
    void terminate(server?.child, { label: "the production server" })
      .catch((error) => {
        console.error(`  could not stop the server: ${error.message}`);
      })
      .finally(() => process.exit(130));
  });
}

try {
  if (skipBuild) {
    step("Skipping the build (--skip-build)");
  } else {
    // A rebuild over a previous `.next` has produced output that served 500s at
    // runtime, which shows up as a mystery layout failure rather than a build
    // error. The aggregate run starts clean.
    step("Building the production app (clean .next)");
    await rm(path.join(projectRoot, ".next"), { recursive: true, force: true });
    await runNode("next build", [nextBin, "build"]);
  }

  step("Checking the build's stylesheets resolve");
  const missingAfterBuild = await findMissingCssChunks(projectRoot);
  if (missingAfterBuild.size > 0) {
    throw new Error(
      `${missingChunkMessage(missingAfterBuild)}\n` +
        "Delete .next and rebuild; if it recurs, the build output is not reproducible.",
    );
  }
  buildVerified = true;
  console.log("  every referenced CSS chunk is present");

  const port = await choosePort();
  const origin = `http://127.0.0.1:${port}`;

  step(`Starting the production server on ${origin}`);
  // Spawn failures and a premature exit both arrive through `whenFailed`, which
  // `waitForHttp` races — nothing throws from an event callback, so this stays
  // inside the try/catch below.
  server = startBackground(
    "the production server",
    process.execPath,
    [nextBin, "start", "--port", String(port), "--hostname", "127.0.0.1"],
    { cwd: projectRoot, stdio: "inherit", env: envWithoutAdminSecrets() },
  );

  await waitForHttp(server, origin);
  console.log(`  ready at ${origin}`);

  step("API integration suite (strict)");
  await runNode(
    "API integration suite",
    [
      "--env-file-if-exists=../backend/.env.local",
      "--env-file-if-exists=.env.local",
      "--import",
      "./tests/helpers/alias.mjs",
      "--test",
      "tests/api/*.test.mts",
    ],
    { QA_APP_ORIGIN: origin },
  );

  step("Playwright E2E suite");
  await runNode(
    "Playwright E2E suite",
    [
      "--env-file-if-exists=../backend/.env.local",
      "--env-file-if-exists=.env.local",
      playwrightCli,
      "test",
    ],
    { QA_APP_ORIGIN: origin },
  );
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
}

// Always reached: the catch above swallows every failure so teardown and the
// post-run integrity check cannot be skipped. `finalizeRun` stops the server
// first and only then judges the artifact, so nothing can still be rewriting
// `.next` while it is being measured.
failure = await finalizeRun({
  failure,
  interrupted,
  buildVerified,
  stopServer: () => terminate(server?.child, { label: "the production server" }),
  findDrift: () => findMissingCssChunks(projectRoot),
  onStep: step,
});

if (failure) {
  console.error(`\n✗ QA run failed: ${failure.message}`);
  process.exit(1);
}

console.log(
  "\n✓ QA run complete: build, API and E2E passed, and the build artifact is still intact.",
);
