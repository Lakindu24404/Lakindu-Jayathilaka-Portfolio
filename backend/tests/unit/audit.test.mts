import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuditError,
  auditProblems,
  collectAudit,
  formatAudit,
  redact,
  type AuditClient,
} from "../tools/audit-core.mts";

/**
 * The audit's failure behaviour.
 *
 * The bug these cover: the original script ignored the `error` field on every
 * Supabase response, so an authentication or network failure printed
 * "SEEDED technologies: 0 (QA leftovers: 0)" — a broken connection reported as
 * a clean database. Each case below drives one request to failure and asserts
 * the audit *rejects* rather than returning a report at all.
 */

type Response = unknown;

const ok = (data: unknown) => ({ data, error: null });
const fails = (message: string) => ({ data: null, error: { message } });

const DEFAULT_BUCKETS = ok([{ id: "stack-logos" }, { id: "project-images" }]);

function stub(
  overrides: {
    stack_technologies?: Response;
    projects?: Response;
    admin_users?: Response;
    authUsers?: Response;
    buckets?: Response;
    objects?: Record<string, Response>;
  } = {},
): AuditClient {
  // `in` rather than `??`, so a test can inject an explicitly absent response
  // (`null`) and not have it silently defaulted back to a healthy one.
  const pick = (key: keyof typeof overrides, fallback: Response): Response =>
    key in overrides ? (overrides[key] as Response) : fallback;

  const tables: Record<string, Response> = {
    stack_technologies: pick("stack_technologies", ok([])),
    projects: pick("projects", ok([])),
    admin_users: pick("admin_users", ok([])),
  };

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            order: () => Promise.resolve(tables[table]),
          };
        },
      };
    },
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve(pick("authUsers", ok({ users: [] }))),
      },
    },
    storage: {
      listBuckets: () => Promise.resolve(pick("buckets", DEFAULT_BUCKETS)),
      from(bucket: string) {
        return {
          list: () =>
            Promise.resolve(
              overrides.objects && bucket in overrides.objects
                ? overrides.objects[bucket]
                : ok([]),
            ),
        };
      },
    },
  };

  // One cast at the boundary: this is a hand-rolled double, not a client.
  return client as unknown as AuditClient;
}

describe("a failed request can never produce a clean audit", () => {
  const cases: Array<[string, Parameters<typeof stub>[0], RegExp]> = [
    [
      "the technologies query",
      { stack_technologies: fails("network unreachable") },
      /stack_technologies/,
    ],
    ["the projects query", { projects: fails("JWT expired") }, /projects/],
    [
      "the admin_users query",
      { admin_users: fails("permission denied") },
      /admin_users/,
    ],
    [
      "the auth user listing",
      { authUsers: fails("Invalid API key") },
      /auth users/,
    ],
    [
      "the bucket listing",
      { buckets: fails("service unavailable") },
      /storage buckets/,
    ],
    [
      "a bucket's object listing",
      { objects: { "stack-logos": fails("timed out") } },
      /stack-logos/,
    ],
  ];

  for (const [label, overrides, mentions] of cases) {
    it(`rejects when ${label} fails`, async () => {
      await assert.rejects(
        collectAudit(stub(overrides)),
        (error: unknown) => {
          assert.ok(
            error instanceof AuditError,
            `expected an AuditError, got ${String(error)}`,
          );
          assert.match(error.message, mentions);
          return true;
        },
        `${label} failing was swallowed and reported as a result`,
      );
    });
  }

  it("rejects a response that carries neither data nor an error", async () => {
    await assert.rejects(
      collectAudit(stub({ projects: { data: null, error: null } })),
      AuditError,
    );
  });

  it("rejects a missing response object outright", async () => {
    await assert.rejects(
      collectAudit(stub({ projects: null })),
      (error: unknown) => {
        assert.ok(error instanceof AuditError);
        assert.match(error.message, /no response/);
        return true;
      },
    );
  });

  it("rejects when a bucket the migrations create is missing", async () => {
    await assert.rejects(
      collectAudit(stub({ buckets: ok([{ id: "stack-logos" }]) })),
      (error: unknown) => {
        assert.ok(error instanceof AuditError);
        assert.match(error.message, /project-images.*missing/);
        return true;
      },
    );
  });

  it("rejects a full page rather than trusting a truncated list", async () => {
    const full = Array.from({ length: 1000 }, (_, index) => ({
      brand_key: `seeded-${index}`,
    }));
    await assert.rejects(
      collectAudit(stub({ stack_technologies: ok(full) })),
      (error: unknown) => {
        assert.ok(error instanceof AuditError);
        assert.match(error.message, /full page/);
        return true;
      },
    );
  });

  it("rejects a truncated auth user page", async () => {
    const users = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
      email: `person${index}@example.com`,
    }));
    await assert.rejects(
      collectAudit(stub({ authUsers: ok({ users }) })),
      (error: unknown) => {
        assert.ok(error instanceof AuditError);
        assert.match(error.message, /full page/);
        return true;
      },
    );
  });

  it("rejects an auth response whose user list is not a list", async () => {
    await assert.rejects(
      collectAudit(stub({ authUsers: ok({ users: null }) })),
      AuditError,
    );
  });
});

describe("redact", () => {
  it("removes anything long enough to be a key from an error message", () => {
    const token = "a".repeat(64);
    assert.equal(redact(`bad key ${token}`), "bad key [redacted]");
  });

  it("keeps a failed request's message readable", () => {
    assert.equal(redact("permission denied for table projects"), "permission denied for table projects");
  });

  it("is applied to the message an AuditError carries", () => {
    const token = `${"x".repeat(30)}.${"y".repeat(30)}`;
    const error = new AuditError("select projects", `rejected ${token}`);
    assert.ok(!error.message.includes(token), error.message);
    assert.match(error.message, /\[redacted\]/);
  });
});

describe("a successful audit", () => {
  const client = stub({
    stack_technologies: ok([
      { brand_key: "html", ring: "outer", display_order: 0, enabled: true },
      { brand_key: "qa-1758000000000-abc", ring: "inner", display_order: 9 },
    ]),
    projects: ok([
      { slug: "kudos-design-agency-website", published: true, display_order: 0 },
      { slug: "qa-1758000000000-xyz", published: false, display_order: 9 },
    ]),
    admin_users: ok([{ user_id: "real-user" }, { user_id: "qa-user" }]),
    authUsers: ok({
      users: [
        { id: "real-user", email: "owner@example.com" },
        { id: "qa-user", email: "qa-1758000000000-admin@qa.invalid" },
      ],
    }),
    objects: {
      "stack-logos": ok([{ name: "qa-1758000000000-logo.svg" }]),
      "project-images": ok([{ name: "keeper.png" }]),
    },
  });

  it("separates seeded content from QA leftovers", async () => {
    const report = await collectAudit(client);

    assert.equal(report.technologies.seeded.length, 1);
    assert.deepEqual(report.technologies.qa, ["qa-1758000000000-abc"]);
    assert.equal(report.projects.seeded.length, 1);
    assert.deepEqual(report.projects.qa, ["qa-1758000000000-xyz"]);
  });

  it("counts admin rows and matches QA grants to their auth users", async () => {
    const report = await collectAudit(client);

    assert.equal(report.adminUsers.total, 2);
    assert.equal(report.adminUsers.qa, 1);
    assert.equal(report.authUsers.total, 2);
    assert.deepEqual(report.authUsers.qa, [
      "qa-1758000000000-admin@qa.invalid",
    ]);
  });

  it("reports object counts and QA objects per bucket", async () => {
    const report = await collectAudit(client);

    assert.deepEqual(
      report.buckets.map((bucket) => [bucket.id, bucket.objects, bucket.qa.length]),
      [
        ["stack-logos", 1, 1],
        ["project-images", 1, 0],
      ],
    );
  });

  it("flags every leftover and both seed-count mismatches", async () => {
    const report = await collectAudit(client, {
      expected: { technologies: 14, projects: 6 },
    });
    const problems = auditProblems(report);

    assert.match(problems.join("\n"), /expected 14 seeded technologies, found 1/);
    assert.match(problems.join("\n"), /expected 6 seeded projects, found 1/);
    assert.match(problems.join("\n"), /QA technology row/);
    assert.match(problems.join("\n"), /QA project row/);
    assert.match(problems.join("\n"), /QA auth user/);
    assert.match(problems.join("\n"), /QA admin_users row/);
    assert.match(problems.join("\n"), /QA object\(s\) left in "stack-logos"/);
  });

  it("reports no problems for a clean, fully seeded project", async () => {
    const clean = stub({
      stack_technologies: ok([{ brand_key: "html" }]),
      projects: ok([{ slug: "kudos-design-agency-website" }]),
      admin_users: ok([{ user_id: "real-user" }]),
      authUsers: ok({ users: [{ id: "real-user", email: "owner@example.com" }] }),
    });

    const report = await collectAudit(clean, {
      expected: { technologies: 1, projects: 1 },
    });

    assert.deepEqual(auditProblems(report), []);
  });

  it("prints counts without any real account address", async () => {
    const report = await collectAudit(client);
    const output = formatAudit(report).join("\n");

    assert.match(output, /SEEDED technologies: 1/);
    assert.match(output, /admin_users rows: 2 {2}\(QA leftovers: 1\)/);
    assert.ok(
      !output.includes("owner@example.com"),
      "a real account address reached the audit output",
    );
  });
});
