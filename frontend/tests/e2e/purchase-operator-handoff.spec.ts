import { test, expect } from "@playwright/test";
import { workOverviewFixture } from "../fixtures/work-overview";
import { workOrderDetailFixture, bookingId } from "../fixtures/work-order-detail";

test("guest cancellation alert names its authorised order destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await workOverviewFixture(page);
  state.operations.operationalAlerts[0]!.category = "GUEST_ORDER_REFUND_REVIEW";
  state.operations.operationalAlerts[0]!.resourceId = bookingId(1100);
  state.operations.operationalAlerts[0]!.message =
    "Synthetic paid guest cancellation requires an operator refund request.";
  await page.goto("/admin");
  await page.getByText("Processing queues & payment monitoring", { exact: true }).click();
  const action = page.getByRole("link", { name: "Review order payments and refunds" });
  await expect(action).toHaveAttribute("href", `/admin/orders/${bookingId(1100)}`);
  await action.focus();
  await expect(action).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(state.writes).toEqual([]);
});
for (const width of [320, 1366]) {
  test(`administrator order exposes the existing payment/refund workspace at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await workOrderDetailFixture(page);
    f.detail.record.status = "CANCELLED";
    f.detail.record.allowedTransitions = [];
    f.detail.record.confirmedAt = null;
    // A capture verified after cancellation need not populate Order.paidAt.
    if (width === 1366) f.detail.record.paidAt = null;
    f.detail.record.paymentReferences = [
      {
        id: bookingId(1500),
        paymentNumber: "PAY-SYNTHETIC-CANCELLED",
        status: "SUCCEEDED",
      },
    ];
    await page.goto(`/admin/orders/${bookingId(1100)}`);
    await expect(
      page.getByText("Cancellation before confirmation is free.", { exact: false }),
    ).toBeVisible();
    const action = page.getByRole("link", {
      name: "Review payment and refunds: PAY-SYNTHETIC-CANCELLED",
    });
    await expect(action).toHaveAttribute(
      "href",
      `/admin/payments?selected=${bookingId(1500)}`,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(f.detail.writes).toEqual([]);
  });
}
test("operational Staff cannot acquire finance actions from returned payment metadata", async ({
  page,
}) => {
  const f = await workOrderDetailFixture(page, "STAFF");
  f.detail.record.paymentReferences = [
    { id: bookingId(1500), paymentNumber: "PAY-SYNTHETIC-PRIVATE", status: "SUCCEEDED" },
  ];
  await page.goto(`/admin/orders/${bookingId(1100)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Review payment and refunds/ }),
  ).toHaveCount(0);
});
