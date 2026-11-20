import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/mfa";

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`MFA secondary actions ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 430,
      reducedMotion: "reduce",
    });
    test("method choice and authenticator recovery remain distinct and reachable", async ({
      page,
    }, info) => {
      const state = await fixture(page);
      await page.goto("/mfa");
      await page.getByRole("button", { name: "Authenticator", exact: true }).click();
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      const choose = page.getByRole("button", {
        name: "Choose another method",
        exact: true,
      });
      const replace = page.getByRole("button", {
        name: "Set up authenticator again",
        exact: true,
      });
      await replace.scrollIntoViewIfNeeded();
      const first = (await choose.boundingBox())!;
      const second = (await replace.boundingBox())!;
      const gap =
        Math.abs(first.y - second.y) < 2
          ? second.x - first.x - first.width
          : second.y - first.y - first.height;
      expect(gap).toBeGreaterThanOrEqual(4);
      for (const box of [first, second]) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await choose.focus();
      await page.keyboard.press("Tab");
      await expect(replace).toBeFocused();
      await expect(replace).toBeInViewport();
      await page.screenshot({ path: info.outputPath("mfa-secondary-actions.png") });
      await choose.click();
      await expect(
        page.getByRole("button", { name: "Authenticator", exact: true }),
      ).toBeFocused();
      await replace.click();
      await expect(page.getByText(/Verify with a saved recovery code/)).toBeVisible();
      await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
      expect(state.writes.filter((write) => write.endpoint.endsWith("/verify"))).toEqual(
        [],
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    });
  });
}
