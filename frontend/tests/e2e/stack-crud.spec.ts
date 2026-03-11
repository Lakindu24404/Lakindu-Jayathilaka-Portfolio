import {
  QA_PREFIX,
  clearToasts,
  expect,
  test,
  waitForRow,
} from "./fixtures";

/**
 * Stack Orbit create / read / update / reorder / delete, through the dashboard.
 *
 * Every technology created here carries the QA prefix in its brand key, and
 * every id is recorded so cleanup removes exactly these rows.
 */

type TechRow = {
  name: string;
  brand_key: string;
  logo_path: string;
  ring: string;
  display_order: number;
  enabled: boolean;
  node_background: string | null;
  icon_mode: string;
  manual_angle: boolean;
  angle: number | string | null;
  logo_scale: number | string;
  logo_offset_x: number | string;
  logo_offset_y: number | string;
};

const key = (suffix: string) =>
  `${QA_PREFIX}${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

/** A real, decodable 1x1 PNG, for the remote-logo rendering check. */
const REAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("READ: ticker names exactly mirror the current public orbit nodes", async ({
  page,
}) => {
  await page.goto("/");

  const orbitNames = await page
    .locator('[role="img"][aria-label*="orbiting"] [data-brand] [class*="srOnly"]')
    .allTextContents();
  const tickerNames = await page
    .locator('[data-stack-tools="primary"] li')
    .allTextContents();

  expect(orbitNames.length, "the public orbit unexpectedly has no nodes").toBeGreaterThan(0);
  expect(
    tickerNames,
    "the ticker contains a stale, missing or differently ordered technology name",
  ).toEqual(orbitNames);
});

/**
 * Set a range input the way React sees it.
 *
 * Playwright's `fill` assigns `input.value` directly, which passes through
 * React's own value tracker — React then believes nothing changed and skips
 * `onChange`. Going via the prototype setter updates the DOM behind the
 * tracker, so the subsequent `input` event is the change React acts on.
 */
async function setRange(
  page: import("@playwright/test").Page,
  label: string,
  value: number,
) {
  await page.getByLabel(label, { exact: true }).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/**
 * The framing one rendered node is actually carrying.
 *
 * Read from the DOM rather than from the draft, so it proves the whole chain:
 * the saved numbers, the shared `StackNodeLogo` layer, and the stylesheet that
 * turns them into a transform. `scope` picks which preview to look at — the
 * live orbit, the editor's own circle, or the public homepage.
 */
async function readNodeFit(
  page: import("@playwright/test").Page,
  scope: string,
  brandKey: string,
) {
  const wrapper = page
    .locator(`${scope} [data-brand="${brandKey}"] div[style*="--logo-scale"]`)
    .first();
  await wrapper.waitFor();
  return wrapper.evaluate((element) => {
    const node = element as HTMLElement;
    return {
      scale: node.style.getPropertyValue("--logo-scale").trim(),
      x: node.style.getPropertyValue("--logo-offset-x").trim(),
      y: node.style.getPropertyValue("--logo-offset-y").trim(),
      // The stylesheet's own output, so a broken selector fails here rather
      // than passing on the custom properties alone.
      transform: getComputedStyle(node).transform,
      imageTransform: getComputedStyle(node.querySelector("img")!).transform,
    };
  });
}

/** Insert a technology this run owns, with a known starting framing. */
async function seedTech(
  db: import("@supabase/supabase-js").SupabaseClient,
  recorder: { techIds: string[] },
  overrides: Record<string, unknown>,
) {
  const { data, error } = await db
    .from("stack_technologies")
    .insert({
      logo_path: "/images/stack-html5.svg",
      ring: "outer",
      display_order: 900,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(data.id);
  return data as TechRow & { id: string };
}

/** Fill and save the technology editor that is currently open. */
async function saveEditor(
  page: import("@playwright/test").Page,
  fields: {
    name?: string;
    brandKey?: string;
    logoPath?: string;
    ring?: "farOuter" | "outer" | "middle" | "inner";
    iconMode?: "Original" | "Dark" | "White";
    background?: string;
    manualAngle?: boolean;
    angle?: string;
    toggleVisibility?: boolean;
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
  },
) {
  if (fields.name !== undefined) {
    await page.getByLabel("Name").fill(fields.name);
  }
  if (fields.brandKey !== undefined) {
    await page.getByLabel("Brand key").fill(fields.brandKey);
  }
  if (fields.logoPath !== undefined) {
    await page.getByLabel("Logo", { exact: true }).fill(fields.logoPath);
  }
  if (fields.ring !== undefined) {
    await page.getByLabel("Orbit ring").selectOption(fields.ring);
  }
  if (fields.iconMode !== undefined) {
    await page.getByLabel("Icon colour").selectOption({ label: fields.iconMode });
  }
  if (fields.background !== undefined) {
    await page.getByLabel("Node background").fill(fields.background);
  }
  if (fields.manualAngle) {
    await page.getByText("Place this node manually").click();
  }
  if (fields.angle !== undefined) {
    await page.getByLabel("Angle (degrees)").fill(fields.angle);
  }
  if (fields.toggleVisibility) {
    await page.getByText("Show on the portfolio").click();
  }
  if (fields.zoom !== undefined) {
    await setRange(page, "Zoom", fields.zoom);
  }
  if (fields.offsetX !== undefined) {
    await setRange(page, "Horizontal position", fields.offsetX);
  }
  if (fields.offsetY !== undefined) {
    await setRange(page, "Vertical position", fields.offsetY);
  }

  await clearToasts(page);
  await page.getByRole("button", { name: "Save technology" }).click();
}

test("CREATE: a technology can be added to each ring", async ({
  adminPage,
  db,
  recorder,
}) => {
  for (const [ring, label] of [
    ["farOuter", "Far outer ring"],
    ["outer", "Outer ring"],
    ["middle", "Middle ring"],
    ["inner", "Inner ring"],
  ] as const) {
    const brandKey = key(`create-${ring}`);
    const name = `${QA_PREFIX}Create ${ring}`;

    await adminPage.goto("/dashboard/stack");
    await clearToasts(adminPage);
    await adminPage
      .getByRole("region", { name: label, exact: true })
      .getByRole("button", { name: "Add here" })
      .click();

    await saveEditor(adminPage, {
      name,
      brandKey,
      logoPath: "/images/stack-html5.svg",
    });
    await expect(adminPage.getByText(/added to the orbit/)).toBeVisible();

    const { data } = await db
      .from("stack_technologies")
      .select("*")
      .eq("brand_key", brandKey)
      .single<TechRow>();

    expect(data, `${ring} technology was not stored`).not.toBeNull();
    recorder.techIds.push((data as unknown as { id: string }).id);

    expect(data!.name).toBe(name);
    expect(data!.ring, "it landed on the wrong ring").toBe(ring);
    expect(data!.logo_path).toBe("/images/stack-html5.svg");
    expect(data!.enabled).toBe(true);
    expect(data!.icon_mode).toBe("original");
    expect(data!.manual_angle, "a new node should use automatic angles").toBe(
      false,
    );
    expect(data!.angle).toBeNull();
  }
});

test("CREATE: a manual angle is stored and honoured", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("manual-angle");

  await adminPage.goto("/dashboard/stack");
  await clearToasts(adminPage);
  await adminPage
    .getByRole("region", { name: "Inner ring", exact: true })
    .getByRole("button", { name: "Add here" })
    .click();

  await saveEditor(adminPage, {
    name: `${QA_PREFIX}Manual`,
    brandKey,
    logoPath: "/images/stack-html5.svg",
    manualAngle: true,
    angle: "137",
  });
  await expect(adminPage.getByText(/added to the orbit/)).toBeVisible();

  const { data } = await db
    .from("stack_technologies")
    .select("*")
    .eq("brand_key", brandKey)
    .single<TechRow & { id: string }>();
  recorder.techIds.push(data!.id);

  expect(data!.manual_angle).toBe(true);
  expect(Number(data!.angle)).toBe(137);

  // And the preview must place it at that angle, not a distributed one.
  const anchor = adminPage.locator(`[data-brand="${brandKey}"]`).first();
  await expect(anchor).toHaveAttribute("style", /--angle:\s*137deg/);
});

test("CREATE: an invalid angle is refused with a field error", async ({
  adminPage,
  db,
}) => {
  const brandKey = key("bad-angle");

  await adminPage.goto("/dashboard/stack");
  await clearToasts(adminPage);
  await adminPage
    .getByRole("region", { name: "Outer ring", exact: true })
    .getByRole("button", { name: "Add here" })
    .click();

  await saveEditor(adminPage, {
    name: `${QA_PREFIX}Bad angle`,
    brandKey,
    logoPath: "/images/stack-html5.svg",
    manualAngle: true,
    angle: "999",
  });

  await expect(adminPage.getByText(/fix the highlighted fields/i)).toBeVisible();

  const { data } = await db
    .from("stack_technologies")
    .select("id")
    .eq("brand_key", brandKey)
    .maybeSingle();
  expect(data, "an invalid angle was written to the database").toBeNull();
});

test("CREATE: a duplicate brand key is refused", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("dupe");

  const { data: existing, error } = await db
    .from("stack_technologies")
    .insert({
      name: `${QA_PREFIX}Existing`,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "outer",
      display_order: 900,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(existing.id);

  await adminPage.goto("/dashboard/stack");
  await clearToasts(adminPage);
  await adminPage
    .getByRole("region", { name: "Outer ring", exact: true })
    .getByRole("button", { name: "Add here" })
    .click();

  await saveEditor(adminPage, {
    name: `${QA_PREFIX}Duplicate`,
    brandKey,
    logoPath: "/images/stack-html5.svg",
  });

  // Reported in two places by design: a toast, and an error under the field.
  await expect(
    adminPage.locator(".dashToast").filter({
      hasText: /already used by another technology/i,
    }),
  ).toBeVisible();
  await expect(
    adminPage.locator(".dashError").filter({
      hasText: /already used by another technology/i,
    }),
  ).toBeVisible();

  const { count } = await db
    .from("stack_technologies")
    .select("id", { count: "exact", head: true })
    .eq("brand_key", brandKey);
  expect(count, "a duplicate brand key was stored").toBe(1);
});

test("READ: the admin sees disabled technologies that the public orbit hides", async ({
  adminPage,
  db,
  recorder,
  request,
}) => {
  const brandKey = key("hidden");
  const name = `${QA_PREFIX}Hidden`;

  const { data, error } = await db
    .from("stack_technologies")
    .insert({
      name,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "middle",
      display_order: 900,
      enabled: false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(data.id);

  await adminPage.goto("/dashboard/stack");
  await expect(
    adminPage.getByRole("listitem").filter({ hasText: name }),
    "a disabled technology is missing from the editor",
  ).toHaveCount(1);
  await expect(adminPage.getByText(`${brandKey} · hidden`)).toBeVisible();

  expect(
    await (await request.get("/")).text(),
    "a disabled technology reached the public orbit",
  ).not.toContain(name);
});

test("UPDATE: every editable field round-trips", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("update");
  const { data: created, error } = await db
    .from("stack_technologies")
    .insert({
      name: `${QA_PREFIX}Before`,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "outer",
      display_order: 900,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(created.id);

  const newKey = key("updated");
  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}Before` })
    .getByRole("button", { name: "Edit" })
    .click();

  await saveEditor(adminPage, {
    name: `${QA_PREFIX}After`,
    brandKey: newKey,
    logoPath: "/images/stack-python.svg",
    ring: "middle",
    iconMode: "White",
    background: "#6670FF",
  });
  await expect(adminPage.getByText(/Technology saved/)).toBeVisible();

  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (row) => row?.brand_key === newKey,
    "the technology update",
  );

  const { data } = await db
    .from("stack_technologies")
    .select("*")
    .eq("id", created.id)
    .single<TechRow>();

  expect(data!.name).toBe(`${QA_PREFIX}After`);
  expect(data!.brand_key).toBe(newKey);
  expect(data!.logo_path).toBe("/images/stack-python.svg");
  expect(data!.ring).toBe("middle");
  expect(data!.icon_mode).toBe("white");
  expect(data!.node_background?.toLowerCase()).toBe("#6670ff");

  // Survives a hard reload.
  await adminPage.reload();
  await expect(
    adminPage.getByRole("listitem").filter({ hasText: `${QA_PREFIX}After` }),
  ).toHaveCount(1);
});

test("UPDATE: turning manual placement off restores automatic distribution", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("auto-again");
  const { data: created, error } = await db
    .from("stack_technologies")
    .insert({
      name: `${QA_PREFIX}AutoAgain`,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "inner",
      display_order: 900,
      manual_angle: true,
      angle: 200,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(created.id);

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}AutoAgain` })
    .getByRole("button", { name: "Edit" })
    .click();

  // Toggling the checkbox off should clear the stored angle.
  await adminPage.getByText("Place this node manually").click();
  await clearToasts(adminPage);
  await adminPage.getByRole("button", { name: "Save technology" }).click();
  await expect(adminPage.getByText(/Technology saved/)).toBeVisible();

  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (row) => row?.manual_angle === false,
    "manual placement being turned off",
  );

  const { data } = await db
    .from("stack_technologies")
    .select("manual_angle,angle")
    .eq("id", created.id)
    .single<TechRow>();
  expect(data!.manual_angle).toBe(false);
  expect(data!.angle, "a stale manual angle was left behind").toBeNull();
});

test("REORDER: keyboard reordering persists display_order", async ({
  adminPage,
  db,
  recorder,
}) => {
  const made: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { data, error } = await db
      .from("stack_technologies")
      .insert({
        name: `${QA_PREFIX}Order${i}`,
        brand_key: key(`order-${i}`),
        logo_path: "/images/stack-html5.svg",
        ring: "inner",
        display_order: 900 + i,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    recorder.techIds.push(data.id);
    made.push(data.id);
  }

  await adminPage.goto("/dashboard/stack");
  const innerRing = adminPage.getByRole("region", {
    name: "Inner ring",
    exact: true,
  });
  const firstQaRow = innerRing
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}Order0` });

  // Grab with the keyboard and move down one place.
  const handle = firstQaRow.getByRole("button", { name: /^Reorder / });
  await handle.focus();
  await adminPage.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await adminPage.keyboard.press("ArrowDown");

  // The live region must name the row that moved, not the displaced one.
  await expect(
    innerRing.locator("[aria-live=polite]"),
  ).toContainText(`${QA_PREFIX}Order0 moved`);

  // The rows start at display_order 900+; a reorder renumbers the whole ring
  // from zero, so waiting for "not 900 any more" is what proves it landed.
  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    made[0],
    (row) => typeof row?.display_order === "number" && row.display_order < 100,
    "the keyboard reorder",
  );

  const { data: rows } = await db
    .from("stack_technologies")
    .select("id,display_order")
    .in("id", made);
  const order = new Map(
    (rows ?? []).map((r) => [r.id, r.display_order as number]),
  );
  expect(
    order.get(made[0])!,
    "the moved row did not end up after its neighbour",
  ).toBeGreaterThan(order.get(made[1])!);

  // And the new order survives a reload.
  await adminPage.reload();
  const qaRows = innerRing
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}Order` });
  // `toHaveCount` auto-waits for the reload; `allInnerTexts` does not.
  await expect(qaRows, "the QA rows are missing after a reload").toHaveCount(3);
  const names = await qaRows.allInnerTexts();
  expect(
    names[0],
    "after moving Order0 down, Order1 should lead the QA rows",
  ).toContain(`${QA_PREFIX}Order1`);
});

test("REORDER: a technology can be moved to another ring", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("ringmove");
  const { data: created, error } = await db
    .from("stack_technologies")
    .insert({
      name: `${QA_PREFIX}RingMove`,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "outer",
      display_order: 900,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(created.id);

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}RingMove` })
    .getByRole("combobox")
    .selectOption("inner");

  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (row) => row?.ring === "inner",
    "the ring move",
  );

  await adminPage.reload();
  await expect(
    adminPage
    .getByRole("region", { name: "Inner ring", exact: true })
      .getByRole("listitem")
      .filter({ hasText: `${QA_PREFIX}RingMove` }),
    "the node is not on the inner ring after a reload",
  ).toHaveCount(1);
});

test("DELETE: cancelling keeps the row, confirming removes it", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("delete");
  const name = `${QA_PREFIX}DeleteMe`;
  const { data: created, error } = await db
    .from("stack_technologies")
    .insert({
      name,
      brand_key: brandKey,
      logo_path: "/images/stack-html5.svg",
      ring: "middle",
      display_order: 900,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  recorder.techIds.push(created.id);

  await adminPage.goto("/dashboard/stack");
  const row = adminPage.getByRole("listitem").filter({ hasText: name });

  await row.getByRole("button", { name: "Remove" }).click();
  await expect(
    adminPage.getByRole("heading", { name: "Remove this technology?" }),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "Cancel" }).click();

  const { data: stillThere } = await db
    .from("stack_technologies")
    .select("id")
    .eq("id", created.id)
    .maybeSingle();
  expect(stillThere, "cancelling the dialog deleted the row anyway").not.toBeNull();

  await row.getByRole("button", { name: "Remove" }).click();
  await adminPage.getByRole("button", { name: "Remove", exact: true }).last().click();

  await waitForRow(
    db,
    "stack_technologies",
    created.id,
    (r) => r === null,
    "the technology delete",
  );
  await expect(
    adminPage.getByRole("listitem").filter({ hasText: name }),
  ).toHaveCount(0);
});

test("the preview pauses and resumes without changing the orbit's motion", async ({
  adminPage,
}) => {
  await adminPage.goto("/dashboard/stack");

  const orbit = adminPage.locator(".dashOrbitScale [role=img]");
  await expect(orbit).toHaveCount(1);

  // The public rotation is unchanged: all four rotors keep their durations
  // and directions.
  const motion = await orbit.evaluate((node) =>
    [...node.querySelectorAll('[class*="rotor"]')].map((r) => {
      const style = getComputedStyle(r);
      return `${style.animationDuration} ${style.animationDirection} ${style.animationName}`;
    }),
  );
  expect(motion).toHaveLength(4);
  expect(motion[0]).toContain("61s");
  expect(motion[1]).toContain("48s");
  expect(motion[2]).toContain("38s");
  expect(motion[3]).toContain("29s");

  await adminPage.getByRole("button", { name: "Pause" }).click();
  await expect(orbit).toHaveAttribute("data-paused", "true");
  expect(
    await orbit.evaluate(
      (n) =>
        getComputedStyle(n.querySelector('[class*="rotor"]')!).animationPlayState,
    ),
  ).toBe("paused");

  await adminPage.getByRole("button", { name: "Resume" }).click();
  await expect(orbit).not.toHaveAttribute("data-paused", "true");
  expect(
    await orbit.evaluate(
      (n) =>
        getComputedStyle(n.querySelector('[class*="rotor"]')!).animationPlayState,
    ),
  ).toBe("running");
});

test("capacity warnings appear only once a ring is genuinely full", async ({
  adminPage,
  db,
  recorder,
}) => {
  // The inner ring fits 9. Two are seeded, so seven more reach capacity.
  const rows = Array.from({ length: 7 }, (_, i) => ({
    name: `${QA_PREFIX}Cap${i}`,
    brand_key: key(`cap-${i}`),
    logo_path: "/images/stack-html5.svg",
    ring: "inner",
    display_order: 800 + i,
    enabled: true,
  }));

  const { data, error } = await db
    .from("stack_technologies")
    .insert(rows)
    .select();
  if (error) throw new Error(error.message);
  for (const row of data) recorder.techIds.push(row.id);

  await adminPage.goto("/dashboard/stack");
  await expect(
    adminPage.getByRole("status").filter({ hasText: "Inner ring holds 9 nodes" }),
    "the inner ring should warn at capacity",
  ).toBeVisible();
  await expect(adminPage.getByText(/It fits 9/)).toBeVisible();

  // Those seven extras also push the orbit past the twenty-one it is designed to
  // show, which is a separate warning from any single ring filling up.
  await expect(
    adminPage.getByRole("status").filter({ hasText: /designed for up to 21/ }),
    "going past twenty-one active technologies should warn",
  ).toBeVisible();

  // The outer ring stays below its capacity of 23, so it must
  // stay quiet — the previous constants warned here.
  await expect(adminPage.getByText(/Outer ring holds/)).toHaveCount(0);
});

/* --------------------------------------------------------------- logo fit --

   The framing editor stores three display-only numbers against an already
   uploaded logo. Nothing here should ever rewrite the file itself, and nothing
   should reach the database until "Save technology" is pressed.
   ------------------------------------------------------------------------ */

test("LOGO FIT: the editor appears only once a logo is set", async ({
  adminPage,
}) => {
  await adminPage.goto("/dashboard/stack");
  await clearToasts(adminPage);
  await adminPage
    .getByRole("region", { name: "Outer ring", exact: true })
    .getByRole("button", { name: "Add here" })
    .click();

  await expect(
    adminPage.getByRole("group", { name: "Logo fit" }),
    "the framing editor is offered with no logo to frame",
  ).toHaveCount(0);

  await adminPage
    .getByLabel("Logo", { exact: true })
    .fill("/images/stack-html5.svg");

  const fit = adminPage.getByRole("group", { name: "Logo fit" });
  await expect(fit).toBeVisible();
  // Every control is labelled, and the readouts start centred.
  await expect(fit.getByLabel("Zoom", { exact: true })).toBeVisible();
  await expect(fit.getByLabel("Horizontal position", { exact: true })).toBeVisible();
  await expect(fit.getByLabel("Vertical position", { exact: true })).toBeVisible();
  await expect(fit.getByRole("button", { name: "Reset fit" })).toBeVisible();
  await expect(fit).toContainText("100%");
});

test("LOGO FIT: zoom and position reach the live preview before anything is saved", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("fit-live");
  const created = await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitLive`,
    brand_key: brandKey,
    ring: "middle",
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitLive` })
    .getByRole("button", { name: "Edit" })
    .click();

  await setRange(adminPage, "Zoom", 185);
  await setRange(adminPage, "Horizontal position", -24);
  await setRange(adminPage, "Vertical position", 17);

  // Both previews follow immediately: the large editing circle, and the real
  // StackOrbit beside it.
  for (const scope of [".dashFit", ".dashOrbitScale"]) {
    const fit = await readNodeFit(adminPage, scope, brandKey);
    expect(fit, `${scope} did not follow the sliders`).toMatchObject({
      scale: "1.85",
      x: "-24",
      y: "17",
    });
    expect(fit.transform, `${scope} applied no offset transform`).not.toBe("none");
    expect(fit.imageTransform, `${scope} applied no zoom transform`).not.toBe(
      "none",
    );
  }

  await expect(adminPage.getByRole("group", { name: "Logo fit" })).toContainText(
    "185%",
  );

  // And none of it has been written yet.
  const { data } = await db
    .from("stack_technologies")
    .select("logo_scale,logo_offset_x,logo_offset_y")
    .eq("id", created.id)
    .single<TechRow>();
  expect(
    [
      Number(data!.logo_scale),
      Number(data!.logo_offset_x),
      Number(data!.logo_offset_y),
    ],
    "moving a slider wrote to the database before the save",
  ).toEqual([1, 0, 0]);
});

test("LOGO FIT: saved framing reaches the list, survives reload and reaches the public orbit", async ({
  adminPage,
  db,
  recorder,
  page,
}) => {
  const brandKey = key("fit-save");
  const created = await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitSave`,
    brand_key: brandKey,
    ring: "middle",
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitSave` })
    .getByRole("button", { name: "Edit" })
    .click();

  await saveEditor(adminPage, { zoom: 240, offsetX: 31, offsetY: -46 });
  await expect(adminPage.getByText(/Technology saved/)).toBeVisible();

  // Closing the editor reveals a dashboard row that must use the same latest
  // fit as the editor and public orbit, rather than a separate raw <img>.
  expect(await readNodeFit(adminPage, ".dashList", brandKey)).toMatchObject({
    scale: "2.4",
    x: "31",
    y: "-46",
  });

  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (row) => Number(row?.logo_scale) === 2.4,
    "the logo fit save",
  );

  const { data } = await db
    .from("stack_technologies")
    .select("logo_path,logo_scale,logo_offset_x,logo_offset_y")
    .eq("id", created.id)
    .single<TechRow>();

  expect(Number(data!.logo_scale)).toBe(2.4);
  expect(Number(data!.logo_offset_x)).toBe(31);
  expect(Number(data!.logo_offset_y)).toBe(-46);
  expect(
    data!.logo_path,
    "the stored logo path was rewritten by a framing change",
  ).toBe("/images/stack-html5.svg");

  // The dashboard restores the exact framing after a hard reload.
  await adminPage.reload();
  expect(await readNodeFit(adminPage, ".dashList", brandKey)).toMatchObject({
    scale: "2.4",
    x: "31",
    y: "-46",
  });
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitSave` })
    .getByRole("button", { name: "Edit" })
    .click();

  const editor = adminPage.getByRole("group", { name: "Logo fit" });
  await expect(editor.getByLabel("Zoom", { exact: true })).toHaveValue("240");
  await expect(
    editor.getByLabel("Horizontal position", { exact: true }),
  ).toHaveValue("31");
  await expect(
    editor.getByLabel("Vertical position", { exact: true }),
  ).toHaveValue("-46");
  expect(
    await readNodeFit(adminPage, ".dashOrbitScale", brandKey),
  ).toMatchObject({ scale: "2.4", x: "31", y: "-46" });

  // And the homepage renders the same numbers, through the same shared layer.
  await page.goto("/");
  expect(
    await readNodeFit(page, "[role=img][aria-label*=orbiting]", brandKey),
    "the public orbit is not emitting the saved transform",
  ).toMatchObject({ scale: "2.4", x: "31", y: "-46" });
});

test("LOGO FIT: dragging inside the circle repositions the logo", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("fit-drag");
  await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitDrag`,
    brand_key: brandKey,
    ring: "inner",
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitDrag` })
    .getByRole("button", { name: "Edit" })
    .click();

  const circle = adminPage.locator(`.dashFit [data-brand="${brandKey}"] > div`);
  // The editor can open above the current scroll position on a long stack
  // page. Bring the real drag surface into view before using viewport mouse
  // coordinates; otherwise Chromium correctly sends the drag to no element.
  await circle.scrollIntoViewIfNeeded();
  const box = await circle.boundingBox();
  expect(box, "the framing preview is not rendered").not.toBeNull();

  // A quarter of the circle to the right is, by definition, +25 units.
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await adminPage.mouse.move(startX, startY);
  await adminPage.mouse.down();
  await adminPage.mouse.move(startX + box!.width / 4, startY, { steps: 8 });
  await adminPage.mouse.up();

  const dragged = await readNodeFit(adminPage, ".dashFit", brandKey);
  expect(Number(dragged.x), "a drag right did not move the logo right").toBe(25);
  expect(Number(dragged.y), "a horizontal drag moved the logo vertically").toBe(0);

  // The sliders are the same state, so they show what the drag produced.
  await expect(
    adminPage.getByLabel("Horizontal position", { exact: true }),
  ).toHaveValue("25");

  // Reset puts it back to the centred default.
  await adminPage.getByRole("button", { name: "Reset fit" }).click();
  expect(await readNodeFit(adminPage, ".dashFit", brandKey)).toMatchObject({
    scale: "1",
    x: "0",
    y: "0",
  });
});

test("LOGO FIT: the sliders are a complete keyboard alternative to dragging", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("fit-keys");
  await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitKeys`,
    brand_key: brandKey,
    ring: "inner",
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitKeys` })
    .getByRole("button", { name: "Edit" })
    .click();

  const zoom = adminPage.getByLabel("Zoom", { exact: true });
  await zoom.focus();
  // Focus must be visible, not merely present.
  const focusRing = await zoom.evaluate((element) => {
    const style = getComputedStyle(element);
    return parseFloat(style.outlineWidth) > 0 || style.boxShadow !== "none";
  });
  expect(focusRing, "a focused slider shows no focus indicator").toBe(true);

  await adminPage.keyboard.press("ArrowRight");
  await adminPage.keyboard.press("ArrowRight");
  await expect(zoom, "the zoom slider does not step by 5%").toHaveValue("110");

  const horizontal = adminPage.getByLabel("Horizontal position", { exact: true });
  await horizontal.focus();
  await adminPage.keyboard.press("ArrowLeft");
  await expect(horizontal).toHaveValue("-1");

  await adminPage.keyboard.press("Home");
  await expect(horizontal, "Home does not reach the minimum").toHaveValue("-100");
  await adminPage.keyboard.press("End");
  await expect(horizontal, "End does not reach the maximum").toHaveValue("100");

  expect(await readNodeFit(adminPage, ".dashFit", brandKey)).toMatchObject({
    scale: "1.1",
    x: "100",
  });
});

test("LOGO FIT: replacing the logo starts from the centred default", async ({
  adminPage,
  db,
  recorder,
}) => {
  const brandKey = key("fit-replace");
  await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitReplace`,
    brand_key: brandKey,
    ring: "middle",
    logo_scale: 3,
    logo_offset_x: 40,
    logo_offset_y: -40,
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitReplace` })
    .getByRole("button", { name: "Edit" })
    .click();

  await expect(adminPage.getByLabel("Zoom", { exact: true })).toHaveValue("300");

  await adminPage
    .getByLabel("Logo", { exact: true })
    .fill("/images/stack-python.svg");

  await expect(
    adminPage.getByLabel("Zoom", { exact: true }),
    "a new image inherited the previous image framing",
  ).toHaveValue("100");
  await expect(
    adminPage.getByLabel("Horizontal position", { exact: true }),
  ).toHaveValue("0");
  await expect(
    adminPage.getByLabel("Vertical position", { exact: true }),
  ).toHaveValue("0");
});

test("LOGO FIT: a Supabase-uploaded PNG renders and frames like any other logo", async ({
  adminPage,
  db,
  recorder,
}) => {
  const objectName = `${QA_PREFIX}fit-remote.png`;
  const { error: uploadError } = await db.storage
    .from("stack-logos")
    .upload(objectName, REAL_PNG, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  recorder.objects.push(["stack-logos", objectName]);

  const {
    data: { publicUrl },
  } = db.storage.from("stack-logos").getPublicUrl(objectName);
  expect(publicUrl).toContain("/storage/v1/object/public/stack-logos/");

  const brandKey = key("fit-remote");
  const created = await seedTech(db, recorder, {
    name: `${QA_PREFIX}FitRemote`,
    brand_key: brandKey,
    ring: "middle",
    logo_path: publicUrl,
  });

  await adminPage.goto("/dashboard/stack");
  await adminPage
    .getByRole("listitem")
    .filter({ hasText: `${QA_PREFIX}FitRemote` })
    .getByRole("button", { name: "Edit" })
    .click();

  // The remote file actually decodes inside the circular node.
  const image = adminPage.locator(`.dashFit [data-brand="${brandKey}"] img`);
  await expect(image).toHaveAttribute("src", publicUrl);
  await expect
    .poll(
      () =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      { message: "the uploaded PNG never decoded in the framing preview" },
    )
    .toBeGreaterThan(0);

  await saveEditor(adminPage, { zoom: 160, offsetX: -18, offsetY: 12 });
  await expect(adminPage.getByText(/Technology saved/)).toBeVisible();

  await waitForRow<TechRow>(
    db,
    "stack_technologies",
    created.id,
    (row) => Number(row?.logo_scale) === 1.6,
    "the remote logo framing",
  );

  const { data } = await db
    .from("stack_technologies")
    .select("logo_path,logo_scale,logo_offset_x,logo_offset_y")
    .eq("id", created.id)
    .single<TechRow>();

  expect(
    data!.logo_path,
    "framing a remote logo uploaded a second copy instead of storing numbers",
  ).toBe(publicUrl);
  expect([
    Number(data!.logo_scale),
    Number(data!.logo_offset_x),
    Number(data!.logo_offset_y),
  ]).toEqual([1.6, -18, 12]);
});

test("LOGO FIT: every seeded technology keeps the centred default", async ({
  db,
}) => {
  const { data, error } = await db
    .from("stack_technologies")
    .select("brand_key,logo_scale,logo_offset_x,logo_offset_y")
    .not("brand_key", "like", `${QA_PREFIX}%`);
  if (error) throw new Error(error.message);

  expect(
    (data ?? []).length,
    "the seeded technologies are missing",
  ).toBeGreaterThanOrEqual(21);

  for (const row of data ?? []) {
    expect(
      [
        Number(row.logo_scale),
        Number(row.logo_offset_x),
        Number(row.logo_offset_y),
      ],
      `${row.brand_key} did not keep the centred default`,
    ).toEqual([1, 0, 0]);
  }
});
