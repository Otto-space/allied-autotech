import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/security";

const sizes = [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
];
async function rect(page: Page) {
  const dock = page.locator(".support-controls");
  await expect(dock).toHaveCount(1);
  await expect(dock).toBeVisible();
  return dock.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
async function unavailableHelp(page: Page) {
  await page.route("**/api/v1/learning/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
    }),
  );
}
for (const [width, height] of sizes)
  test.describe(`shared shell ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      // Firefox has no isMobile emulation; retain the exact responsive viewport.
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
      test(`${role} retains anchored utilities, one dock and accessible recovery`, async ({
        page,
      }, info) => {
        const state = await fixture(page, role);
        await unavailableHelp(page);
        await page.goto(role === "CUSTOMER" ? "/dashboard/security" : "/admin/security");
        const toolbar = page.locator(".dashboard-top");
        await expect(toolbar).toBeVisible();
        expect(
          await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
        ).toEqual({ width, height });
        await expect(
          toolbar.getByRole("button", { name: "Ask Allie", exact: true }),
        ).toHaveCount(0);
        await expect(
          toolbar.getByRole("button", { name: "Sign out", exact: true }),
        ).toHaveCount(0);
        await page.evaluate(() => scrollTo(0, 0));
        const initialHeaderTop = (await toolbar.boundingBox())!.y;
        const dockInitial = await rect(page);
        for (const y of [500, 900, 0]) {
          await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
          await expect
            .poll(async () => Math.round((await toolbar.boundingBox())!.y))
            .toBe(y === 0 ? Math.round(initialHeaderTop) : width <= 900 ? 72 : 0);
          expect(await rect(page)).toEqual(dockInitial);
        }
        const account = page.locator(".dashboard-account-menu summary");
        await account.click();
        const profile = page
          .getByRole("navigation", { name: "Your account" })
          .getByRole("link", { name: "My profile", exact: true });
        await expect(profile).toHaveAttribute(
          "href",
          role === "CUSTOMER" ? "/dashboard/profile" : "/admin/profile",
        );
        const popover = await profile.boundingBox();
        expect(popover!.x).toBeGreaterThanOrEqual(0);
        expect(popover!.x + popover!.width).toBeLessThanOrEqual(width);
        await page.keyboard.press("Escape");
        await expect(account).toBeFocused();
        const bell = page.getByRole("button", { name: /^Open notifications/ });
        await bell.click();
        const notice = page.getByRole("dialog", { name: "Notifications", exact: true });
        await expect(notice).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(bell).toBeFocused();
        if (width <= 900) {
          const open = page.getByRole("button", { name: "Open dashboard navigation" });
          await open.click();
          const drawer = page.getByRole("dialog", {
            name: "Dashboard navigation",
            exact: true,
          });
          await expect(
            drawer.getByRole("button", { name: "Sign out", exact: true }),
          ).toBeVisible();
          await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
          await drawer.getByRole("button", { name: "Sign out", exact: true }).focus();
          await page.keyboard.press("Tab");
          expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(
            true,
          );
          await page.keyboard.press("Escape");
          await expect(open).toBeFocused();
          await expect(drawer).not.toBeVisible();
        } else {
          await page
            .getByRole("button", { name: "Collapse sidebar", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Expand sidebar", exact: true }),
          ).toHaveAttribute("aria-expanded", "false");
          await expect(
            page.getByRole("button", { name: "Sign out", exact: true }),
          ).toHaveCount(1);
          await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
        }
        const ask = page
          .locator(".support-controls")
          .getByRole("button", { name: "Ask Allie", exact: true });
        await ask.click();
        const help = page.getByRole("dialog", { name: "Allie", exact: true });
        await expect(help).toBeVisible();
        await expect(help.getByRole("link", { name: /Help Centre/ })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(ask).toBeFocused();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        expect(state.writes).toEqual([]);
        if (role === "CUSTOMER") {
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.screenshot({ path: info.outputPath("dashboard-shell.png") });
        }
      });
    test("Home dock stays the same through hero, sections, footer, menu and help", async ({
      page,
    }, info) => {
      await page.route("**/api/v1/**", (route) =>
        route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        }),
      );
      await unavailableHelp(page);
      await page.goto("/");
      await expect(page.locator(".support-controls")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const initial = await rect(page);
      const samples = [];
      for (const fraction of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
        await page.evaluate(
          (f) =>
            scrollTo({
              top: (document.documentElement.scrollHeight - innerHeight) * f,
              behavior: "instant",
            }),
          fraction,
        );
        const r = await rect(page);
        samples.push({ fraction, ...r });
        expect(r).toEqual(initial);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width);
        expect(r.y + r.height).toBeLessThanOrEqual(height);
      }
      const labels = page.locator(".support-control-label:visible");
      for (const label of await labels.all()) {
        expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      if (await menu.isVisible()) {
        await menu.click();
        await expect(page.locator(".support-controls")).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(menu).toBeFocused();
        expect(await rect(page)).toEqual(initial);
      }
      const ask = page
        .locator(".support-controls")
        .getByRole("button", { name: "Ask Allie", exact: true });
      await ask.click();
      await expect(
        page.getByRole("dialog", { name: "Allie", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(ask).toBeFocused();
      expect(await rect(page)).toEqual(initial);
      await page.evaluate(() =>
        scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
      );
      const lastLink = page.locator("footer a").last();
      await lastLink.focus();
      const linkBox = await lastLink.boundingBox();
      expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(initial.y);
      await info.attach("dock-scroll", {
        body: JSON.stringify(samples),
        contentType: "application/json",
      });
      await page.screenshot({ path: info.outputPath("home-footer-dock.png") });
    });
  });
