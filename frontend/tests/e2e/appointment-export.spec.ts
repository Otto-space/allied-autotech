import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bookingDetailFixture, detailId } from "../fixtures/customer-booking-detail";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request }) => {
  await bookingRuntimeCapabilities(request);
});

for (const width of [320, 768, 1440]) {
  test(`calendar export downloads only current confirmed appointment at ${width}px`, async ({
    page,
  }, info) => {
    await page.clock.install({ time: new Date("2026-11-03T08:00:00Z") });
    const state = await bookingDetailFixture(page);
    state.record.scheduledAt = "2026-11-04T10:00:00+01:00";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/bookings/${detailId}`);
    const exportLink = page.getByRole("link", { name: "Add to calendar (.ics)" });
    await expect(exportLink).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportLink.click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    const content = await readFile(path!, "utf8");
    expect(content).toContain("DTSTART:20261104T090000Z");
    expect(content).toContain(`UID:booking-${detailId}@alliedautotech.com`);
    expect(content).not.toContain(state.record.customerNotes!);
    expect(content).not.toContain("DTEND:");
    const google = page.getByRole("link", { name: "Google Calendar (new tab)" });
    await expect(google).toHaveAttribute(
      "href",
      /^https:\/\/calendar\.google\.com\/calendar\/render\?/,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByText("Save the confirmed arrival time.", { exact: false }),
    ).toHaveCSS("color", "rgb(219, 229, 238)");
    await page.screenshot({ path: info.outputPath(`calendar-${width}.png`) });
    state.record.status = "REQUESTED";
    await page.reload();
    await expect(page.locator(".booking-appointment")).toContainText("Requested time");
    await expect(exportLink).toHaveCount(0);
    await expect(google).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });
}
