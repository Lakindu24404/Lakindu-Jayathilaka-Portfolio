import { expect, test } from "./fixtures";

test("refreshing the clean homepage URL always returns to Home", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.reload();

  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "the browser restored the previous Projects scroll position",
    })
    .toBeLessThan(2);
});

test("an explicit Projects deep link is still respected", async ({ page }) => {
  await page.goto("/#projects");

  await expect
    .poll(() =>
      page.locator("#projects h2").evaluate((heading) =>
        Math.round(heading.getBoundingClientRect().top),
      ),
    )
    .toBeLessThan(300);
  await expect(page).toHaveURL(/#projects$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("refreshing a homepage Projects hash retires it and returns to Home", async ({
  page,
}) => {
  await page.goto("/#projects");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.reload();

  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: "the refreshed #projects URL did not return to Home",
    })
    .toBeLessThan(2);
  await expect(page).toHaveURL(/\/$/);
});
