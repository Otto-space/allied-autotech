import { test, expect } from "@playwright/test";
import { invoicesFixture } from "../fixtures/customer-invoices";
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
  test.describe(`${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test("customer invoice list, filters, cursor and private document sharing", async ({
      page,
    }, info) => {
      const state = await invoicesFixture(page);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/v1/public/capabilities", (r) =>
        r.fulfill({
          json: {
            success: true,
            data: publicCapabilitiesFixture("browse_enquiries"),
            meta: { requestId: "invoice-sweep" },
          },
        }),
      );
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "canShare", {
          value: () => false,
          configurable: true,
        }),
      );
      await page.goto("/dashboard/invoices");
      await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("invoice-list.png") });
      await page.getByLabel("Invoice status", { exact: true }).selectOption("PAID");
      await expect(page.locator(".invlist-table tbody tr")).toHaveCount(1);
      await expect(page).toHaveURL(/status=PAID/);
      await page.getByLabel("Rows per page").selectOption("10");
      await page.reload();
      await expect(page.getByLabel("Invoice status", { exact: true })).toHaveValue(
        "PAID",
      );
      await expect(page.getByLabel("Rows per page")).toHaveValue("10");
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
      await expect(page.getByLabel("Invoice status", { exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.locator(".invlist-pagination")).toContainText("Page 2");
      await expect(page.locator("#invlist-results")).toBeFocused();
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
      const detail = page
        .locator(".invlist-table tbody tr")
        .first()
        .locator('a[href^="/dashboard/invoices/"]')
        .first();
      await detail.focus();
      await expect(detail).toBeFocused();
      const rect = await detail.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Invoice details", exact: true }),
      ).toBeVisible();
      const share = page.getByRole("button", { name: "Share invoice", exact: true });
      await expect(share).toBeEnabled();
      await share.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "We could not prepare this document" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.route("**/api/v1/customers/invoices/*/download", (r) =>
        r.fulfill({
          body: Buffer.from("%PDF-synthetic-browser-fixture"),
          headers: {
            "content-type": "application/pdf",
            "x-document-type": "invoice",
            "x-document-id": new URL(r.request().url()).pathname.split("/").at(-2)!,
            "content-disposition": 'attachment; filename="invoice-AA-2041.pdf"',
          },
        }),
      );
      await share.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Close sharing" })).toBeFocused();
      await expect(dialog.getByLabel("Account link", { exact: true })).toHaveValue(
        /dashboard\/invoices\//,
      );
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Close sharing" })).toBeFocused();
      const bounds = await dialog.boundingBox();
      expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds!.y + bounds!.height / 2 - height / 2)).toBeLessThanOrEqual(
        1,
      );
      if (width <= 600) expect(bounds!.width).toBe(width);
      expect(bounds!.height).toBeLessThanOrEqual(height);
      expect(bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath("invoice-share.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(share).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("invoice-detail.png") });
      expect(state.writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
