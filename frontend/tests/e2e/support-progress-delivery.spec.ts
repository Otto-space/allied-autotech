import { test, expect } from "@playwright/test";
import { workThreadFixture, bookingId } from "../fixtures/work-support-detail";
import path from "node:path";
import os from "node:os";

for (const width of [1440, 390])
  test(`support progress and email delivery at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    const fixture = await workThreadFixture(page, "SUPER_ADMIN", "enquiries");
    fixture.detail.emailDeliveries.items = [
      {
        id: bookingId(99001),
        status: "QUEUED",
        reason: null,
        createdAt: "2026-10-22T09:00:00Z",
        sentAt: null,
      },
    ];
    await page.goto(`/admin/support/enquiries/${bookingId(50000)}`);
    await expect(
      page.getByRole("heading", { name: "Service estimate request", exact: true }),
    ).toBeVisible();
    await expect(page.locator('.workflow-stages [aria-current="step"]')).toHaveCount(1);
    await page.locator(".workflow-progress").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-workflow-stages-${width}.png`),
    });
    await expect(page.getByText("Queued", { exact: true })).toBeVisible();
    fixture.detail.emailDeliveries.items[0].status = "SENT";
    fixture.detail.emailDeliveries.items[0].sentAt = "2026-10-22T09:00:05Z";
    await page
      .getByRole("button", { name: "Refresh email delivery", exact: true })
      .click();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();
    const badge = page.locator('[data-status="SENT"]');
    await expect(badge).toHaveCSS("color", "rgb(22, 101, 52)");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page
      .getByRole("heading", { name: "Customer email delivery", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-support-progress-${width}.png`),
    });
    expect(errors).toEqual([]);
  });
