import { test, expect, type Locator } from "@playwright/test";
import path from "node:path";
import { product, listing } from "../fixtures/public-account-actions";
import { drawerFixture, openDrawer } from "../fixtures/cart-drawer";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { productSchema } from "../../lib/api/commerce-schemas";

test.beforeEach(async ({ request, page }) => {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Requires the isolated loopback runtime fixture");
  expect(
    (
      await request.post(`${origin}/__capabilities`, {
        data: {
          mode: "full",
          checkoutApproved: true,
          bookingRequestsEnabled: true,
          productPurchasesEnabled: true,
          fail: false,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill({ status: 401, json: { success: false, error: { code: "UNAUTHORIZED" } } }),
  );
  await page.route("**/api/v1/public/capabilities", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: publicCapabilitiesFixture("full"),
        meta: { requestId: "modal-fixture" },
      },
    }),
  );
  await page.route("**/api/v1/public/**/images/*", (r) =>
    r.fulfill({
      path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
      contentType: "image/webp",
    }),
  );
});
async function centered(dialog: Locator, width: number, height: number) {
  await expect(dialog).toBeVisible();
  const b = (await dialog.boundingBox())!;
  expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.y + b.height / 2 - height / 2)).toBeLessThanOrEqual(1);
  if (width <= 600) expect(b.width).toBe(width);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
}
for (const [width, height] of [
  [320, 720],
  [768, 1024],
  [1280, 720],
])
  test.describe(`catalogue modals ${width}`, () => {
    test.use({
      viewport: { width, height },
      // Firefox has no isMobile emulation; retain the exact responsive viewport.
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    for (const [route, id] of [
      ["parts", product.id],
      ["vehicles", listing.id],
    ])
      test(`${route} gallery opens, navigates and restores focus`, async ({
        page,
      }, info) => {
        await page.goto(`/${route}/${id}`);
        const open = page.getByRole("button", { name: "View photos", exact: true });
        await open.click();
        const modal = page.getByRole("dialog");
        await centered(modal, width, height);
        const close = modal.getByRole("button", { name: "Close photos", exact: true });
        await close.focus();
        await page.keyboard.press("End");
        await expect(modal.getByText("Photo 2 of 2", { exact: true })).toBeVisible();
        await page.keyboard.press("Shift+Tab");
        expect(await modal.evaluate((e) => e.contains(document.activeElement))).toBe(
          true,
        );
        await page.screenshot({ path: info.outputPath(`${route}-gallery.png`) });
        await page.keyboard.press("Escape");
        await expect(open).toBeFocused();
      });
    test("cart confirmation remains centered with reachable actions", async ({
      page,
    }, info) => {
      const record = productSchema.parse(product);
      const state = await drawerFixture(page, record);
      await openDrawer(page, record);
      const modal = page.getByRole("dialog", { name: "Cart updated" });
      await centered(modal, width, height);
      await page.keyboard.press("Shift+Tab");
      expect(await modal.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await page.screenshot({ path: info.outputPath("cart-confirmation.png") });
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Add to cart", exact: true }),
      ).toBeFocused();
      expect(state.writes).toHaveLength(1);
    });
  });
for (const width of [320, 768, 1280])
  for (const kind of ["product", "vehicle"])
    test(`filters retain modal versus desktop panel behavior ${kind} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(kind === "product" ? "/parts" : "/vehicles");
      const panel = page.locator(`#${kind}-filter-panel`);
      if (width < 1024) {
        await page.locator(`.${kind}-filter-trigger`).click();
        await centered(panel, width, 900);
        expect(await panel.evaluate((e) => e.matches(":modal"))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(panel).not.toBeVisible();
      } else {
        await expect(panel).toBeVisible();
        expect(await panel.evaluate((e) => e.matches(":modal"))).toBe(false);
        expect(await panel.evaluate((e) => getComputedStyle(e).position)).not.toBe(
          "fixed",
        );
        expect(
          await page.locator("body").evaluate((e) => getComputedStyle(e).overflow),
        ).not.toBe("hidden");
      }
    });
