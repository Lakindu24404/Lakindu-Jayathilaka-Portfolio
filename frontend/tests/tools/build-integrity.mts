/**
 * Build-artifact integrity for the QA orchestrator.
 *
 * A build whose server output references a CSS chunk that is not in
 * `.next/static/chunks` serves pages with no stylesheet: the browser 404s the
 * chunk and every rule silently disappears. In the E2E suite that surfaces as
 * an unrelated-looking assertion ("expected 48s, received 0s" on an orbit
 * rotor), so it is named directly here instead of being re-diagnosed from a
 * screenshot each time.
 *
 * This detects and contains a broken artifact. It does not fix whatever
 * produces one — see the QA notes in `scripts/qa.mjs`.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Chunk file name -> the output files that reference it. */
export type MissingChunks = Map<string, string[]>;

/** Output files worth scanning for chunk references. */
const SCANNED = /\.(html|rsc|json|js)$/;

const CHUNK_REFERENCE = /static\/chunks\/([A-Za-z0-9_-]+\.css)/g;

/**
 * CSS chunks the server output points at but the build never emitted.
 *
 * `root` is the project directory holding `.next`. An absent build is reported
 * as "nothing missing" rather than as a failure: the caller decides whether a
 * build was expected.
 */
export async function findMissingCssChunks(
  root: string,
): Promise<MissingChunks> {
  const chunkDir = path.join(root, ".next", "static", "chunks");

  let emitted: Set<string>;
  try {
    emitted = new Set(
      (await readdir(chunkDir)).filter((name) => name.endsWith(".css")),
    );
  } catch {
    return new Map();
  }

  const missing: MissingChunks = new Map();

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // The Turbopack cache legitimately holds chunk names from earlier
        // builds; scanning it would report drift that no page can serve.
        if (entry.name !== "cache") await walk(full);
        continue;
      }
      if (!SCANNED.test(entry.name)) continue;

      let source: string;
      try {
        source = await readFile(full, "utf8");
      } catch {
        continue;
      }

      for (const match of source.matchAll(CHUNK_REFERENCE)) {
        const chunk = match[1];
        if (emitted.has(chunk)) continue;
        const referencedBy = missing.get(chunk) ?? [];
        const relative = path.relative(root, full);
        if (!referencedBy.includes(relative)) referencedBy.push(relative);
        missing.set(chunk, referencedBy);
      }
    }
  }

  await walk(path.join(root, ".next", "server"));
  return missing;
}

/** Names every missing chunk and the files that reference it. */
export function describeMissingChunks(missing: MissingChunks): string {
  return [...missing.entries()]
    .map(([chunk, files]) => {
      const shown = files.slice(0, 3);
      const extra =
        files.length > shown.length
          ? `\n    (+${files.length - shown.length} more file(s))`
          : "";
      return `  ${chunk}\n${shown
        .map((file) => `    referenced by ${file}`)
        .join("\n")}${extra}`;
    })
    .join("\n");
}

/** Message for a build that was already broken when it came out of the build. */
export function missingChunkMessage(missing: MissingChunks): string {
  return (
    `the build references ${missing.size} CSS chunk(s) it did not emit, so pages would render unstyled:\n` +
    describeMissingChunks(missing)
  );
}

/** Message for a build that was intact before the run and is not after it. */
export function driftMessage(missing: MissingChunks): string {
  return (
    `the build output drifted during the run — ${missing.size} CSS chunk(s) are referenced but absent from .next/static/chunks:\n` +
    describeMissingChunks(missing) +
    "\nPages rendered after that point would have loaded without styles."
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Add a reason without losing the one already recorded.
 *
 * The first failure is the one that explains the run, so it stays at the top of
 * the message and is kept as `cause`; drift is appended as extra evidence.
 */
export function appendReason(failure: Error | null, reason: string): Error {
  if (!failure) return new Error(reason);
  // Reasons can stack (teardown failed, so the artifact was not measured).
  // `cause` keeps pointing at the failure that started it rather than at the
  // previous wrapper, so the root reason stays one hop away however many
  // reasons are appended.
  const root = failure.cause instanceof Error ? failure.cause : failure;
  return new Error(`${failure.message}\n\nAdditionally, ${reason}`, {
    cause: root,
  });
}

export type FinalizeOptions = {
  /** The failure the run already recorded, if any. */
  failure: Error | null;
  interrupted: boolean;
  /** Whether the post-build check confirmed a consistent artifact. */
  buildVerified: boolean;
  stopServer: () => Promise<void>;
  findDrift: () => Promise<MissingChunks>;
  onStep?: (message: string) => void;
};

/**
 * Shut the server down, then judge the artifact it leaves behind.
 *
 * Order matters and is the point of this function: the drift check is only
 * meaningful once nothing is still running that could rewrite `.next`, because
 * `next start` rewrites prerendered HTML whenever a Server Action revalidates a
 * path. Returns the failure the command should exit with, or `null`.
 */
export async function finalizeRun(
  options: FinalizeOptions,
): Promise<Error | null> {
  let failure = options.failure;
  let shutdownConfirmed = true;

  if (!options.interrupted) {
    options.onStep?.("Stopping the server");
    try {
      await options.stopServer();
    } catch (error) {
      shutdownConfirmed = false;
      const teardown = toError(error);
      // Both failures matter: the suite's exit code explains what broke, and an
      // unkillable server explains why the artifact cannot be trusted. Neither
      // is allowed to hide the other.
      failure = failure
        ? appendReason(
            failure,
            `the server could not be confirmed stopped: ${teardown.message}`,
          )
        : teardown;
    }
  }

  // Nothing to compare against if the build was never verified, and an
  // interrupted run has no meaningful artifact to judge.
  if (options.interrupted || !options.buildVerified) return failure;

  // A server that is still running can still rewrite `.next` — `next start`
  // does exactly that when a Server Action revalidates a path — so measuring
  // the artifact now would be measuring a moving target. Refuse to report on
  // it rather than report something unfounded.
  if (!shutdownConfirmed) {
    return appendReason(
      failure,
      "the build integrity check was skipped: shutdown could not be confirmed, and a server that is still running can rewrite .next while it is being measured",
    );
  }

  options.onStep?.("Re-checking the build's stylesheets");

  let drift: MissingChunks;
  try {
    drift = await options.findDrift();
  } catch (error) {
    return appendReason(
      failure,
      `the post-run build check could not run: ${toError(error).message}`,
    );
  }

  if (drift.size === 0) return failure;
  return appendReason(failure, driftMessage(drift));
}
