import type { Page } from "@playwright/test";
import { QA_PREFIX, expect, test } from "./fixtures";

/**
 * The login form's inline error. Next.js renders its own empty
 * `role="alert"` route announcer, so an unscoped alert lookup is ambiguous.
 */
const formError = (page: Page) => page.locator("p[role=alert]");

/**
 * Route protection, sign-in and the open-redirect surface on `?next=`.
 */

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in to the dashboard" }),
  ).toBeVisible();
});

test("a deep dashboard link is remembered and returned to after login", async ({
  page,
  adminAccount,
}) => {
  await page.goto("/dashboard/stack");
  await expect(page).toHaveURL(/\/dashboard\/login\?next=%2Fdashboard%2Fstack/);

  await page.getByLabel("Email").fill(adminAccount.email);
  await page.getByLabel("Password").fill(adminAccount.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/stack$/);
});

test("the next parameter cannot be used as an open redirect", async ({
  page,
  adminAccount,
  baseURL,
}) => {
  const ourOrigin = new URL(baseURL!).origin;

  for (const hostile of [
    "https://evil.example.com/",
    "//evil.example.com/",
    "https:/evil.example.com/",
    "/etc/passwd",
    // Backslashes: browsers treat them as path separators.
    String.raw`/\evil.example.com/`,
    // Traversal. Before `safeDashboardPath` existed the first of these
    // reached /evil.example.com, and the other two stranded a signed-in
    // administrator on the login page.
    "/dashboard/../../../evil.example.com",
    "/dashboard/../..//evil.example.com/",
    "/dashboard/..//evil.example.com/",
    "/dashboard/../../evil",
    // Prefix look-alikes that are not dashboard routes.
    "/dashboard-evil",
    "/dashboard@evil.example.com",
  ]) {
    await page.goto(`/dashboard/login?next=${encodeURIComponent(hostile)}`);
    await page.getByLabel("Email").fill(adminAccount.email);
    await page.getByLabel("Password").fill(adminAccount.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Landing anywhere that is not still the login form means the sign-in ran.
    await page.waitForURL(
      (url) => !url.pathname.startsWith("/dashboard/login"),
      { timeout: 30_000 },
    );

    expect(
      new URL(page.url()).origin,
      `next=${hostile} sent the browser off-origin`,
    ).toBe(ourOrigin);
    expect(page.url(), `next=${hostile} was followed`).not.toContain(
      "evil.example.com",
    );
    expect(
      new URL(page.url()).pathname,
      `next=${hostile} left the dashboard`,
    ).toMatch(/^\/dashboard/);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Log out/ }).click();
    await page.waitForURL(/\/dashboard\/login/, { timeout: 30_000 });
  }
});

test("invalid credentials produce an error and no session", async ({ page }) => {
  await page.goto("/dashboard/login");
  await page.getByLabel("Email").fill("nobody@qa.invalid");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(formError(page)).toContainText(/did not match|does not have/i);
  await expect(page).toHaveURL(/\/dashboard\/login/);
});

test("a signed-in non-admin is refused and signed back out", async ({
  page,
  db,
}) => {
  const email = `${QA_PREFIX}nonadmin@qa.invalid`;
  const password = `Qa!${crypto.randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message);

  try {
    await page.goto("/dashboard/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(formError(page)).toContainText(
      /does not have dashboard access/i,
    );

    // And the refusal must be real, not just a message: the dashboard stays shut.
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/dashboard\/login/);
  } finally {
    await db.auth.admin.deleteUser(data.user.id);
  }
});

test("logging out clears the session", async ({ adminPage }) => {
  await adminPage.goto("/dashboard");
  await adminPage.getByRole("button", { name: /Log out/ }).click();
  await adminPage.waitForURL(/\/dashboard\/login/);

  await adminPage.goto("/dashboard/projects");
  await expect(adminPage).toHaveURL(/\/dashboard\/login/);
});

test("a draft preview route is closed to anonymous visitors", async ({
  page,
  db,
  recorder,
}) => {
  const slug = `${QA_PREFIX}secret-draft`;
  const { data, error } = await db
    .from("projects")
    .insert({
      slug,
      title: `${QA_PREFIX}secret`,
      image: "/images/project-bambinoo.png",
      intro: "TOP-SECRET-DRAFT-BODY",
      published: false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.projectIds.push(data.id);

  const preview = await page.goto(`/dashboard/preview/${slug}`);
  expect(page.url()).toMatch(/\/dashboard\/login/);
  expect(await page.content()).not.toContain("TOP-SECRET-DRAFT-BODY");
  expect(preview?.status()).toBeLessThan(500);

  // And the public route must not serve it either.
  const publicResponse = await page.goto(`/${slug}`);
  expect(publicResponse?.status()).toBe(404);
});

test("an unauthenticated upload is rejected by the API", async ({ request }) => {
  const response = await request.post("/api/dashboard/upload", {
    multipart: {
      kind: "logo",
      file: {
        name: "x.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    },
  });
  expect(response.status()).toBe(401);
});

test("no service-role credential reaches the browser", async ({ adminPage }) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  const leaks: string[] = [];
  adminPage.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/javascript|html|json/.test(type)) return;
    try {
      const body = await response.text();
      if (body.includes(serviceKey)) leaks.push(response.url());
    } catch {
      // Some responses cannot be read twice; those are not bundles.
    }
  });

  for (const path of ["/", "/dashboard", "/dashboard/stack", "/dashboard/projects"]) {
    await adminPage.goto(path);
    await adminPage.waitForLoadState("networkidle");
  }

  expect(leaks, `service role key present in: ${leaks.join(", ")}`).toEqual([]);
});
