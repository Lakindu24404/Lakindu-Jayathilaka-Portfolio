import {
  QA_PREFIX,
  clearToasts,
  expect,
  test,
  waitForRow,
} from "./fixtures";

/**
 * Project create / read / update / duplicate / reorder / delete, through the
 * dashboard. Every project carries the QA prefix in its slug.
 */

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  image: string;
  gallery: string[];
  client: string;
  duration: string;
  preview_url: string;
  template_label: string;
  template_url: string;
  intro: string;
  approach: string;
  sections: Array<{ heading: string; body: string }>;
  features: string;
  a11y_notes: string;
  conclusion: string;
  published: boolean;
  show_on_homepage: boolean;
  display_order: number;
};

async function insertProject(
  db: import("@supabase/supabase-js").SupabaseClient,
  overrides: Record<string, unknown> = {},
) {
  const slug = `${QA_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db
    .from("projects")
    .insert({
      slug,
      title: `${QA_PREFIX}Project`,
      tag: "QA",
      image: "/images/project-bambinoo.png",
      display_order: 900,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

test("CREATE: every field round-trips into the database", async ({
  adminPage,
  db,
  recorder,
}) => {
  const title = `${QA_PREFIX} Full Project`;
  const slug = `${QA_PREFIX}full-project`;

  await adminPage.goto("/dashboard/projects/new");

  // The slug is generated from the title until it is edited by hand.
  await adminPage.getByLabel("Title").fill(title);
  await expect(
    adminPage.getByLabel("Slug"),
    "the slug was not generated from the title",
  ).toHaveValue(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));

  await adminPage.getByLabel("Slug").fill(slug);
  await adminPage.getByLabel("Category").fill("QA Category");
  await adminPage.getByLabel("Card thumbnail").fill("/images/project-bambinoo.png");
  await adminPage.getByLabel("Client").fill("QA Client");
  await adminPage.getByLabel("Duration").fill("2 weeks");
  await adminPage.getByLabel("Live preview URL").fill("https://example.com/live");
  await adminPage.getByLabel("Action label").fill("Get Template");
  await adminPage.getByLabel("Action URL").fill("https://example.com/buy");
  await adminPage.getByLabel("Introduction").fill("QA intro copy.");
  await adminPage.getByLabel("My Approach").fill("QA approach copy.");

  // Two repeatable content sections.
  for (const [index, heading] of ["First heading", "Second heading"].entries()) {
    await adminPage.getByRole("button", { name: "Add section" }).click();
    await adminPage
      .getByLabel(`Section ${index + 1} heading`)
      .fill(`QA ${heading}`);
    await adminPage
      .getByLabel(`Section ${index + 1} body`)
      .fill(`QA body ${index + 1}`);
  }

  await adminPage.getByLabel("Detailed pages and features").fill("QA features.");
  await adminPage
    .getByLabel("Accessibility and optimisation")
    .fill("QA accessibility notes.");
  await adminPage.getByLabel("Conclusions").fill("QA conclusion.");

  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save draft" }).click();
  await expect(adminPage.getByText(/Saved as a draft/)).toBeVisible();

  const { data } = await db
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single<ProjectRow>();
  expect(data, "the project was not stored").not.toBeNull();
  recorder.projectIds.push(data!.id);

  expect(data!.title).toBe(title);
  expect(data!.tag).toBe("QA Category");
  expect(data!.client).toBe("QA Client");
  expect(data!.duration).toBe("2 weeks");
  expect(data!.preview_url).toBe("https://example.com/live");
  expect(data!.template_label).toBe("Get Template");
  expect(data!.template_url).toBe("https://example.com/buy");
  expect(data!.intro).toBe("QA intro copy.");
  expect(data!.approach).toBe("QA approach copy.");
  expect(data!.features).toBe("QA features.");
  expect(data!.a11y_notes).toBe("QA accessibility notes.");
  expect(data!.conclusion).toBe("QA conclusion.");
  expect(data!.published, "a new project must default to draft").toBe(false);
  expect(data!.show_on_homepage).toBe(true);
  expect(data!.sections).toEqual([
    { heading: "QA First heading", body: "QA body 1" },
    { heading: "QA Second heading", body: "QA body 2" },
  ]);
});

test("CREATE: a duplicate slug is refused before it reaches the database", async ({
  adminPage,
  db,
  recorder,
}) => {
  const existing = await insertProject(db, { published: true });
  recorder.projectIds.push(existing.id);

  await adminPage.goto("/dashboard/projects/new");
  await adminPage.getByLabel("Title").fill(`${QA_PREFIX} Clash`);
  await adminPage.getByLabel("Slug").fill(existing.slug);
  await adminPage.getByLabel("Card thumbnail").fill("/images/project-bambinoo.png");

  // The editor warns before the save is even attempted.
  await expect(
    adminPage.getByText(/Another project uses this slug/i),
  ).toBeVisible();

  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save draft" }).click();
  await expect(
    adminPage.locator(".dashToast").filter({ hasText: /already used/i }),
  ).toBeVisible();

  const { count } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("slug", existing.slug);
  expect(count, "a duplicate slug was written").toBe(1);
});

test("CREATE: an invalid external URL is rejected", async ({
  adminPage,
  db,
}) => {
  const slug = `${QA_PREFIX}bad-url`;

  await adminPage.goto("/dashboard/projects/new");
  await adminPage.getByLabel("Title").fill(`${QA_PREFIX} Bad URL`);
  await adminPage.getByLabel("Slug").fill(slug);
  await adminPage.getByLabel("Card thumbnail").fill("/images/project-bambinoo.png");
  await adminPage.getByLabel("Live preview URL").fill("javascript:alert(1)");

  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save draft" }).click();
  await expect(adminPage.getByText(/fix the highlighted fields/i)).toBeVisible();
  await expect(
    adminPage.getByText(/Enter a full URL starting with/i),
  ).toBeVisible();

  const { data } = await db
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  expect(data, "a javascript: URL was stored").toBeNull();
});

test("READ: search and the draft/published filters work", async ({
  adminPage,
  db,
  recorder,
}) => {
  const draft = await insertProject(db, {
    title: `${QA_PREFIX}Needle Draft`,
    published: false,
  });
  const live = await insertProject(db, {
    title: `${QA_PREFIX}Needle Live`,
    published: true,
  });
  recorder.projectIds.push(draft.id, live.id);

  await adminPage.goto("/dashboard/projects");
  const search = adminPage.getByPlaceholder("Search by title, slug or category");

  await search.fill(`${QA_PREFIX}Needle`);
  await expect(adminPage.getByRole("listitem")).toHaveCount(2);

  await adminPage.getByRole("button", { name: "Drafts" }).click();
  await expect(adminPage.getByRole("listitem")).toHaveCount(1);
  await expect(adminPage.getByText(`${QA_PREFIX}Needle Draft`)).toBeVisible();

  await adminPage.getByRole("button", { name: "Published" }).click();
  await expect(adminPage.getByRole("listitem")).toHaveCount(1);
  await expect(adminPage.getByText(`${QA_PREFIX}Needle Live`)).toBeVisible();

  // A search that matches nothing gets an informative empty state.
  await adminPage.getByRole("button", { name: "All" }).click();
  await search.fill(`${QA_PREFIX}definitely-no-such-project`);
  await expect(adminPage.getByText("Nothing matches")).toBeVisible();
});

test("READ: the seeded projects are all present and published", async ({
  adminPage,
}) => {
  await adminPage.goto("/dashboard/projects");
  for (const slug of [
    "bambinoo",
    "cafs",
    "lms",
    "oralguard-lk",
    "ls-ecommerce",
    "climedge",
  ]) {
    await expect(
      adminPage.getByRole("listitem").filter({ hasText: `/${slug}` }),
      `${slug} is missing from the dashboard`,
    ).toHaveCount(1);
  }
});

test("UPDATE: text fields, homepage visibility and publishing persist", async ({
  adminPage,
  db,
  recorder,
}) => {
  const project = await insertProject(db, { published: false });
  recorder.projectIds.push(project.id);

  await adminPage.goto(`/dashboard/projects/${project.id}`);
  await adminPage.getByLabel("Title").fill(`${QA_PREFIX}Edited`);
  await adminPage.getByLabel("Client").fill("Edited Client");
  await adminPage.getByLabel("Conclusions").fill("Edited conclusion.");
  await adminPage.getByText("Show in the homepage grid").click();

  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByText(/Saved and published/)).toBeVisible();

  await waitForRow<ProjectRow>(
    db,
    "projects",
    project.id,
    (row) => row?.published === true,
    "the publish",
  );

  const { data } = await db
    .from("projects")
    .select("*")
    .eq("id", project.id)
    .single<ProjectRow>();
  expect(data!.title).toBe(`${QA_PREFIX}Edited`);
  expect(data!.client).toBe("Edited Client");
  expect(data!.conclusion).toBe("Edited conclusion.");
  expect(data!.show_on_homepage, "the homepage toggle did not persist").toBe(
    false,
  );
  expect(data!.published).toBe(true);

  // Survives a hard reload.
  await adminPage.reload();
  await expect(adminPage.getByLabel("Title")).toHaveValue(`${QA_PREFIX}Edited`);
  await expect(adminPage.getByLabel("Client")).toHaveValue("Edited Client");
});

test("UPDATE: warns before leaving with unsaved changes", async ({
  adminPage,
  db,
  recorder,
}) => {
  const project = await insertProject(db);
  recorder.projectIds.push(project.id);

  await adminPage.goto(`/dashboard/projects/${project.id}`);
  await adminPage.getByLabel("Title").fill(`${QA_PREFIX}Unsaved edit`);
  await expect(adminPage.getByText(/Unsaved changes/)).toBeVisible();

  await adminPage.getByRole("button", { name: "Back to projects" }).click();
  await expect(
    adminPage.getByRole("heading", { name: "Leave without saving?" }),
    "leaving with unsaved changes was not challenged",
  ).toBeVisible();

  // Cancelling keeps the editor open with the edit intact.
  await adminPage.getByRole("button", { name: "Cancel" }).click();
  await expect(adminPage.getByLabel("Title")).toHaveValue(
    `${QA_PREFIX}Unsaved edit`,
  );

  // Discarding leaves without writing.
  await adminPage.getByRole("button", { name: "Back to projects" }).click();
  await adminPage.getByRole("button", { name: "Discard changes" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard\/projects$/);

  const { data } = await db
    .from("projects")
    .select("title")
    .eq("id", project.id)
    .single<ProjectRow>();
  expect(data!.title, "a discarded edit was saved anyway").toBe(project.title);
});

test("DUPLICATE: creates a distinct draft copy", async ({
  adminPage,
  db,
  recorder,
}) => {
  const source = await insertProject(db, {
    published: true,
    intro: "Source intro",
    gallery: ["/images/project-bambinoo-detail-left.png"],
    sections: [{ heading: "S1", body: "B1" }],
  });
  recorder.projectIds.push(source.id);

  await adminPage.goto("/dashboard/projects");
  await adminPage
    .getByPlaceholder("Search by title, slug or category")
    .fill(source.slug);
  await adminPage.getByRole("button", { name: "Duplicate" }).click();

  await adminPage.waitForURL(/\/dashboard\/projects\/[0-9a-f-]{36}/);
  const copyId = adminPage.url().split("/").pop()!;
  recorder.projectIds.push(copyId);

  const { data } = await db
    .from("projects")
    .select("*")
    .eq("id", copyId)
    .single<ProjectRow>();

  expect(data!.slug, "the copy reused the original slug").not.toBe(source.slug);
  expect(data!.published, "a duplicate must start as a draft").toBe(false);
  expect(data!.title).toContain("copy");
  expect(data!.intro, "content was not copied").toBe("Source intro");
  expect(data!.gallery).toEqual(["/images/project-bambinoo-detail-left.png"]);
  expect(data!.sections).toEqual([{ heading: "S1", body: "B1" }]);

  // The original is untouched.
  const { data: original } = await db
    .from("projects")
    .select("published,slug")
    .eq("id", source.id)
    .single<ProjectRow>();
  expect(original!.published).toBe(true);
  expect(original!.slug).toBe(source.slug);
});

test("REORDER: keyboard reordering persists and survives a reload", async ({
  adminPage,
  db,
  recorder,
}) => {
  const made: ProjectRow[] = [];
  for (let i = 0; i < 3; i++) {
    const project = await insertProject(db, {
      title: `${QA_PREFIX}Ord${i}`,
      display_order: 900 + i,
    });
    recorder.projectIds.push(project.id);
    made.push(project);
  }

  await adminPage.goto("/dashboard/projects");
  const firstRow = adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}Ord0` });

  const handle = firstRow.getByRole("button", { name: /^Reorder / });
  await handle.focus();
  await adminPage.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await adminPage.keyboard.press("ArrowDown");

  // The page has two polite live regions: the toast container and the
  // sortable's announcement paragraph. Only the latter is asserted on.
  await expect(adminPage.locator("p[aria-live=polite]")).toContainText(
    `${QA_PREFIX}Ord0 moved`,
  );

  await waitForRow<ProjectRow>(
    db,
    "projects",
    made[0].id,
    (row) => typeof row?.display_order === "number" && row.display_order < 100,
    "the project reorder",
  );

  const { data: rows } = await db
    .from("projects")
    .select("id,display_order")
    .in("id", made.map((p) => p.id));
  const order = new Map(
    (rows ?? []).map((r) => [r.id as string, r.display_order as number]),
  );
  expect(
    order.get(made[0].id)!,
    "the moved project did not end up after its neighbour",
  ).toBeGreaterThan(order.get(made[1].id)!);

  await adminPage.reload();
  const qaRows = adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}Ord` });
  await expect(qaRows).toHaveCount(3);
  expect((await qaRows.allInnerTexts())[0]).toContain(`${QA_PREFIX}Ord1`);
});

test("REORDER: dragging is disabled while a search or filter is active", async ({
  adminPage,
  db,
  recorder,
}) => {
  const project = await insertProject(db);
  recorder.projectIds.push(project.id);

  await adminPage.goto("/dashboard/projects");
  await adminPage
    .getByPlaceholder("Search by title, slug or category")
    .fill(project.slug);

  await expect(
    adminPage.getByText(/Clear the search and filter to change the display order/),
  ).toBeVisible();
  await expect(
    adminPage.getByRole("button", { name: /^Reorder / }).first(),
  ).toBeDisabled();
});

test("DELETE: cancelling keeps the project, confirming removes it", async ({
  adminPage,
  db,
  recorder,
}) => {
  const project = await insertProject(db, { title: `${QA_PREFIX}DeleteMe` });
  recorder.projectIds.push(project.id);

  await adminPage.goto("/dashboard/projects");
  await adminPage
    .getByPlaceholder("Search by title, slug or category")
    .fill(project.slug);

  const row = adminPage.getByRole("listitem").filter({ hasText: project.slug });
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    adminPage.getByRole("heading", { name: "Delete this project?" }),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "Cancel" }).click();

  const { data: stillThere } = await db
    .from("projects")
    .select("id")
    .eq("id", project.id)
    .maybeSingle();
  expect(stillThere, "cancelling deleted the project anyway").not.toBeNull();

  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await adminPage.getByRole("button", { name: "Delete project" }).click();

  await waitForRow(db, "projects", project.id, (r) => r === null, "the delete");
  await expect(adminPage.getByText("Nothing matches")).toBeVisible();
});

test("PREVIEW: a draft renders through the real case-study layout", async ({
  adminPage,
  db,
  recorder,
}) => {
  const project = await insertProject(db, {
    published: false,
    title: `${QA_PREFIX}Draft Preview`,
    intro: "QA-DRAFT-PREVIEW-INTRO",
    gallery: ["/images/project-bambinoo-detail-left.png", "/images/project-bambinoo.png"],
    sections: [{ heading: "QA Section", body: "QA section body" }],
  });
  recorder.projectIds.push(project.id);

  await adminPage.goto(`/dashboard/preview/${project.slug}`);

  await expect(
    adminPage.getByRole("heading", { level: 1, name: `${QA_PREFIX}Draft Preview` }),
  ).toBeVisible();
  await expect(adminPage.getByText("QA-DRAFT-PREVIEW-INTRO")).toBeVisible();
  await expect(
    adminPage.getByRole("heading", { name: "QA Section" }),
  ).toBeVisible();
  await expect(adminPage.getByText(/not visible to visitors/)).toBeVisible();

  // The real ProjectCase chrome is present.
  await expect(adminPage.getByLabel("Project gallery")).toBeVisible();
  await expect(adminPage.getByLabel("Project case study")).toBeVisible();
});
