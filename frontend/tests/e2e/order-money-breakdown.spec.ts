import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceAftercareFixture } from "../fixtures/workforce-aftercare";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request, page }) => {
  await bookingRuntimeCapabilities(request, page);
});
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 768, 1440]) {
    test(`${role} reads saved line amounts without approving money at ${width}px`, async ({
      page,
    }, info) => {
      const f = await workforceAftercareFixture(page, role);
      const item = f.record.requestedItems![0]!;
      f.record.order.totalKobo = "16126";
      f.record.monetaryBreakdown = {
        status: "SAVED",
        lines: [
          {
            orderItemId: item.orderItemId,
            productName: item.productName,
            quantity: item.orderedQuantity,
            subtotalKobo: "30003",
            discountKobo: "15002",
            taxKobo: "1125",
            totalKobo: "16126",
          },
        ],
      };
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/admin/workforce/aftercare/${f.record.id}`);
      const section = page.getByRole("region", { name: "Saved order amounts" });
      await expect(section).toBeVisible();
      await expect(section).toContainText("Saved amounts for all 3 ordered units.");
      for (const amount of ["₦300.03", "₦150.02", "₦11.25", "₦161.26"])
        await expect(section).toContainText(amount);
      await expect(section).toContainText("earlier refunds");
      await expect(section).toContainText(
        "Payment and any refund still need their own verification.",
      );
      await section.scrollIntoViewIfNeeded();
      expect(
        (
          await new AxeBuilder({ page })
            .include("[aria-labelledby='saved-order-amounts-heading']")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(f.writes).toHaveLength(0);
      await page.screenshot({
        path: info.outputPath(`saved-order-amounts-${role}-${width}.png`),
      });
      await expect(page.getByLabel("Decision", { exact: true })).toBeEnabled();
      await page.getByLabel("Decision", { exact: true }).focus();
      await expect(page.getByLabel("Decision", { exact: true })).toBeFocused();
      expect(f.writes).toHaveLength(0);
    });
  }
test("legacy amounts require issued-record review while corrupt evidence cannot enable a decision", async ({
  page,
}) => {
  const f = await workforceAftercareFixture(page);
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto(`/admin/workforce/aftercare/${f.record.id}`);
  await expect(
    page.getByText("No saved line breakdown is available.", { exact: false }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
  f.record.monetaryBreakdown = { status: "INVALID" };
  f.record.reviewEvidenceReady = false;
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "saved monetary breakdown" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review financial decision", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
