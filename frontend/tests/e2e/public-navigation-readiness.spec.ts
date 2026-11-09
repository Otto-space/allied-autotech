import { test, expect } from "@playwright/test";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`public navigation ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test("navigation is honest while scripts load and opens with the first ready activation", async ({
      page,
    }, info) => {
      const errors: string[] = [];
      const writes: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/**", (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() !== "GET") writes.push(path);
        return path === "/api/v1/public/capabilities"
          ? route.fulfill({
              json: {
                success: true,
                data: publicCapabilitiesFixture("browse_enquiries"),
                meta: { requestId: "navigation-readiness" },
              },
            })
          : route.fulfill({
              status: 401,
              json: { success: false, error: { code: "UNAUTHORIZED" } },
            });
      });
      let release!: () => void;
      const scriptsReady = new Promise<void>((resolve) => (release = resolve));
      let delayedScripts = 0;
      await page.route("**/_next/static/**", async (route) => {
        if (route.request().resourceType() === "script") {
          delayedScripts++;
          await scriptsReady;
        }
        await route.continue();
      });
      try {
        await page.goto("/help", { waitUntil: "commit" });
        const opener = page.getByRole("button", { name: "Open navigation", exact: true });
        if (width <= 1050) {
          await expect(opener).toBeVisible();
          await expect(opener).toBeDisabled();
          await expect(opener).toHaveAttribute("aria-busy", "true");
          await expect(
            page.getByRole("dialog", { name: "Mobile navigation" }),
          ).toHaveCount(0);
        } else {
          await expect(opener).not.toBeVisible();
          await expect(
            page
              .getByRole("navigation", { name: "Primary navigation", exact: true })
              .getByRole("link", { name: "Shop", exact: true }),
          ).toBeVisible();
        }
        await expect.poll(() => delayedScripts).toBeGreaterThan(0);
        release();
        if (width <= 1050) {
          await expect(opener).toBeEnabled();
          await expect(opener).toHaveAttribute("aria-busy", "false");
          if (width <= 768) await opener.tap();
          else await opener.click();
          const menu = page.getByRole("dialog", {
            name: "Mobile navigation",
            exact: true,
          });
          await expect(menu).toBeVisible();
          await expect(page.locator(".mobile-menu-button")).toHaveAttribute(
            "aria-expanded",
            "true",
          );
          expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
          await menu.getByRole("link", { name: "Shop", exact: true }).focus();
          await page.screenshot({ path: info.outputPath("ready-navigation.png") });
          await page.keyboard.press("Escape");
          await expect(menu).toHaveCount(0);
          await expect(opener).toBeFocused();
          expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
            "hidden",
          );
        }
        expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
          width,
          height,
        ]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        expect(writes).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        release();
      }
    });
  });
}

for (const width of [320, 1280]) {
  test.describe(`public navigation without JavaScript ${width}px`, () => {
    test.use({ javaScriptEnabled: false, viewport: { width, height: 720 } });
    test("primary destinations remain usable without a scripted menu", async ({
      page,
    }, info) => {
      await page.goto("/help");
      const navigation = page.getByRole("navigation", {
        name: "Primary navigation",
        exact: true,
      });
      await expect(navigation).toHaveCount(1);
      await expect(navigation.getByRole("link")).toHaveCount(7);
      for (const link of await navigation.getByRole("link").all()) {
        await expect(link).toBeVisible();
        // The new touch fallback uses 44px targets; preserve existing 40px desktop links.
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(
          width <= 1050 ? 44 : 24,
        );
      }
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([width, 720]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("navigation-without-javascript.png"),
      });
      await navigation.getByRole("link", { name: "Shop", exact: true }).click();
      await expect(page).toHaveURL(/\/parts$/);
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
      ).toBeVisible();
    });
  });
}
