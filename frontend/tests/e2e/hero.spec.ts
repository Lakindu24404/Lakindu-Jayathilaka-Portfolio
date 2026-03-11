import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The hero regression suite.
 *
 * A `HeroBackdrop` layer once stretched a black-backed ink video over the whole
 * of `#home`. Nothing rendered underneath it changed, so the DOM still looked
 * correct and every reduced-motion check still passed — the layer only draws
 * when motion is allowed. What it actually did was paint `--color-ink` (pure
 * black) headline text onto a black background, which is why "Hi, I'm Lakindu!"
 * read as missing rather than as broken.
 *
 * These tests therefore run with motion *enabled*, which is the only state that
 * can see the regression, and they assert on what a visitor sees: no video in
 * the hero, nothing opaque covering it, and a heading that finishes its reveal
 * fully visible.
 */

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

/** 1500ms holding the curtain, 900ms rolling it up, then room for the reveal. */
const AFTER_SPLASH_MS = 4000;

/** `SplashScreen` drops the overlay out of the tree once the curtain lifts. */
async function waitForSplash(page: Page) {
  await page.waitForTimeout(AFTER_SPLASH_MS);
}

/**
 * The colour a visitor actually sees behind the hero: the first ancestor that
 * paints, since `#home` itself is transparent over the white page.
 */
async function heroBackdropColour(page: Page) {
  return page.evaluate(() => {
    let node: Element | null = document.querySelector("#home");
    while (node) {
      const colour = getComputedStyle(node).backgroundColor;
      if (colour && colour !== "transparent" && !colour.startsWith("rgba(0, 0, 0, 0)")) {
        return colour;
      }
      node = node.parentElement;
    }
    return "none";
  });
}

/**
 * Any descendant of the hero that covers it wholesale and paints an opaque
 * colour of its own — which is exactly the shape of the layer that regressed.
 */
async function opaqueHeroCovers(page: Page) {
  return page.evaluate(() => {
    const home = document.querySelector("#home");
    if (!home) return ["#home is missing"];
    const area = home.getBoundingClientRect();
    const offenders: string[] = [];

    for (const element of home.querySelectorAll("*")) {
      const box = element.getBoundingClientRect();
      const coverage =
        (box.width * box.height) / Math.max(1, area.width * area.height);
      if (coverage < 0.9) continue;

      const style = getComputedStyle(element);
      if (style.opacity === "0" || style.visibility === "hidden") continue;

      const colour = style.backgroundColor;
      const transparent =
        colour === "transparent" || colour.startsWith("rgba(0, 0, 0, 0)");
      const white =
        colour === "rgb(255, 255, 255)" || colour === "rgba(255, 255, 255, 1)";
      if (transparent || white) continue;

      offenders.push(`${element.tagName.toLowerCase()}.${element.className} -> ${colour}`);
    }
    return offenders;
  });
}

for (const [name, viewport] of [
  ["desktop", DESKTOP],
  ["mobile", MOBILE],
] as const) {
  test(`hero renders on a clean white background with no video (${name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/");
    await waitForSplash(page);

    // The video and the layer that carried it are gone.
    await expect(page.locator("#home video")).toHaveCount(0);
    expect(await opaqueHeroCovers(page)).toEqual([]);
    expect(await heroBackdropColour(page)).toBe("rgb(255, 255, 255)");

    // The heading is present, correct and readable.
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Hi, I'm Lakindu!");
    await expect(heading).toHaveCSS("opacity", "1");

    // Every word finishes its reveal fully opaque, whatever the scroll state.
    const words = heading.locator("[data-heading-reveal-word]");
    await expect(words).toHaveCount(4);
    await expect
      .poll(async () =>
        words.evaluateAll((elements) =>
          Math.min(...elements.map((element) => Number(getComputedStyle(element).opacity))),
        ),
      )
      .toBeGreaterThan(0.99);

    // The role line still sits under the greeting.
    const role = page.getByText("Frontend Developer", { exact: true }).first();
    await expect(role).toBeVisible();
    const [headingBox, roleBox] = await Promise.all([
      heading.boundingBox(),
      role.boundingBox(),
    ]);
    expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(roleBox!.y + 1);

    // Nothing broke on the way there.
    expect(consoleErrors, `console/page errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(failedRequests, `failed requests: ${failedRequests.join(" | ")}`).toEqual([]);
  });
}

test("the retired hero video files are no longer served", async ({ page }) => {
  for (const path of ["/videos/hero-ink-360.mp4", "/videos/hero-ink-720.mp4"]) {
    const response = await page.request.get(path);
    expect(response.status(), `${path} should not exist`).toBe(404);
  }
});
