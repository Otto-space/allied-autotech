import { test, expect } from "@playwright/test";

test("STAFF can read and update fulfilment without receiving an invoice", async ({
  page,
}) => {
  const id = "20000000-0000-4000-8000-000000000001";
  let writes = 0;
  const financialReads: string[] = [];
  const record = () => ({
    id,
    orderNumber: "ISOLATED-ORDER",
    status: writes ? "PROCESSING" : "CONFIRMED",
    fulfillmentMethod: "COLLECTION",
    currency: "NGN",
    subtotalKobo: "10000",
    discountAmountKobo: "0",
    deliveryFeeKobo: "0",
    totalKobo: "10000",
    version: writes,
    createdAt: "2026-09-17T10:00:00Z",
    paymentDueAt: null,
    paidAt: null,
    branch: { id, code: "TEST", name: "Isolated branch" },
    items: [],
    customerName: "Synthetic Customer",
    customerEmail: "customer@example.test",
    customerPhone: null,
    cancellationReason: null,
  });
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (/^\/staff\/(payments|invoices)/.test(endpoint)) financialReads.push(endpoint);
    let data: unknown;
    if (endpoint === "/auth/session")
      data = {
        id,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T10:00:00Z",
        user: { id, email: "staff@example.test", role: "STAFF" },
      };
    else if (endpoint === "/auth/csrf")
      data = { csrfToken: "isolated-csrf-token".repeat(3) };
    else if (endpoint === "/staff/orders") data = { items: [record()] };
    else if (endpoint === `/staff/orders/${id}`) data = record();
    else if (endpoint === `/staff/orders/${id}/status`) {
      expect(route.request().postDataJSON()).toEqual({
        status: "PROCESSING",
        expectedVersion: 0,
      });
      writes++;
      data = record();
    } else
      return route.fulfill({
        status: 404,
        json: { success: false, error: { code: "NOT_FOUND" } },
      });
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated operational record",
        data,
        meta: { requestId: "isolated-order" },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: "ISOLATED-ORDER", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ISOLATED-ORDER" })).toBeVisible();
  await page.getByLabel("Next status").selectOption("PROCESSING");
  await page.getByRole("button", { name: "Review fulfilment change" }).click();
  expect(writes).toBe(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("PROCESSING");
  expect(writes).toBe(1);
  expect(financialReads).toEqual([]);
});
