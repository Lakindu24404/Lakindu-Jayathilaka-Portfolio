/**
 * Resolves the project's `@/*` TypeScript path alias for the Node test runner.
 *
 * The application modules under test import each other as `@/lib/...`, which
 * only `tsc` and the Next.js bundler understand, and they omit the file
 * extension. `module.registerHooks` is the stable synchronous hook API, so no
 * loader worker or extra dependency is needed.
 *
 * Loaded with `node --import ./tests/helpers/alias.mjs`.
 */
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const srcRoot = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;

// Checked in order, mirroring how the bundler resolves an extensionless import.
const CANDIDATES = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

function resolveSourceFile(bareUrl) {
  for (const suffix of CANDIDATES) {
    const candidate = `${bareUrl}${suffix}`;
    if (existsSync(new URL(candidate))) return candidate;
  }
  return bareUrl;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const bare = new URL(specifier.slice(2), srcRoot).href;
      return nextResolve(resolveSourceFile(bare), context);
    }
    return nextResolve(specifier, context);
  },
});
