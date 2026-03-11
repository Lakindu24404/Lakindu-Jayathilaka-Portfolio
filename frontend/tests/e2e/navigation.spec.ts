import { expect, test } from "@playwright/test";

async function sectionTop(
  page: import("@playwright/test").Page,
  selector: string,
) {
  return page.locator(selector).evaluate((element) => {
    const top = Math.round(element.getBoundingClientRect().top);
    return Math.abs(top) < 1 ? 0 : top;
  });
}

test("desktop navbar jumps to its section in the click event", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForFunction(() => "__lenis" in window);

  const approach = page.locator('header a[href="/#services"]:visible');
  await approach.click();

  await expect(approach).toHaveAttribute("aria-current", "location");
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await sectionTop(page, "#services")).toBe(0);

  await expect(page).toHaveURL(/\/$/);
});

test("successive navbar clicks jump directly to the latest section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForFunction(() => "__lenis" in window);

  await page.locator('header a[href="/#projects"]:visible').click();
  expect(await sectionTop(page, "#projects")).toBe(0);
  const about = page.locator('header a[href="/#about"]:visible');
  await about.click();

  await expect(about).toHaveAttribute("aria-current", "location");
  expect(await sectionTop(page, "#about")).toBe(0);
});

test("mobile menu closes as its section scroll begins", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => "__lenis" in window);

  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  const approach = page.locator('header a[href="/#services"]:visible');
  await approach.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await sectionTop(page, "#services")).toBe(0);
});

test("reduced motion turns navbar travel into an immediate jump", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForFunction(
    () => document.documentElement.dataset.navigationReady === "true",
  );

  await page.locator('header a[href="/#services"]:visible').click();
  expect(await sectionTop(page, "#services")).toBe(0);
});

test("Approach and Projects fully cover the previous section at every breakpoint", async ({
  page,
}) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 834, height: 1112 },
    { width: 390, height: 844 },
  ];

  const sectionAtViewportTop = () =>
    page.evaluate(() =>
      document
        .elementsFromPoint(window.innerWidth / 2, 8)
        .map((element) => element.closest("section")?.id)
        .find(Boolean),
    );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForFunction(
      () => document.documentElement.dataset.navigationReady === "true",
    );

    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    await page.locator('header a[href="/#services"]:visible').click();
    expect(await sectionTop(page, "#services")).toBe(0);
    expect(await sectionAtViewportTop()).toBe("services");

    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    await page.locator('header a[href="/#projects"]:visible').click();
    expect(await sectionTop(page, "#projects")).toBe(0);
    expect(await sectionAtViewportTop()).toBe("projects");
  }
});
