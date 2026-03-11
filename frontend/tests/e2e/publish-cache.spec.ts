import { readFileSync } from "node:fs";
import {
  QA_PREFIX,
  clearToasts,
  expect,
  test,
  waitForRow,
} from "./fixtures";

/**
 * Publishing must reach the public site.
 *
 * These run against a production server, because the data cache and the
 * revalidation APIs behave differently under `next dev`.
 *
 * Ordering matters: a save is only "done" once the row has changed, so every
 * test waits on the database before asserting on a public URL. Waiting on a
 * success toast instead is not enough — toasts linger for several seconds, so
 * the previous action's toast satisfies the wait immediately.
 */

const seedSource = readFileSync("src/content/portfolio-seed.ts", "utf8");

type ProjectRow = { published: boolean; slug: string };
type TechRow = { enabled: boolean };

test("publishing a project makes it public on the next request", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const slug = `${QA_PREFIX}publish-flow`;
  const title = `${QA_PREFIX} Publish Flow`;

  // Nothing with this prefix is bundled, so finding it publicly can only mean
  // the page read Supabase rather than falling back to the seed module.
  expect(seedSource).not.toContain(QA_PREFIX);

  await adminPage.goto("/dashboard/projects/new");
  await adminPage.getByLabel("Title").fill(title);
  await adminPage.getByLabel("Slug").fill(slug);
  await adminPage.getByLabel("Card thumbnail").fill("/images/project-bambinoo.png");
  await adminPage.getByLabel("Introduction").fill("QA publish flow intro.");
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();

  await adminPage.waitForURL(/\/dashboard\/projects\/[0-9a-f-]{36}/);
  const { data } = await db
    .from("projects")
    .select("id,published")
    .eq("slug", slug)
    .single();
  expect(data?.published, "the project did not save as published").toBe(true);
  recorder.projectIds.push(data!.id);

  const detail = await request.get(`/${slug}`);
  expect(detail.status(), "published project detail page").toBe(200);
  expect(await detail.text()).toContain(title);

  const home = await request.get("/");
  expect(
    await home.text(),
    "the homepage still served pre-publish content",
  ).toContain(title);
});

test("unpublishing removes the project from the public site", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const slug = `${QA_PREFIX}unpublish-flow`;
  const title = `${QA_PREFIX} Unpublish Flow`;

  const { data: created, error } = await db
    .from("projects")
    .insert({
      slug,
      title,
      tag: "QA",
      image: "/images/project-bambinoo.png",
      published: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.projectIds.push(created.id);

  // Prime: one dashboard save, so the public cache knows about the row.
  await adminPage.goto(`/dashboard/projects/${created.id}`);
  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save & republish" }).click();
  await expect(adminPage.getByText(/Saved and published/)).toBeVisible();
  expect((await request.get(`/${slug}`)).status()).toBe(200);

  await adminPage.goto("/dashboard/projects");
  await adminPage.getByPlaceholder("Search by title, slug or category").fill(slug);
  await adminPage
    .getByRole("button", { name: /is published\. Unpublish\./ })
    .click();
  await waitForRow<ProjectRow>(
    db,
    "projects",
    created.id,
    (row) => row?.published === false,
    "the unpublish",
  );

  const detail = await request.get(`/${slug}`);
  expect(detail.status(), "an unpublished project is still reachable").toBe(404);

  const home = await request.get("/");
  expect(
    await home.text(),
    "an unpublished project is still on the homepage",
  ).not.toContain(title);
});

test("disabling and re-enabling a technology updates the public orbit", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const brandKey = `${QA_PREFIX}orbit`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = `${QA_PREFIX}OrbitNode`;

  const { data: created, error } = await db
    .from("stack_technologies")
    .insert({
      name,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "inner",
      display_order: 900,
      enabled: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(created.id);

  const row = () =>
    adminPage.getByRole("listitem").filter({ hasText: name }).first();

  async function save(toggleVisibility: boolean) {
    await clearToasts(adminPage);
    await row().getByRole("button", { name: "Edit" }).click();
    if (toggleVisibility) {
      await adminPage.getByText("Show on the portfolio").click();
    }
    await adminPage.getByRole("button", { name: "Save technology" }).click();
    await expect(adminPage.getByText(/Technology saved/)).toBeVisible();
  }

  // Prime, so the node is genuinely in the public orbit to begin with.
  await adminPage.goto("/dashboard/stack");
  await save(false);
  await expect
    .poll(async () => (await (await request.get("/")).text()).includes(name), {
      message: "the primed technology never reached the public orbit",
    })
    .toBe(true);

  await save(true);
  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (r) => r?.enabled === false,
    "the disable",
  );
  expect(
    await (await request.get("/")).text(),
    "a disabled technology is still in the public orbit",
  ).not.toContain(name);

  await save(true);
  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (r) => r?.enabled === true,
    "the re-enable",
  );
  expect(
    await (await request.get("/")).text(),
    "a re-enabled technology did not come back",
  ).toContain(name);
});

test("changing a slug retires the old public URL and serves the new one", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const oldSlug = `${QA_PREFIX}old-url`;
  const newSlug = `${QA_PREFIX}new-url`;
  const title = `${QA_PREFIX} Slug Change`;

  const { data: created, error } = await db
    .from("projects")
    .insert({
      slug: oldSlug,
      title,
      tag: "QA",
      image: "/images/project-bambinoo.png",
      published: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.projectIds.push(created.id);

  await adminPage.goto(`/dashboard/projects/${created.id}`);
  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save & republish" }).click();
  await expect(adminPage.getByText(/Saved and published/)).toBeVisible();
  expect(
    (await request.get(`/${oldSlug}`)).status(),
    "the original slug never became reachable",
  ).toBe(200);

  await clearToasts(adminPage);
  await adminPage.getByLabel("Slug").fill(newSlug);
  await adminPage.getByRole("button", { name: "Save & republish" }).click();
  await waitForRow<ProjectRow>(
    db,
    "projects",
    created.id,
    (row) => row?.slug === newSlug,
    "the slug change",
  );

  const fresh = await request.get(`/${newSlug}`);
  expect(fresh.status(), "the new slug does not resolve").toBe(200);
  expect(await fresh.text()).toContain(title);

  const stale = await request.get(`/${oldSlug}`);
  expect(stale.status(), "the old slug still serves the project").toBe(404);
});

test("deleting a project removes its public route", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const slug = `${QA_PREFIX}delete-flow`;
  const title = `${QA_PREFIX} Delete Flow`;

  const { data: created, error } = await db
    .from("projects")
    .insert({
      slug,
      title,
      tag: "QA",
      image: "/images/project-bambinoo.png",
      published: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.projectIds.push(created.id);

  await adminPage.goto(`/dashboard/projects/${created.id}`);
  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save & republish" }).click();
  await expect(adminPage.getByText(/Saved and published/)).toBeVisible();
  expect((await request.get(`/${slug}`)).status()).toBe(200);

  await adminPage.goto("/dashboard/projects");
  await adminPage.getByPlaceholder("Search by title, slug or category").fill(slug);
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await adminPage.getByRole("button", { name: "Delete project" }).click();

  await waitForRow(db, "projects", created.id, (row) => row === null, "the delete");

  expect(
    (await request.get(`/${slug}`)).status(),
    "a deleted project is still served publicly",
  ).toBe(404);
  expect(await (await request.get("/")).text()).not.toContain(title);
});
