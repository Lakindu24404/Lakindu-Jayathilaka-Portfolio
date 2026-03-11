/**
 * The read-only half of the Supabase audit, kept apart from the CLI so it can
 * be exercised against a stub client.
 *
 * Every response goes through `unwrap`, which turns a PostgREST error — or a
 * page that came back full, and so may be hiding rows — into a thrown
 * `AuditError`. That is the entire point of this module: a network,
 * credential or permission failure must never reach the report as an empty,
 * apparently-clean result. `tests/unit/audit.test.mts` holds that line.
 *
 * Nothing here writes. The audit is safe to run against production.
 */

/** Every row, object and auth user a QA run creates carries this prefix. */
export const QA_PREFIX_PATTERN = /^qa-\d{10,}-/;

/** The buckets `supabase/migrations/0003_storage.sql` creates. */
export const EXPECTED_BUCKETS = ["stack-logos", "project-images"] as const;

/**
 * PostgREST and the storage/auth list APIs page their results. A response that
 * comes back exactly this full may have more behind it, which would make "no
 * QA leftovers" a claim the audit cannot actually support.
 */
const PAGE_LIMIT = 1000;

const TECH_COLUMNS =
  "brand_key,name,ring,display_order,enabled,icon_mode,manual_angle,angle";
const PROJECT_COLUMNS = "slug,title,published,show_on_homepage,display_order";

export class AuditError extends Error {
  readonly operation: string;

  constructor(operation: string, detail: string) {
    super(`${operation}: ${redact(detail)}`);
    this.name = "AuditError";
    this.operation = operation;
  }
}

/**
 * Blank anything long enough to be a key or a token.
 *
 * Supabase error strings are server-authored and normally carry no secret, but
 * this output is pasted into reports and CI logs, so an accidental JWT is
 * removed rather than trusted not to appear.
 */
export function redact(text: string): string {
  return text.replace(/[A-Za-z0-9_\-.]{40,}/g, "[redacted]");
}

type Row = Record<string, unknown>;
type Failure = { message?: string } | null;
type ListResult<T> = { data: T[] | null; error: Failure } | null | undefined;

/**
 * The narrow slice of `SupabaseClient` the audit touches.
 *
 * Declared structurally so a test can hand in a stub. The CLI passes the real
 * client from untyped JS, which is why nothing here depends on supabase-js.
 */
export type AuditClient = {
  from(table: string): {
    select(columns: string): {
      order(column: string): PromiseLike<ListResult<Row>>;
    };
  };
  auth: {
    admin: {
      listUsers(params: { perPage: number }): PromiseLike<
        | {
            data: { users?: Array<{ id?: string; email?: string | null }> } | null;
            error: Failure;
          }
        | null
        | undefined
      >;
    };
  };
  storage: {
    listBuckets(): PromiseLike<ListResult<Row>>;
    from(bucket: string): {
      list(
        prefix: string,
        options: { limit: number },
      ): PromiseLike<ListResult<Row>>;
    };
  };
};

export type BucketReport = {
  id: string;
  objects: number;
  qa: string[];
};

export type AuditReport = {
  technologies: { seeded: Row[]; qa: string[] };
  projects: { seeded: Row[]; qa: string[] };
  adminUsers: { total: number; qa: number };
  authUsers: { total: number; qa: string[] };
  buckets: BucketReport[];
  expected: { technologies: number | null; projects: number | null };
};

function isQa(value: string): boolean {
  return QA_PREFIX_PATTERN.test(value);
}

function str(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function show(row: Row, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Reject an errored, absent or malformed response instead of defaulting it. */
function unwrapList<T>(operation: string, result: ListResult<T>): T[] {
  if (result === null || result === undefined) {
    throw new AuditError(operation, "the client returned no response");
  }
  if (result.error) {
    throw new AuditError(operation, result.error.message || "unknown error");
  }
  if (result.data === null || result.data === undefined) {
    throw new AuditError(operation, "the request returned no data");
  }
  if (!Array.isArray(result.data)) {
    throw new AuditError(operation, "expected a list of rows");
  }
  if (result.data.length >= PAGE_LIMIT) {
    throw new AuditError(
      operation,
      `returned a full page of ${PAGE_LIMIT} rows, so the audit cannot prove what lies beyond it`,
    );
  }
  return result.data;
}

/**
 * Collect the inventory.
 *
 * Throws `AuditError` on the first failed request. Callers must treat a
 * rejection as "unknown", never as "clean".
 */
export async function collectAudit(
  db: AuditClient,
  options: { expected?: { technologies?: number; projects?: number } } = {},
): Promise<AuditReport> {
  const technologies = unwrapList(
    "select stack_technologies",
    await db
      .from("stack_technologies")
      .select(TECH_COLUMNS)
      .order("display_order"),
  );

  const projects = unwrapList(
    "select projects",
    await db.from("projects").select(PROJECT_COLUMNS).order("display_order"),
  );

  const adminRows = unwrapList(
    "select admin_users",
    await db.from("admin_users").select("user_id").order("user_id"),
  );

  const authResponse = await db.auth.admin.listUsers({ perPage: PAGE_LIMIT });
  if (authResponse === null || authResponse === undefined) {
    throw new AuditError("list auth users", "the client returned no response");
  }
  if (authResponse.error) {
    throw new AuditError(
      "list auth users",
      authResponse.error.message || "unknown error",
    );
  }
  const users = authResponse.data?.users;
  if (!Array.isArray(users)) {
    throw new AuditError("list auth users", "expected a list of users");
  }
  if (users.length >= PAGE_LIMIT) {
    throw new AuditError(
      "list auth users",
      `returned a full page of ${PAGE_LIMIT} users, so the audit cannot prove what lies beyond it`,
    );
  }

  const qaUsers = users.filter((user) => isQa(user.email ?? ""));
  const qaUserIds = new Set(qaUsers.map((user) => user.id ?? ""));

  const buckets = unwrapList(
    "list storage buckets",
    await db.storage.listBuckets(),
  );
  const bucketIds = new Set(buckets.map((bucket) => str(bucket, "id")));

  const bucketReports: BucketReport[] = [];
  for (const bucket of EXPECTED_BUCKETS) {
    if (!bucketIds.has(bucket)) {
      throw new AuditError(
        "list storage buckets",
        `the "${bucket}" bucket is missing`,
      );
    }
    const objects = unwrapList(
      `list objects in "${bucket}"`,
      await db.storage.from(bucket).list("", { limit: PAGE_LIMIT }),
    );
    bucketReports.push({
      id: bucket,
      objects: objects.length,
      qa: objects.map((object) => str(object, "name")).filter(isQa),
    });
  }

  return {
    technologies: {
      seeded: technologies.filter((row) => !isQa(str(row, "brand_key"))),
      qa: technologies
        .map((row) => str(row, "brand_key"))
        .filter(isQa),
    },
    projects: {
      seeded: projects.filter((row) => !isQa(str(row, "slug"))),
      qa: projects.map((row) => str(row, "slug")).filter(isQa),
    },
    adminUsers: {
      total: adminRows.length,
      // A QA admin grant that outlived its auth user would be invisible in the
      // user list, so the rows are matched against the QA ids instead.
      qa: adminRows.filter((row) => qaUserIds.has(str(row, "user_id"))).length,
    },
    authUsers: {
      total: users.length,
      // Only the synthetic addresses are printed; real accounts stay out of it.
      qa: qaUsers.map((user) => user.email ?? "(no email)"),
    },
    buckets: bucketReports,
    expected: {
      technologies: options.expected?.technologies ?? null,
      projects: options.expected?.projects ?? null,
    },
  };
}

/** Everything that makes this a failed audit rather than a clean one. */
export function auditProblems(report: AuditReport): string[] {
  const problems: string[] = [];

  if (
    report.expected.technologies !== null &&
    report.technologies.seeded.length !== report.expected.technologies
  ) {
    problems.push(
      `expected ${report.expected.technologies} seeded technologies, found ${report.technologies.seeded.length}`,
    );
  }
  if (
    report.expected.projects !== null &&
    report.projects.seeded.length !== report.expected.projects
  ) {
    problems.push(
      `expected ${report.expected.projects} seeded projects, found ${report.projects.seeded.length}`,
    );
  }

  if (report.technologies.qa.length > 0) {
    problems.push(
      `${report.technologies.qa.length} QA technology row(s) left behind: ${report.technologies.qa.join(", ")}`,
    );
  }
  if (report.projects.qa.length > 0) {
    problems.push(
      `${report.projects.qa.length} QA project row(s) left behind: ${report.projects.qa.join(", ")}`,
    );
  }
  if (report.authUsers.qa.length > 0) {
    problems.push(
      `${report.authUsers.qa.length} QA auth user(s) left behind: ${report.authUsers.qa.join(", ")}`,
    );
  }
  if (report.adminUsers.qa > 0) {
    problems.push(`${report.adminUsers.qa} QA admin_users row(s) left behind`);
  }
  for (const bucket of report.buckets) {
    if (bucket.qa.length > 0) {
      problems.push(
        `${bucket.qa.length} QA object(s) left in "${bucket.id}": ${bucket.qa.join(", ")}`,
      );
    }
  }

  return problems;
}

/** Human-readable inventory. Counts and content keys only, never credentials. */
export function formatAudit(report: AuditReport): string[] {
  const lines: string[] = [];

  const expectedTech =
    report.expected.technologies === null
      ? ""
      : ` / ${report.expected.technologies} expected`;
  lines.push(
    `SEEDED technologies: ${report.technologies.seeded.length}${expectedTech}  (QA leftovers: ${report.technologies.qa.length})`,
  );
  for (const row of report.technologies.seeded) {
    lines.push(
      `  ${str(row, "brand_key").padEnd(12)} ring=${str(row, "ring").padEnd(6)}` +
        ` order=${show(row, "display_order").padStart(3)}` +
        ` enabled=${show(row, "enabled")}` +
        ` icon=${str(row, "icon_mode")}` +
        ` manual=${show(row, "manual_angle")}` +
        ` angle=${show(row, "angle")}`,
    );
  }

  const expectedProjects =
    report.expected.projects === null
      ? ""
      : ` / ${report.expected.projects} expected`;
  lines.push("");
  lines.push(
    `SEEDED projects: ${report.projects.seeded.length}${expectedProjects}  (QA leftovers: ${report.projects.qa.length})`,
  );
  for (const row of report.projects.seeded) {
    lines.push(
      `  order=${show(row, "display_order").padStart(3)}` +
        ` pub=${show(row, "published")}` +
        ` home=${show(row, "show_on_homepage")}` +
        `  ${str(row, "slug")}`,
    );
  }

  lines.push("");
  lines.push(
    `admin_users rows: ${report.adminUsers.total}  (QA leftovers: ${report.adminUsers.qa})`,
  );
  lines.push(
    `auth users: ${report.authUsers.total}  (QA leftovers: ${report.authUsers.qa.length})`,
  );
  for (const email of report.authUsers.qa) lines.push(`  - ${email}`);

  lines.push("");
  for (const bucket of report.buckets) {
    lines.push(
      `storage "${bucket.id}": ${bucket.objects} object(s)  (QA leftovers: ${bucket.qa.length})`,
    );
    for (const name of bucket.qa) lines.push(`  - ${name}`);
  }

  return lines;
}
