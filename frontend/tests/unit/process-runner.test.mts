import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  ProcessFailure,
  runToCompletion,
  startBackground,
  terminate,
  waitForHttp,
} from "../tools/process-runner.mts";

/**
 * Every failure path a spawned child can take, driven with real processes.
 *
 * The bug these guard: `child.on("error", () => { throw ... })` throws from an
 * EventEmitter callback, which escapes the surrounding try/catch and becomes an
 * uncaught exception — skipping the run's teardown and leaving the server
 * behind. Each case below asserts the failure arrives as a rejected promise.
 */

const dirs: string[] = [];

after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** A throwaway ESM script, so behaviour does not depend on `-e` input typing. */
async function script(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "qa-proc-"));
  dirs.push(dir);
  const file = path.join(dir, "child.mjs");
  await writeFile(file, source);
  return file;
}

const QUIET = { stdio: "ignore" } as const;

describe("runToCompletion", () => {
  it("resolves when the child exits zero", async () => {
    const file = await script("process.exit(0);");
    await runToCompletion("step", process.execPath, [file], QUIET);
  });

  it("rejects with the child's exit code preserved", async () => {
    const file = await script("process.exit(3);");

    await assert.rejects(
      runToCompletion("API integration suite", process.execPath, [file], QUIET),
      (error: unknown) => {
        assert.ok(error instanceof ProcessFailure);
        assert.equal(error.exitCode, 3, "the original exit code was lost");
        assert.match(error.message, /API integration suite failed \(exit code 3\)/);
        return true;
      },
    );
  });

  it("rejects rather than throwing when the command cannot be spawned", async () => {
    await assert.rejects(
      runToCompletion(
        "missing tool",
        path.join(tmpdir(), "definitely-not-an-executable-qa"),
        [],
        QUIET,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ProcessFailure);
        assert.match(error.message, /missing tool could not start/);
        return true;
      },
    );
  });
});

describe("waitForHttp", () => {
  it("resolves once the server answers", async () => {
    const file = await script(`
      import { createServer } from "node:http";
      createServer((_req, res) => { res.writeHead(200); res.end("ok"); })
        .listen(Number(process.argv[2]), "127.0.0.1");
    `);
    const port = 3191;
    const background = startBackground(
      "test server",
      process.execPath,
      [file, String(port)],
      QUIET,
    );

    try {
      await waitForHttp(background, `http://127.0.0.1:${port}`, {
        timeoutMs: 15_000,
        intervalMs: 100,
      });
    } finally {
      await terminate(background.child);
    }
  });

  it("rejects immediately when the server exits before it is ready", async () => {
    const file = await script("process.exit(7);");
    const background = startBackground(
      "the production server",
      process.execPath,
      [file],
      QUIET,
    );

    await assert.rejects(
      waitForHttp(background, "http://127.0.0.1:3192", {
        timeoutMs: 15_000,
        intervalMs: 100,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ProcessFailure);
        assert.match(error.message, /exited before it was ready \(exit code 7\)/);
        assert.equal(error.exitCode, 7);
        return true;
      },
    );
  });

  it("rejects when the server never becomes ready", async () => {
    // Alive, listening on nothing: only the deadline can end this.
    const file = await script("setTimeout(() => {}, 60_000);");
    const background = startBackground(
      "the production server",
      process.execPath,
      [file],
      QUIET,
    );

    try {
      await assert.rejects(
        waitForHttp(background, "http://127.0.0.1:3193", {
          timeoutMs: 900,
          intervalMs: 100,
          requestTimeoutMs: 300,
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProcessFailure);
          assert.match(error.message, /was not ready at http:\/\/127\.0\.0\.1:3193 within/);
          return true;
        },
      );
    } finally {
      await terminate(background.child);
    }
  });

  it("does not leave an unhandled rejection after the process dies", async () => {
    const file = await script("process.exit(1);");
    const background = startBackground("server", process.execPath, [file], QUIET);

    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      await assert.rejects(
        waitForHttp(background, "http://127.0.0.1:3194", {
          timeoutMs: 5_000,
          intervalMs: 50,
        }),
      );
      // Give any stray rejection a turn of the loop to surface.
      await new Promise((resolve) => setTimeout(resolve, 250));
      assert.deepEqual(seen, [], "a rejection escaped unhandled");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("terminate", () => {
  /** The OS view, not Node's — proves the process really is gone. */
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  };

  it("stops a long-running child in well under two seconds", async () => {
    const file = await script("setInterval(() => {}, 1000);");
    const background = startBackground("server", process.execPath, [file], QUIET);

    // Let it get far enough to have a pid the platform recognises.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const pid = background.child.pid!;

    const started = Date.now();
    await terminate(background.child);
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < 2_000,
      `terminate took ${elapsed}ms; a normal teardown must not wait out a timeout`,
    );
    assert.equal(alive(pid), false, "the OS still knows the pid");
  });

  it("returns in under a second for a child that already exited", async () => {
    const file = await script("process.exit(0);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await background.whenFailed.catch(() => {});

    const started = Date.now();
    await terminate(background.child);
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < 1_000,
      `terminate waited ${elapsed}ms for a process that had already exited`,
    );
  });

  it("tolerates a null child", async () => {
    await terminate(null);
    await terminate(undefined);
  });

  it("rejects when the kill command cannot be spawned", async () => {
    const file = await script("setInterval(() => {}, 1000);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      await assert.rejects(
        terminate(background.child, {
          label: "the production server",
          platform: "win32",
          forceMs: 200,
          killTree: async () => ({
            method: "taskkill" as const,
            code: null,
            stderr: "",
            spawnError: Object.assign(new Error("spawn taskkill ENOENT"), {
              code: "ENOENT",
            }),
          }),
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProcessFailure);
          assert.match(error.message, /the production server \(pid \d+\)/);
          assert.match(error.message, /taskkill could not be spawned/);
          return true;
        },
      );
    } finally {
      await terminate(background.child);
    }
  });

  it("rejects when the kill command exits non-zero and the child survives", async () => {
    const file = await script("setInterval(() => {}, 1000);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      await assert.rejects(
        terminate(background.child, {
          label: "the production server",
          platform: "win32",
          forceMs: 200,
          killTree: async () => ({
            method: "taskkill" as const,
            code: 1,
            stderr: "ERROR: access denied",
            spawnError: null,
          }),
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProcessFailure);
          assert.match(error.message, /taskkill exited with 1: ERROR: access denied/);
          return true;
        },
      );
    } finally {
      await terminate(background.child);
    }
  });

  it("rejects once the forced-kill deadline passes, and never while the child lives", async () => {
    const file = await script("setInterval(() => {}, 1000);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const pid = background.child.pid!;

    let resolved = false;
    try {
      await assert.rejects(
        terminate(background.child, {
          label: "the production server",
          platform: "linux",
          graceMs: 150,
          forceMs: 150,
          // A kill that does nothing: the child stays alive throughout.
          sendSignal: () => {},
        }).then(() => {
          resolved = true;
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProcessFailure);
          assert.match(error.message, /could not confirm termination/);
          assert.match(error.message, /still running after 150ms/);
          return true;
        },
      );

      assert.equal(resolved, false, "terminate resolved while the child was alive");
      assert.equal(alive(pid), true, "the child should still be running here");
    } finally {
      await terminate(background.child);
    }
  });

  it("does not report a secret from the kill command's stderr", async () => {
    const file = await script("setInterval(() => {}, 1000);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const secret = `sb_secret_${"z".repeat(48)}`;
    try {
      await assert.rejects(
        terminate(background.child, {
          platform: "win32",
          forceMs: 150,
          killTree: async () => ({
            method: "taskkill" as const,
            code: 1,
            stderr: `failed using ${secret}`,
            spawnError: null,
          }),
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProcessFailure);
          assert.ok(
            !error.message.includes(secret),
            "a credential reached the teardown failure message",
          );
          assert.match(error.message, /\[redacted\]/);
          return true;
        },
      );
    } finally {
      await terminate(background.child);
    }
  });

  it("succeeds when the kill reports 'not found' because the child already died", async () => {
    const file = await script("process.exit(0);");
    const background = startBackground("server", process.execPath, [file], QUIET);
    await background.whenFailed.catch(() => {});

    // taskkill exits 128 for an unknown pid. The postcondition still holds, so
    // this must not be reported as a teardown failure.
    await terminate(background.child, {
      platform: "win32",
      forceMs: 200,
      killTree: async () => ({
        method: "taskkill" as const,
        code: 128,
        stderr: "ERROR: The process not found.",
        spawnError: null,
      }),
    });
  });

  it("takes the whole process tree down, not just the parent", async () => {
    // The parent spawns a grandchild and prints its pid. `next start` runs
    // workers the same way, which is why the tree — not the parent alone — has
    // to be terminated.
    const grandchild = await script("setInterval(() => {}, 1000);");
    const parent = await script(`
      import { spawn } from "node:child_process";
      const child = spawn(process.execPath, [${JSON.stringify(grandchild)}], { stdio: "ignore" });
      console.log(child.pid);
      setInterval(() => {}, 1000);
    `);

    const background = startBackground("server", process.execPath, [parent], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    const pid = await new Promise<number>((resolve, reject) => {
      let buffer = "";
      const timer = setTimeout(() => reject(new Error("no pid from the child")), 10_000);
      background.child.stdout?.on("data", (chunk) => {
        buffer += String(chunk);
        const parsed = Number.parseInt(buffer.trim(), 10);
        if (Number.isInteger(parsed) && buffer.includes("\n")) {
          clearTimeout(timer);
          resolve(parsed);
        }
      });
    });

    assert.ok(alive(pid), "the grandchild never started");
    const parentPid = background.child.pid!;

    const started = Date.now();
    await terminate(background.child);
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < 2_000,
      `tearing down a process tree took ${elapsed}ms`,
    );
    assert.equal(alive(parentPid), false, "the parent outlived terminate");

    // Reaping the grandchild is not instantaneous on either platform.
    for (let i = 0; i < 40 && alive(pid); i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(
      alive(pid),
      false,
      "the grandchild outlived terminate — the process tree was not taken down",
    );
  });
});
