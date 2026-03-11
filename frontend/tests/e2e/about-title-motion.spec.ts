import { expect, test } from "./fixtures";

test("About title reveal follows scroll progress with a word stagger", async ({ page }) => {
  await page.goto("/");

  const title = page.locator("[data-about-scroll-title]");
  const words = page.locator("[data-about-title-word]");
  await expect(title).toBeVisible();
  await expect(words).toHaveCount(5);

  const titleTop = await title.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  );
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  await page.evaluate(
    ({ top, height }) => window.scrollTo(0, Math.max(0, top - height - 30)),
    { top: titleTop, height: viewportHeight },
  );
  await page.waitForTimeout(350);
  const before = await words.evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).opacity)),
  );

  await page.evaluate(
    ({ top, height }) => window.scrollTo(0, top - height * 0.72),
    { top: titleTop, height: viewportHeight },
  );
  await page.waitForTimeout(220);
  const during = await words.evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).opacity)),
  );

  expect(before.every((opacity) => opacity < 0.08)).toBeTruthy();
  expect(during[0]).toBeGreaterThan(during[during.length - 1]);
  expect(during[0]).toBeGreaterThan(before[0]);

  await page.evaluate(
    ({ top, height }) => window.scrollTo(0, top - height * 0.25),
    { top: titleTop, height: viewportHeight },
  );
  await page.waitForTimeout(450);
  const after = await words.evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).opacity)),
  );
  expect(after.every((opacity) => opacity > 0.9)).toBeTruthy();
});

test("About title is static when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("[data-about-scroll-title]")).toHaveCSS("opacity", "1");
  const words = page.locator("[data-about-title-word]");
  await expect(words).toHaveCount(5);
  expect(
    await words.evaluateAll((elements) =>
      elements.every((element) => getComputedStyle(element).opacity === "1"),
    ),
  ).toBeTruthy();
});
