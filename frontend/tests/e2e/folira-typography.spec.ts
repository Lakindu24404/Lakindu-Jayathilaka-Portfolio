import { expect, test } from "./fixtures";

const routes = [
  "/",
  "/bambinoo",
  "/legal/privacy-policy",
  "/legal/cookie-policy",
  "/licensing",
  "/sign-in",
  "/sign-up",
  "/404",
  "/dashboard/login",
];

test("every page uses Folira's Geist family except the Stack serif accent", async ({
  page,
}) => {
  for (const route of routes) {
    await page.goto(route);
    const styles = await page
      .locator("h1,h2,h3,h4,p,a,button,label,input,textarea,select,em")
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const style = getComputedStyle(element);
            return {
              text: (element.textContent || element.getAttribute("placeholder") || "")
                .trim()
                .slice(0, 60),
              family: style.fontFamily,
              weight: Number(style.fontWeight),
              stackAccent: element.hasAttribute("data-stack-accent"),
            };
          }),
      );

    const wrongFamily = styles.filter(
      ({ family, stackAccent }) =>
        !stackAccent && !family.toLowerCase().includes("geist"),
    );
    const wrongWeight = styles.filter(
      ({ weight, stackAccent }) =>
        !stackAccent && Number.isFinite(weight) && (weight < 400 || weight > 600),
    );

    expect(wrongFamily, `${route} contains text outside the Geist system`).toEqual([]);
    expect(wrongWeight, `${route} contains a weight Folira does not use`).toEqual([]);
  }
});

test("only the word stack restores the previous serif treatment", async ({ page }) => {
  await page.goto("/");
  const accent = page.locator("[data-stack-accent]");

  await expect(accent).toHaveText("stack");
  await expect(accent).toHaveCSS("font-weight", "700");
  await expect(accent).toHaveCSS("font-style", "italic");
  expect((await accent.evaluate((element) => getComputedStyle(element).fontFamily)).toLowerCase())
    .toContain("pt serif");
});

test("desktop and mobile display scales match the measured Folira tokens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator("#home h1")).toHaveCSS("font-size", "60px");
  await expect(page.locator("#home h1")).toHaveCSS("font-weight", "600");
  await expect(page.locator("#projects h2")).toHaveCSS("font-size", "60px");

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator("#home h1")).toHaveCSS("font-size", "36px");
  await expect(page.locator("#projects h2")).toHaveCSS("font-size", "34px");
  await expect(page.locator("#stack h2")).toHaveCSS("font-size", "34px");
  await expect(page.locator("#services h2")).toHaveCSS("font-size", "34px");
});
