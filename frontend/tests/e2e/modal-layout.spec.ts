import { test, expect, type Locator } from "@playwright/test";
import { garageFixture } from "../fixtures/customer-garage";
import { fixture as securityFixture } from "../fixtures/security";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";

async function geometry(dialog: Locator, width: number, height: number) {
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(1);
  if (width <= 600) expect(box.width).toBe(width);
  expect(box.height).toBeLessThanOrEqual(height - 24);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
}
for (const [width, height, securityRole] of [
  [1280, 720, "CUSTOMER"],
  [1024, 768, "STAFF"],
  [768, 1024, "ADMIN"],
  [430, 932, "SUPER_ADMIN"],
  [390, 844, "CUSTOMER"],
  [360, 800, "STAFF"],
  [320, 720, "ADMIN"],
] as const) {
  test.describe(`shared modals ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      // Firefox has no isMobile emulation; retain the exact responsive viewport.
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test("security password review uses shared geometry and clears cancelled credentials", async ({
      page,
    }, info) => {
      const state = await securityFixture(page, securityRole);
      await page.goto(
        securityRole === "CUSTOMER" ? "/dashboard/security" : "/admin/security",
      );
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      await expect(
        page.getByRole("heading", { name: "Test authenticator", exact: true }),
      ).toBeVisible();
      const fields = ["Current password", "New password", "Confirm new password"];
      for (const [index, label] of fields.entries())
        await page
          .getByLabel(label, { exact: true })
          .fill(index ? "new-isolated-passphrase" : "old-isolated-passphrase");
      const opener = page.getByRole("button", {
        name: "Review password change",
        exact: true,
      });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Change your password?" });
      await geometry(dialog, width, height);
      await expect(dialog).not.toContainText("isolated-passphrase");
      await dialog.getByRole("button", { name: "Confirm change", exact: true }).focus();
      await expect(
        dialog.getByRole("button", { name: "Confirm change", exact: true }),
      ).toBeInViewport();
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await page.screenshot({ path: info.outputPath("security-password-review.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      for (const label of fields)
        await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
      expect(state.writes).toEqual([]);
    });
    test("vehicle form keeps fields and footer reachable", async ({ page }, info) => {
      const state = await garageFixture(page);
      await page.goto("/dashboard/vehicles");
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      const opener = page.getByRole("button", { name: "Add a vehicle", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog");
      await geometry(dialog, width, height);
      await page.getByLabel("Mileage in km (optional)").fill("123");
      await expect(page.getByLabel("Mileage in km (optional)")).toBeInViewport();
      const save = page.getByRole("button", { name: "Save vehicle", exact: true });
      await save.focus();
      await expect(save).toBeInViewport();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Close vehicle dialog" }),
      ).toBeFocused();
      await page.screenshot({ path: info.outputPath("vehicle-form.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(state.writes).toEqual([]);
    });
    test("notification preview stays centered and keeps keyboard focus", async ({
      page,
    }, info) => {
      const state = await notificationsFixture(page, "SUPER_ADMIN");
      state.items = Array.from({ length: 30 }, (_, n) => ({
        ...notificationItem(n + 1),
        title: `Synthetic update ${n + 1}`,
      }));
      await page.goto("/admin/notifications");
      const opener = page.getByRole("button", {
        name: "Open notifications, 30 unread",
        exact: true,
      });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
      await expect(dialog.getByRole("link", { name: /Synthetic update/ })).toHaveCount(5);
      await geometry(dialog, width, height);
      const close = dialog.getByRole("button", { name: "Close notification preview" });
      await close.focus();
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.screenshot({ path: info.outputPath("notification-preview.png") });
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
      expect(state.writes).toEqual([]);
    });
  });
}
