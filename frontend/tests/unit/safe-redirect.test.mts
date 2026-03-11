import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeDashboardPath } from "@/lib/safe-redirect";

/**
 * Regression cover for the `?next=` open-redirect surface.
 *
 * The rejected list is the set that was observed reaching the browser before
 * this validation existed: `/dashboard/../../../evil.example.com` normalised to
 * `/evil.example.com`, and two traversal forms left a signed-in administrator
 * stranded on the login page.
 */

describe("safeDashboardPath accepts real dashboard destinations", () => {
  for (const [input, expected] of [
    ["/dashboard", "/dashboard"],
    ["/dashboard/stack", "/dashboard/stack"],
    ["/dashboard/projects/new", "/dashboard/projects/new"],
    ["/dashboard/projects?filter=draft", "/dashboard/projects?filter=draft"],
    // Normalisation that stays inside the dashboard is fine.
    ["/dashboard/projects/../stack", "/dashboard/stack"],
  ] as const) {
    it(`${input} -> ${expected}`, () => {
      assert.equal(safeDashboardPath(input), expected);
    });
  }
});

describe("safeDashboardPath refuses everything else", () => {
  for (const input of [
    // Absolute and protocol-relative.
    "https://evil.example.com/",
    "http://evil.example.com/",
    "//evil.example.com/",
    "\\\\evil.example.com/",
    "https:/evil.example.com/",
    // Backslash separators, which browsers treat as "/".
    "/\\evil.example.com/",
    "/dashboard\\..\\..\\evil",
    // Traversal out of the dashboard. These are the ones that previously
    // escaped: the third reached /evil.example.com in a real browser.
    "/dashboard/../../evil",
    "/dashboard/../..//evil.example.com/",
    "/dashboard/../../../evil.example.com",
    "/dashboard/..//evil.example.com/",
    // Prefix look-alikes that are not dashboard routes.
    "/dashboard-evil",
    "/dashboardevil",
    "/dashboard@evil.example.com",
    // Not a path at all.
    "/etc/passwd",
    "relative/path",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "",
    null,
    undefined,
  ]) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.equal(safeDashboardPath(input), null);
    });
  }

  it("refuses the login page itself, which would loop", () => {
    assert.equal(safeDashboardPath("/dashboard/login"), null);
  });

  it("never returns a value that leaves the dashboard once normalised", () => {
    // Property check over generated traversal depths.
    for (let depth = 1; depth <= 8; depth++) {
      const input = `/dashboard/${"../".repeat(depth)}evil.example.com`;
      const result = safeDashboardPath(input);
      if (result === null) continue;
      assert.ok(
        result === "/dashboard" || result.startsWith("/dashboard/"),
        `${input} produced ${result}`,
      );
    }
  });
});
