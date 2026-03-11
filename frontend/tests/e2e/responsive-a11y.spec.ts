import { QA_PREFIX, expect, test } from "./fixtures";

/**
 * Viewport, keyboard and reduced-motion behaviour, for the dashboard and for
 * the public pages it feeds.
 */

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

/** No element may push the document wider than the viewport. */
async function assertNoHorizontalOverflow(
  page: import("@playwright/test").Page,
  label: string,
) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
    culprits: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 80)),
  }));
  expect(
    overflow.doc,
    `${label} scrolls horizontally (${overflow.doc} > ${overflow.view}); first offenders: ${overflow.culprits.join(", ")}`,
  ).toBeLessThanOrEqual(overflow.view + 1);
}

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test(`the dashboard fits a ${name} viewport without horizontal scroll`, async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize(size);

    for (const path of [
      "/dashboard",
      "/dashboard/stack",
      "/dashboard/projects",
      "/dashboard/projects/new",
    ]) {
      await adminPage.goto(path);
      await adminPage.waitForLoadState("networkidle");
      await assertNoHorizontalOverflow(adminPage, `${name} ${path}`);
    }
  });

  test(`the public site fits a ${name} viewport without horizontal scroll`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    for (const path of ["/", "/bambinoo"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await assertNoHorizontalOverflow(page, `${name} ${path}`);
    }
  });
}

test("the dashboard swaps its sidebar for a top bar on mobile", async ({
  adminPage,
}) => {
  // The viewport is set before each navigation rather than resizing a loaded
  // page: a resize alone can leave the previous layout measured for a frame.
  await adminPage.setViewportSize(VIEWPORTS.desktop);
  await adminPage.goto("/dashboard/stack");
  await expect(adminPage.locator(".dashSidebar")).toBeVisible();
  await expect(adminPage.locator(".dashTopbar")).toBeHidden();

  await adminPage.setViewportSize(VIEWPORTS.mobile);
  await adminPage.goto("/dashboard/stack");
  await expect(adminPage.locator(".dashSidebar")).toBeHidden();
  await expect(adminPage.locator(".dashTopbar")).toBeVisible();

  // The preview drops below the editor rather than sitting beside it.
  // `boundingBox()` returns null for an element that is not visible *right
  // now* rather than waiting, so visibility is asserted first — that check
  // does auto-wait, and without it the measurement races the render.
  const editorPanel = adminPage.locator(".dashPanel").first();
  const previewPanel = adminPage.locator(".dashPreview");
  await expect(editorPanel).toBeVisible();
  await expect(previewPanel).toBeVisible();

  const editor = await editorPanel.boundingBox();
  const preview = await previewPanel.boundingBox();

  expect(editor, "the ring panels are not rendered").not.toBeNull();
  expect(preview, "the preview panel is not rendered").not.toBeNull();

  expect(preview!.y, "the preview is not below the editor").toBeGreaterThan(
    editor!.y,
  );
  expect(
    Math.abs(preview!.x - editor!.x),
    "the preview is still beside the editor rather than stacked under it",
  ).toBeLessThan(2);
});

test("dashboard rows stay inside the viewport on a narrow phone", async ({
  adminPage,
}) => {
  await adminPage.setViewportSize({ width: 360, height: 780 });
  await adminPage.goto("/dashboard/projects");

  const clipped = await adminPage
    .locator(".dashRow")
    .evaluateAll((rows) =>
      rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length,
    );
  expect(clipped, "project rows are clipped at 360px").toBe(0);
});

test("the dashboard is reachable with the keyboard alone", async ({
  adminPage,
}) => {
  await adminPage.goto("/dashboard");

  // Tab until the Stack Orbit link takes focus, then activate it.
  const stackLink = adminPage.getByRole("link", { name: "Stack Orbit" });
  for (let i = 0; i < 25; i++) {
    await adminPage.keyboard.press("Tab");
    if (await stackLink.evaluate((el) => el === document.activeElement)) break;
  }
  expect(
    await stackLink.evaluate((el) => el === document.activeElement),
    "the Stack Orbit link could not be reached by tabbing",
  ).toBe(true);

  await adminPage.keyboard.press("Enter");
  await expect(adminPage).toHaveURL(/\/dashboard\/stack$/);

  // Every reorder handle exposes a name and the shared keyboard instructions.
  const handle = adminPage.getByRole("button", { name: /^Reorder / }).first();
  await expect(handle).toHaveAttribute("aria-describedby", "dash-sortable-help");
  await expect(adminPage.locator("#dash-sortable-help")).toContainText(
    /Space to pick up/i,
  );
});

test("focus is visible on dashboard controls", async ({ adminPage }) => {
  await adminPage.goto("/dashboard/projects");
  const search = adminPage.getByPlaceholder("Search by title, slug or category");
  await search.focus();

  const outline = await search.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
    };
  });
  const hasVisibleFocus =
    parseFloat(outline.outlineWidth) > 0 || outline.boxShadow !== "none";
  expect(hasVisibleFocus, "a focused input shows no focus indicator").toBe(true);
});

test("reduced motion stops the orbit in the dashboard preview and on the site", async ({
  browser,
  adminAccount,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  try {
    // Public orbit.
    await page.goto("/");
    const publicRotor = page.locator('[role=img][aria-label*="orbiting"] [class*="rotor"]').first();
    expect(
      await publicRotor.evaluate((n) => getComputedStyle(n).animationName),
      "the public orbit still animates under prefers-reduced-motion",
    ).toBe("none");

    // Dashboard preview.
    await page.goto("/dashboard/login");
    await page.getByLabel("Email").fill(adminAccount.email);
    await page.getByLabel("Password").fill(adminAccount.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard(?!\/login)/);

    await page.goto("/dashboard/stack");
    const previewRotor = page.locator('.dashOrbitScale [class*="rotor"]').first();
    expect(
      await previewRotor.evaluate((n) => getComputedStyle(n).animationName),
      "the dashboard preview still animates under prefers-reduced-motion",
    ).toBe("none");
  } finally {
    await context.close();
  }
});

test("the public orbit keeps its speeds, directions and upright logos", async ({
  page,
}) => {
  await page.goto("/");
  const orbit = page.locator('[role=img][aria-label*="orbiting"]');

  const rotors = await orbit.evaluate((node) =>
    [...node.querySelectorAll('[class*="rotor"]')].map((r) => {
      const s = getComputedStyle(r);
      return { duration: s.animationDuration, name: s.animationName };
    }),
  );
  // Four rings, outermost first: alternating directions, each one quicker
  // than the ring outside it.
  expect(rotors).toHaveLength(4);
  expect(rotors.map((r) => r.duration)).toEqual(["61s", "48s", "38s", "29s"]);
  expect(rotors[0].name).toContain("turnCounterClockwise");
  expect(rotors[1].name).toContain("turnClockwise");
  expect(rotors[2].name).toContain("turnCounterClockwise");
  expect(rotors[3].name).toContain("turnClockwise");

  // Each node counter-rotates by its own angle so the logo stays upright.
  const counterRotated = await orbit.evaluate((node) =>
    [...node.querySelectorAll<HTMLElement>("[data-brand]")].every((anchor) => {
      const angle = anchor.style.getPropertyValue("--angle").trim();
      const counter = anchor.style.getPropertyValue("--counter-angle").trim();
      return parseFloat(angle) === -parseFloat(counter);
    }),
  );
  expect(counterRotated, "a node's counter-rotation does not match its angle").toBe(
    true,
  );
});

test("a case study page is keyboard navigable and labelled", async ({
  page,
  db,
  recorder,
}) => {
  const slug = `${QA_PREFIX}a11y-case`;
  const { data, error } = await db
    .from("projects")
    .insert({
      slug,
      title: `${QA_PREFIX} Accessibility Case`,
      tag: "QA",
      image: "/images/project-bambinoo.png",
      gallery: ["/images/project-bambinoo.png"],
      published: true,
      intro: "QA intro",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.projectIds.push(data.id);

  // Reachable only after a revalidation, so assert on a seeded slug instead.
  await page.goto("/bambinoo");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Project information")).toBeVisible();
  await expect(page.getByLabel("Project case study")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project navigation" }))
    .toBeVisible();

  // The back link is focusable and leads home.
  const back = page.getByRole("link", { name: /Back to Projects/ });
  await back.focus();
  expect(await back.evaluate((el) => el === document.activeElement)).toBe(true);
});

/**
 * The orbit's geometry is a regression guard, not a new feature: the logo fit
 * editor writes a transform *inside* the node, and must not change the size of
 * the node or the ring it sits on at any breakpoint.
 *
 * The expected numbers come straight from `Stack.module.css`: 620px desktop and
 * `min(350px, 100vw - 40px)` below 560px, with the node a fixed 0.090323 of
 * whichever `--orbit-size` applies.
 */
const NODE_RATIO = 0.090323;

async function measureOrbit(page: import("@playwright/test").Page) {
  const orbit = page.locator('[role=img][aria-label*="orbiting"]');
  await expect(orbit).toBeVisible();
  return orbit.evaluate((element) => {
    const nodes = [
      ...element.querySelectorAll<HTMLElement>('[data-brand] > div'),
    ];
    const sizes = nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        radius: style.borderRadius,
      };
    });
    return {
      orbit: element.getBoundingClientRect().width,
      count: nodes.length,
      widths: [...new Set(sizes.map((size) => size.width.toFixed(2)))],
      heights: [...new Set(sizes.map((size) => size.height.toFixed(2)))],
      round: sizes.every((size) => size.radius.includes("50%")),
    };
  });
}

test("the orbit keeps its node sizes on desktop and on mobile", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto("/");
  const desktop = await measureOrbit(page);

  expect(desktop.orbit, "the desktop orbit is no longer 620px").toBeCloseTo(
    620,
    0,
  );
  // At least the twenty-one seeded technologies. A QA node another test
  // published may still be in the homepage cache, so this is a floor rather
  // than an equality -- what matters here is that every node is one size.
  expect(
    desktop.count,
    "the orbit is not showing all 21 technologies",
  ).toBeGreaterThanOrEqual(21);
  // One size for every node on every ring, and still a circle.
  expect(desktop.widths).toHaveLength(1);
  expect(desktop.heights).toEqual(desktop.widths);
  expect(desktop.round, "an orbit node is no longer circular").toBe(true);
  expect(parseFloat(desktop.widths[0])).toBeCloseTo(620 * NODE_RATIO, 1);

  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/");
  const mobile = await measureOrbit(page);

  // 390px viewport: min(350px, 100vw - 40px) is 350px.
  expect(mobile.orbit, "the mobile orbit is no longer 350px").toBeCloseTo(350, 0);
  expect(mobile.count).toBeGreaterThanOrEqual(21);
  expect(mobile.widths).toHaveLength(1);
  expect(mobile.heights).toEqual(mobile.widths);
  expect(mobile.round).toBe(true);
  expect(parseFloat(mobile.widths[0])).toBeCloseTo(350 * NODE_RATIO, 1);
});
