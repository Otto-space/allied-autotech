import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingDetailFixture, detailId } from "../fixtures/customer-booking-detail";

test.use({ timezoneId: "America/Los_Angeles" });
for (const width of [320, 1440]) {
  test(`confirmed appointment summary stays truthful across updates at ${width}px`, async ({
    page,
  }, info) => {
    await page.clock.install({ time: new Date("2026-11-01T22:30:00Z") });
    const state = await bookingDetailFixture(page);
    state.record.scheduledAt = "2026-11-02T09:00:00Z";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/bookings/${detailId}`);
    const panel = page.locator(".booking-appointment");
    await expect(panel).toBeVisible();
    await page.screenshot({ path: info.outputPath("appointment-summary.png") });
    await expect(panel).toContainText(
      /Your appointment is tomorrow at 10:00 am \(Nigeria time\)/i,
    );
    await expect(panel).toContainText("Confirmed appointment");
    expect(
      (await new AxeBuilder({ page }).include(".booking-appointment").analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      panel.locator(
        '.booking-appointment-reminder[aria-live], .booking-appointment-reminder[role="status"]',
      ),
    ).toHaveCount(0);
    await expect(panel.getByLabel("Booking reference", { exact: true })).toBeHidden();
    await panel.locator(".booking-reference > summary").click();
    await expect(panel.getByLabel("Booking reference", { exact: true })).toHaveValue(
      detailId,
    );
    expect(
      (await new AxeBuilder({ page }).include(".booking-appointment").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath("appointment-reference.png") });
    await panel.locator(".booking-reference > summary").click();

    state.record.status = "REQUESTED";
    state.record.scheduledAt = "2026-11-03T09:00:00Z";
    await page.reload();
    await expect(panel).toContainText("Requested time");
    await expect(panel).not.toContainText("Your appointment is");
    await expect(panel).toContainText("Awaiting workshop confirmation.");
    state.record.status = "CONFIRMED";
    state.record.scheduledAt = "2026-11-02T10:00:00Z";
    await page.reload();
    await expect(panel).toContainText(/tomorrow at 11:00 am/i);
    state.record.scheduledAt = "2026-11-01T22:31:00Z";
    await page.reload();
    await expect(panel).toContainText("Your appointment is today");
    await page.clock.fastForward(90_000);
    await expect(panel).not.toContainText("Your appointment is");
    await expect(panel).toContainText("Confirmed");
    for (const status of ["CANCELLED", "COMPLETED"]) {
      state.record.status = status;
      state.record.scheduledAt = "2026-11-04T10:00:00Z";
      await page.reload();
      await expect(panel).toBeVisible();
      await expect(panel).not.toContainText("Your appointment is");
    }
    expect(state.writes).toHaveLength(0);
  });
}
