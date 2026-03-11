import { expect, test } from "./fixtures";

async function haveSettled(elements: import("@playwright/test").Locator) {
  return elements.evaluateAll((nodes) =>
    nodes.length > 0 && nodes.every((node) => {
      const style = getComputedStyle(node);
      const matrix = style.transform === "none" ? new DOMMatrix() : new DOMMatrix(style.transform);
      return (
        Number(style.opacity) > 0.99 &&
        Math.abs(matrix.a - 1) < 0.001 &&
        Math.abs(matrix.b) < 0.001 &&
        Math.abs(matrix.c) < 0.001 &&
        Math.abs(matrix.d - 1) < 0.001 &&
        Math.abs(matrix.e) < 0.1 &&
        Math.abs(matrix.f) < 0.1
      );
    }),
  );
}

test("key typography reveals when its section enters the viewport", async ({
  page,
}) => {
  await page.goto("/");

  const hero = page.locator('#home h1 [data-heading-reveal-word]');
  await expect.poll(() => haveSettled(hero)).toBe(true);

  const stackHeading = page.locator(
    '#stack h2 [data-heading-reveal-word]',
  );
  await stackHeading.first().scrollIntoViewIfNeeded();
  await expect.poll(() => haveSettled(stackHeading)).toBe(true);

  const stackCopy = page.locator(
    '#stack p [data-text-reveal="copy"] > span',
  );
  await expect.poll(() => haveSettled(stackCopy)).toBe(true);
});

test("reduced motion leaves every revealed text block immediately readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const animatedText = page.locator(
    '[data-heading-reveal-word], [data-text-reveal="copy"] > span',
  );
  expect(await animatedText.count()).toBeGreaterThan(0);
  const styles = await animatedText.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { opacity: style.opacity, transform: style.transform };
    }),
  );

  for (const style of styles) {
    expect(style.opacity).toBe("1");
    expect(style.transform).toBe("none");
  }
});

test("every visitor-facing homepage heading uses the shared word reveal", async ({
  page,
}) => {
  await page.goto("/");

  const headings = page.locator("main h1, main h2, main h3");
  expect(await headings.count()).toBeGreaterThan(0);
  expect(
    await headings.evaluateAll((nodes) =>
      nodes.every((node) => node.querySelector("[data-heading-reveal-word]")),
    ),
  ).toBeTruthy();
});
