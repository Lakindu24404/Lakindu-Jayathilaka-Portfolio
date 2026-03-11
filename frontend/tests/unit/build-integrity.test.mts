import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  appendReason,
  describeMissingChunks,
  finalizeRun,
  findMissingCssChunks,
  type MissingChunks,
} from "../tools/build-integrity.mts";

/**
 * The QA gate that refuses a build whose server output points at CSS chunks the
 * build never emitted, and the ordering rule that makes the post-run check
 * meaningful: the server has to be stopped before the artifact is measured,
 * because `next start` rewrites prerendered HTML on revalidation.
 */

const roots: string[] = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

/** Build a throwaway `.next` tree: emitted chunks plus server output files. */
async function fixture(build: {
  chunks: string[];
  server: Record<string, string>;
}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "qa-build-"));
  roots.push(root);

  const chunkDir = path.join(root, ".next", "static", "chunks");
  await mkdir(chunkDir, { recursive: true });
  for (const chunk of build.chunks) {
    await writeFile(path.join(chunkDir, chunk), "/* css */");
  }

  for (const [relative, contents] of Object.entries(build.server)) {
    const full = path.join(root, ".next", "server", relative);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, contents);
  }

  return root;
}

const html = (...chunks: string[]) =>
  `<html><head>${chunks
    .map((c) => `<link rel="stylesheet" href="/_next/static/chunks/${c}"/>`)
    .join("")}</head><body>x</body></html>`;

describe("findMissingCssChunks", () => {
  it("passes a build whose references all resolve", async () => {
    const root = await fixture({
      chunks: ["a1b2c3.css", "d4e5f6.css"],
      server: { "app/index.html": html("a1b2c3.css", "d4e5f6.css") },
    });

    assert.deepEqual([...(await findMissingCssChunks(root)).keys()], []);
  });

  it("fails a build referencing a chunk that was never emitted", async () => {
    const root = await fixture({
      chunks: ["a1b2c3.css"],
      server: { "app/index.html": html("a1b2c3.css", "gone-9z9z9z.css") },
    });

    const missing = await findMissingCssChunks(root);

    assert.deepEqual([...missing.keys()], ["gone-9z9z9z.css"]);
    assert.deepEqual(missing.get("gone-9z9z9z.css"), [
      path.join(".next", "server", "app", "index.html"),
    ]);
  });

  it("records every file that references a missing chunk", async () => {
    const root = await fixture({
      chunks: [],
      server: {
        "app/index.html": html("gone.css"),
        "app/index.rsc": `x:/_next/static/chunks/gone.css`,
        "app/about/page.html": html("gone.css"),
      },
    });

    const missing = await findMissingCssChunks(root);
    assert.equal(missing.get("gone.css")?.length, 3);
  });

  it("ignores the Turbopack cache, which holds older builds' chunk names", async () => {
    const root = await fixture({
      chunks: ["a1b2c3.css"],
      server: { "app/index.html": html("a1b2c3.css") },
    });
    const cacheDir = path.join(root, ".next", "server", "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      path.join(cacheDir, "old.json"),
      `{"ref":"static/chunks/from-a-previous-build.css"}`,
    );

    assert.deepEqual([...(await findMissingCssChunks(root)).keys()], []);
  });

  it("ignores file types that never carry chunk references", async () => {
    const root = await fixture({
      chunks: [],
      server: { "app/notes.txt": "static/chunks/ignored.css" },
    });

    assert.deepEqual([...(await findMissingCssChunks(root)).keys()], []);
  });

  it("reports nothing when there is no build at all", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "qa-build-"));
    roots.push(root);

    assert.deepEqual([...(await findMissingCssChunks(root)).keys()], []);
  });
});

describe("describeMissingChunks", () => {
  it("names the chunk and the files that reference it", () => {
    const missing: MissingChunks = new Map([
      ["gone.css", [".next/server/app/index.html", ".next/server/app/index.rsc"]],
    ]);

    const text = describeMissingChunks(missing);
    assert.match(text, /gone\.css/);
    assert.match(text, /referenced by \.next\/server\/app\/index\.html/);
    assert.match(text, /referenced by \.next\/server\/app\/index\.rsc/);
  });
});

describe("appendReason", () => {
  it("keeps the original failure first and its object as the cause", () => {
    const original = new Error("Playwright E2E suite failed (exit code 1)");
    const combined = appendReason(original, "drift happened");

    assert.match(combined.message, /Playwright E2E suite failed \(exit code 1\)/);
    assert.match(combined.message, /Additionally, drift happened/);
    assert.equal(combined.cause, original);
  });
});

describe("finalizeRun", () => {
  const drifted: MissingChunks = new Map([
    ["gone.css", [".next/server/app/index.html"]],
  ]);

  function harness(
    overrides: Partial<Parameters<typeof finalizeRun>[0]> = {},
    order: string[] = [],
  ) {
    return {
      order,
      options: {
        failure: null,
        interrupted: false,
        buildVerified: true,
        stopServer: async () => {
          order.push("stopServer");
        },
        findDrift: async () => {
          order.push("findDrift");
          return new Map() as MissingChunks;
        },
        ...overrides,
      },
    };
  }

  it("stops the server before measuring the artifact", async () => {
    const order: string[] = [];
    const { options } = harness({}, order);

    await finalizeRun(options);

    assert.deepEqual(
      order,
      ["stopServer", "findDrift"],
      "the drift check must run only after the server has stopped",
    );
  });

  it("returns no failure for a clean run with an intact artifact", async () => {
    const { options } = harness();
    assert.equal(await finalizeRun(options), null);
  });

  it("fails a passing run whose artifact drifted after the tests", async () => {
    const { options } = harness({ findDrift: async () => drifted });

    const result = await finalizeRun(options);

    assert.ok(result, "drift after a passing run must fail the command");
    assert.match(result.message, /drifted during the run/);
    assert.match(result.message, /gone\.css/);
    assert.match(result.message, /index\.html/);
  });

  it("does not hide an earlier failure behind the drift failure", async () => {
    const original = new Error("Playwright E2E suite failed (exit code 1)");
    const { options } = harness({
      failure: original,
      findDrift: async () => drifted,
    });

    const result = await finalizeRun(options);

    assert.ok(result);
    assert.match(
      result.message,
      /Playwright E2E suite failed \(exit code 1\)/,
      "the original failure was masked by the drift report",
    );
    assert.match(result.message, /Additionally,[\s\S]*gone\.css/);
    assert.equal(result.cause, original);
  });

  it("returns the original failure untouched when nothing drifted", async () => {
    const original = new Error("API integration suite failed (exit code 1)");
    const { options } = harness({ failure: original });

    assert.equal(await finalizeRun(options), original);
  });

  it("skips the drift check when the build was never verified", async () => {
    const order: string[] = [];
    const { options } = harness({ buildVerified: false }, order);

    await finalizeRun(options);

    assert.deepEqual(order, ["stopServer"]);
  });

  it("skips teardown and the check when the run was interrupted", async () => {
    const order: string[] = [];
    const { options } = harness({ interrupted: true }, order);

    assert.equal(await finalizeRun(options), null);
    assert.deepEqual(order, []);
  });

  it("reports a teardown failure when nothing else went wrong", async () => {
    const teardown = new Error("could not confirm termination of pid 42");
    const { options } = harness({
      stopServer: async () => {
        throw teardown;
      },
    });

    const result = await finalizeRun(options);

    assert.ok(result, "a failed teardown must fail the command");
    assert.match(
      result.message,
      /^could not confirm termination of pid 42/,
      "the teardown failure should lead the message",
    );
    assert.equal(result.cause, teardown, "the teardown error should be the cause");
    // And the artifact was deliberately not measured.
    assert.match(result.message, /build integrity check was skipped/);
  });

  it("keeps the run's failure first and appends the teardown failure", async () => {
    const original = new Error("Playwright E2E suite failed (exit code 1)");
    const { options } = harness({
      failure: original,
      stopServer: async () => {
        throw new Error("could not confirm termination of pid 42");
      },
    });

    const result = await finalizeRun(options);

    assert.ok(result);
    assert.match(
      result.message,
      /^Playwright E2E suite failed \(exit code 1\)/,
      "the original suite failure must stay primary",
    );
    assert.match(
      result.message,
      /could not be confirmed stopped[\s\S]*pid 42/,
      "the teardown failure was hidden",
    );
    assert.equal(result.cause, original);
  });

  it("skips the drift check when shutdown could not be confirmed", async () => {
    const order: string[] = [];
    const { options } = harness(
      {
        stopServer: async () => {
          order.push("stopServer");
          throw new Error("could not confirm termination of pid 42");
        },
        findDrift: async () => {
          order.push("findDrift");
          return new Map() as MissingChunks;
        },
      },
      order,
    );

    const result = await finalizeRun(options);

    assert.deepEqual(
      order,
      ["stopServer"],
      "the artifact must not be measured while a server may still be writing to it",
    );
    assert.match(result?.message ?? "", /build integrity check was skipped/);
    assert.match(result?.message ?? "", /shutdown could not be confirmed/);
  });

  it("still fails when teardown fails after the suites already failed", async () => {
    const original = new Error("API integration suite failed (exit code 1)");
    const { options } = harness({
      failure: original,
      stopServer: async () => {
        throw new Error("unkillable");
      },
    });

    const result = await finalizeRun(options);

    assert.ok(result, "the command must not report success");
    assert.match(result.message, /API integration suite failed/);
    assert.match(result.message, /unkillable/);
    assert.match(result.message, /build integrity check was skipped/);
  });

  it("fails the run when the post-run check itself cannot run", async () => {
    const { options } = harness({
      findDrift: async () => {
        throw new Error("EACCES");
      },
    });

    const result = await finalizeRun(options);
    assert.match(result?.message ?? "", /post-run build check could not run/);
  });
});
