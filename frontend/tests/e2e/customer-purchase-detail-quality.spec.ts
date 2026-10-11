import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  purchaseDetailFixture,
  purchaseDetailPath,
  purchaseId,
} from "../fixtures/customer-purchase-detail";
import { transactionStatuses } from "@/lib/api/vehicle-schemas";
import { purchaseLabels } from "@/lib/customer-purchase-query";
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`purchase detail layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const s = await purchaseDetailFixture(page);
    await page.goto(purchaseDetailPath);
    await expect(
      page.getByRole("heading", { name: "2021 Toyota Camry", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".pd-photo img")).toBeVisible();
    expect(
      await page
        .locator(".pd-photo img")
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.locator(".pd-prices")).toContainText("24,000,000.50");
    await expect(page.getByLabel("Payment purpose", { exact: true })).toBeEnabled();
    expect(s.writes).toEqual([]);
  });
}
for (const status of transactionStatuses)
  test(`authoritative ${status} detail`, async ({ page }) => {
    const s = await purchaseDetailFixture(page);
    s.record.status = status;
    if (status === "CANCELLED")
      s.record.cancellationReason = "Customer asked to close this enquiry.";
    await page.goto(purchaseDetailPath);
    await expect(page.locator(".pd-identity .pd-status")).toHaveText(
      purchaseLabels[status],
    );
    await expect(page.locator(".pd-timeline li")).toHaveCount(2);
    if (status === "CANCELLED")
      await expect(page.getByText(s.record.cancellationReason!)).toBeVisible();
    if (
      ["PAID", "COMPLETED", "EXPIRED", "HANDOVER_PENDING", "CANCELLED"].includes(status)
    )
      await expect(
        page.getByRole("button", { name: "Review payment request", exact: true }),
      ).toBeDisabled();
  });
test("handover and historical holds preserve zero, missing and exact money", async ({
  page,
}) => {
  const s = await purchaseDetailFixture(page);
  s.record.agreedPriceKobo = "9007199254740993";
  s.record.status = "HANDOVER_PENDING";
  s.record.paidHoldStartsAt = "2026-10-09T10:00:00Z";
  s.record.paidHoldExpiresAt = "2026-10-12T10:00:00Z";
  s.record.handover = {
    id: purchaseId(800),
    status: "READY",
    recipientName: null,
    odometerKm: 0,
    keysDelivered: 0,
    readyAt: "2026-10-09T10:00:00Z",
    completedAt: null,
  };
  await page.goto(purchaseDetailPath);
  await expect(page.locator(".pd-prices")).toContainText("90,071,992,547,409.93");
  await expect(page.locator(".pd-handover")).toContainText("Not recorded");
  await expect(page.locator(".pd-handover")).toContainText("0 km");
  await expect(page.locator(".pd-handover dd").last()).toHaveText("0");
  await expect(page.getByText(/Recorded paid hold ends/)).toBeVisible();
  await expect(page.locator(".pd-handover .pd-status")).toHaveText("Ready");
});
test("empty history and missing media remain honest", async ({ page }) => {
  const s = await purchaseDetailFixture(page);
  s.record.statusHistory = [];
  s.record.vehicleListing.vehicle = undefined;
  s.record.agreedPriceKobo = null;
  s.record.reservationRequiredKobo = null;
  await page.goto(purchaseDetailPath);
  await expect(page.getByText("Image unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("No progress entries are available.")).toBeVisible();
  await expect(page.getByText("Not agreed yet", { exact: true })).toBeVisible();
});
for (const mode of ["error", "denied", "missing", "malformed"])
  test(`${mode} never exposes private purchase or requests payments`, async ({
    page,
  }) => {
    const s = await purchaseDetailFixture(page);
    s.mode = mode;
    await page.goto(purchaseDetailPath);
    await expect(
      page.getByRole("heading", { name: "Purchase details unavailable" }),
    ).toBeVisible();
    await expect(page.locator(".pd-summary")).toHaveCount(0);
    expect(s.reads).not.toContain("/customers/payments");
    s.mode = "normal";
    await page
      .getByRole("button", { name: "Refresh purchase progress", exact: true })
      .click();
    await expect(page.locator(".pd-summary")).toBeVisible();
  });
test("background failure labels retained data and disables creation, manual retry recovers", async ({
  page,
}) => {
  const s = await purchaseDetailFixture(page);
  await page.goto(purchaseDetailPath);
  await expect(page.getByLabel("Payment purpose", { exact: true })).toBeEnabled();
  s.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("These details may be out of date.")).toBeVisible();
  await expect(page.locator(".pd-summary")).toBeVisible();
  await expect(page.getByLabel("Payment purpose", { exact: true })).toBeDisabled();
  s.mode = "normal";
  await page
    .getByRole("button", { name: "Refresh purchase progress", exact: true })
    .click();
  await expect(page.getByLabel("Payment purpose", { exact: true })).toBeEnabled();
});
test("loading reserves space without fetching payments", async ({ page }) => {
  const s = await purchaseDetailFixture(page);
  s.mode = "hold";
  await page.goto(purchaseDetailPath);
  await expect(page.locator(".pd-loading")).toBeVisible();
  expect(s.reads).not.toContain("/customers/payments");
  s.held?.();
  await expect(page.locator(".pd-summary")).toBeVisible();
});
test("invalid URL is contained before requests", async ({ page }) => {
  const s = await purchaseDetailFixture(page);
  await page.goto("/dashboard/vehicle-transactions/not-an-id");
  await expect(
    page.getByText("This purchase link is not valid.", { exact: false }),
  ).toBeVisible();
  expect(s.reads.some((p) => p.startsWith("/customers/vehicle-transactions/"))).toBe(
    false,
  );
});
test("long content fits short mobile and support does not cover keyboard target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const s = await purchaseDetailFixture(page);
  s.record.vehicleListing.title = "Long vehicle description ".repeat(8);
  s.record.transactionNumber = "VT-" + "X".repeat(90);
  s.record.agreedPriceKobo = "9007199254740993";
  await page.goto(purchaseDetailPath);
  await expect(page.locator(".pd-summary")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  const link = page.locator(".pd-support");
  await link.focus();
  await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect
    .poll(async () => {
      const box = await link.boundingBox();
      return box!.y + box!.height;
    })
    .toBeLessThan(500);
});
for (const width of [390, 768, 1280, 1440])
  test(`purchase detail accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await purchaseDetailFixture(page);
    await page.goto(purchaseDetailPath);
    await expect(page.getByLabel("Payment purpose", { exact: true })).toBeEnabled();
    const results = await new AxeBuilder({ page })
      .include("#main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
