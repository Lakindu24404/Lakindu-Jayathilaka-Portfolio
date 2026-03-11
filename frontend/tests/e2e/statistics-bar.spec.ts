import { expect, test } from "./fixtures";

test("statistics bar follows the services showcase and responds like the reference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const showcase = page.locator("#creative-services");
  const bar = page.getByLabel("Selected career statistics");
  const stats = bar.locator("li");

  expect(await stats.count()).toBe(4);
  await expect(stats.nth(0)).toHaveAccessibleName("4+ years in web development");
  await expect(stats.nth(3)).toHaveAccessibleName("15+ events organised");
  await expect(stats.nth(0)).toHaveCSS("align-items", "center");
  await expect(stats.nth(0)).toHaveCSS("text-align", "center");

  const order = await page.locator("#creative-services, section[aria-label='Selected career statistics'], #stack")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("id") || node.getAttribute("aria-label")));
  expect(order).toEqual([
    "creative-services",
    "statistics",
    "stack",
  ]);

  await bar.scrollIntoViewIfNeeded();
  await expect.poll(() => stats.nth(0).locator("span").first().evaluate((node) => {
    const transform = getComputedStyle(node).transform;
    return transform === "none" || Math.abs(new DOMMatrix(transform).m42) < 0.1;
  })).toBe(true);

  const desktopTop = await stats.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  expect(new Set(desktopTop).size).toBe(1);

  await page.setViewportSize({ width: 390, height: 800 });
  const mobileTop = await stats.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  expect(mobileTop[0]).toBe(mobileTop[1]);
  expect(mobileTop[2]).toBe(mobileTop[3]);
  expect(mobileTop[2]).toBeGreaterThan(mobileTop[0]);

  await expect(showcase).toBeAttached();
});

test("reduced motion keeps every statistic immediately readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const bar = page.getByLabel("Selected career statistics");
  await bar.scrollIntoViewIfNeeded();

  await expect(bar).toContainText("4+");
  await expect(bar).toContainText("15+");
  const visualStates = await bar.locator("li span").evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { opacity: style.opacity, transform: style.transform };
    }),
  );

  for (const state of visualStates) {
    expect(state.opacity).toBe("1");
    expect(state.transform).toBe("none");
  }
});
