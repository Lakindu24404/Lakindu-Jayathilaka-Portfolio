import { test as base, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Playwright fixtures for the dashboard suite.
 *
 * A throwaway administrator is created per worker through the server-only admin
 * API and removed afterwards. Its password is generated in-process and never
 * written to a report, a trace or the console.
 */

const url = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return value.replace(/\/+$/, "");
};
const serviceKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return value;
};

export const QA_PREFIX = `qa-${process.env.QA_RUN_ID ?? Date.now()}-`;

export function service(): SupabaseClient {
  return createClient(url(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type QaAccount = { id: string; email: string; password: string };

/** Rows this run created, so cleanup never touches the seeded content. */
export class Recorder {
  readonly techIds: string[] = [];
  readonly projectIds: string[] = [];
  readonly objects: Array<[string, string]> = [];
  /** `[table, id, display_order]` for pre-existing rows a reorder renumbered. */
  private readonly orderSnapshots: Array<[string, string, number]> = [];

  /**
   * Record the current `display_order` of rows a test is about to reorder.
   *
   * A reorder normalises the whole ring or list from zero, so it rewrites the
   * seeded rows sharing that ring as well as the QA ones. Rendering is
   * unaffected, but the stored values are put back on cleanup so a QA run
   * leaves the seeded content byte-identical.
   */
  async snapshotOrder(
    db: SupabaseClient,
    table: string,
    filter: Record<string, string> = {},
  ) {
    let query = db.from(table).select("id,display_order");
    for (const [column, value] of Object.entries(filter)) {
      query = query.eq(column, value);
    }
    const { data } = await query;
    for (const row of data ?? []) {
      this.orderSnapshots.push([
        table,
        row.id as string,
        row.display_order as number,
      ]);
    }
  }

  async cleanup(db: SupabaseClient) {
    for (const [bucket, name] of this.objects.splice(0)) {
      await db.storage.from(bucket).remove([name]);
    }
    if (this.projectIds.length > 0) {
      await db.from("projects").delete().in("id", this.projectIds.splice(0));
    }
    if (this.techIds.length > 0) {
      await db
        .from("stack_technologies")
        .delete()
        .in("id", this.techIds.splice(0));
    }
    // Put back any pre-existing ordering a reorder normalised. Rows this run
    // deleted above simply match nothing.
    for (const [table, id, displayOrder] of this.orderSnapshots.splice(0)) {
      await db.from(table).update({ display_order: displayOrder }).eq("id", id);
    }
  }
}

export const test = base.extend<{
  db: SupabaseClient;
  recorder: Recorder;
  adminAccount: QaAccount;
  adminPage: Page;
}>({
  db: async ({}, use) => {
    await use(service());
  },

  recorder: async ({ db }, use) => {
    const recorder = new Recorder();
    // Reordering normalises a whole ring or list from zero, so it rewrites the
    // seeded rows that share it. Snapshotting up front means every test puts
    // the ordering back, whether or not it meant to reorder anything.
    await recorder.snapshotOrder(db, "stack_technologies");
    await recorder.snapshotOrder(db, "projects");
    await use(recorder);
    await recorder.cleanup(db);
  },

  adminAccount: async ({ db }, use) => {
    const email = `${QA_PREFIX}e2e@qa.invalid`;
    const password = `Qa!${crypto.randomUUID()}`;

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Could not create the QA admin: ${error?.message}`);
    }
    const { error: grantError } = await db
      .from("admin_users")
      .insert({ user_id: data.user.id, email });
    if (grantError) {
      throw new Error(`Could not grant QA admin: ${grantError.message}`);
    }

    await use({ id: data.user.id, email, password });

    await db.from("admin_users").delete().eq("user_id", data.user.id);
    await db.auth.admin.deleteUser(data.user.id);
  },

  adminPage: async ({ page, adminAccount }, use) => {
    await signIn(page, adminAccount.email, adminAccount.password);
    await use(page);
  },
});

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/dashboard/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard(?!\/login)/, { timeout: 30_000 });
}

export const expect = test.expect;

/**
 * Toasts stay on screen for several seconds and stack, so "a success toast is
 * visible" is not proof that *this* save finished — the previous one's toast
 * may still be there. Clearing them first makes the next wait meaningful.
 */
export async function clearToasts(page: Page) {
  const closers = page.getByRole("button", { name: "Dismiss notification" });
  for (let i = await closers.count(); i > 0; i--) {
    await closers.first().click();
  }
  await page.locator(".dashToast").waitFor({ state: "detached" }).catch(() => {});
}

/**
 * Wait until a database row actually matches, rather than trusting the UI.
 *
 * Server Actions return before the public cache settles, so tests that assert
 * on the public site must first know the write itself has landed.
 */
export async function waitForRow<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  id: string,
  matches: (row: T | null) => boolean,
  label = `${table}/${id}`,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data } = await db.from(table).select("*").eq("id", id).maybeSingle();
    if (matches(data as T | null)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${label} to reach the expected state`);
}
