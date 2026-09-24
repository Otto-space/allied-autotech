import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { collectionOnlyOptions } from "../fixtures/fulfillment";
const id = (n: number) => `e7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branch = { id: id(1), code: "TEST", name: "Synthetic stock branch" };
const zone = {
  id: "synthetic-zone",
  label: "Synthetic delivery area",
  city: "Port Harcourt",
  state: "Rivers",
  feeKobo: "10101",
};
const product = {
  id: id(2),
  name: "Synthetic delivery product",
  slug: "synthetic",
  sku: "TEST",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "10000",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: { id: id(3), name: "Synthetic", slug: "synthetic", description: null },
  images: [],
  compatibilities: [],
  availability: [{ branch, inStock: true }],
};
const order = {
  id: id(4),
  orderNumber: "SYNTHETIC-DELIVERY",
  status: "PENDING",
  fulfillmentMethod: "DELIVERY",
  currency: "NGN",
  subtotalKobo: "20000",
  discountAmountKobo: "0",
  deliveryFeeKobo: "10101",
  taxKobo: "2258",
  totalKobo: "32359",
  version: 0,
  createdAt: "2026-09-24T09:00:00Z",
  paymentDueAt: "2026-09-24T09:30:00Z",
  paidAt: null,
  branch,
  invoice: null,
  deliveryName: "Synthetic Recipient",
  deliveryPhone: "+2348000000000",
  deliveryAddress: "Synthetic street near test gate",
  deliveryCity: zone.city,
  deliveryState: zone.state,
  deliveryCountry: "Nigeria",
  items: [
    {
      id: id(5),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unitPriceKobo: "10000",
      quantity: 2,
      subtotalKobo: "20000",
    },
  ],
};
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "delivery-test" },
    },
  });
async function fixture(page: Page) {
  const state = {
    mode: "success",
    optionsFail: false,
    available: true,
    checkoutEnabled: true,
    created: false,
    paymentCalls: 0,
    role: "CUSTOMER",
    writes: [] as { key?: string; body: unknown }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(6),
        user: { id: id(7), email: "synthetic@example.test", role: state.role },
        mfaRequired: state.role !== "CUSTOMER",
        mfaVerifiedAt: state.role !== "CUSTOMER" ? "2026-09-24T09:00:00Z" : null,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "delivery-test-csrf-".repeat(4) });
    if (endpoint === "/public/branches") return reply(route, { items: [branch] });
    if (endpoint === "/public/fulfillment-options") {
      if (state.optionsFail)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return reply(route, {
        ...collectionOnlyOptions,
        checkoutEnabled: state.checkoutEnabled,
        delivery: state.available
          ? { enabled: true, policyVersion: 4, zones: [zone] }
          : collectionOnlyOptions.delivery,
      });
    }
    if (endpoint === "/customers/cart")
      return reply(route, {
        subtotalKobo: state.created ? "0" : "20000",
        items: state.created
          ? []
          : [
              {
                id: id(8),
                quantity: 2,
                unitPriceKobo: "10000",
                lineSubtotalKobo: "20000",
                product,
              },
            ],
      });
    if (endpoint === "/customers/orders/checkout") {
      state.writes.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      expect(route.request().headers()["x-csrf-token"]).toBe(
        "delivery-test-csrf-".repeat(4),
      );
      if (state.mode === "uncertain" && state.writes.length === 1)
        return route.abort("failed");
      if (state.mode === "rejected")
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      state.created = true;
      const saved =
        route.request().postDataJSON().fulfillmentMethod === "COLLECTION"
          ? {
              ...order,
              fulfillmentMethod: "COLLECTION",
              deliveryFeeKobo: "0",
              taxKobo: "1500",
              totalKobo: "21500",
              deliveryName: null,
              deliveryPhone: null,
              deliveryAddress: null,
              deliveryCity: null,
              deliveryState: null,
              deliveryCountry: null,
            }
          : order;
      return reply(route, { order: saved, replayed: state.writes.length > 1 });
    }
    if (
      endpoint === `/customers/orders/${order.id}` ||
      endpoint === `/staff/orders/${order.id}`
    )
      return reply(route, {
        ...order,
        customerName: "Synthetic Customer",
        customerEmail: "synthetic@example.test",
        customerPhone: "+2348000000000",
        cancellationReason: null,
      });
    if (endpoint.startsWith("/customers/payments")) state.paymentCalls++;
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function enterDelivery(page: Page) {
  await page.getByRole("radio", { name: "Delivery", exact: true }).check();
  await page.getByLabel("Stock branch").selectOption(branch.id);
  await page.getByLabel("Delivery area", { exact: true }).selectOption(zone.id);
  await page.getByLabel("Recipient name").fill(order.deliveryName);
  await page.getByLabel("Recipient phone").fill(order.deliveryPhone);
  await page
    .getByLabel("Street address and directions")
    .fill("Synthetic street\nnear test gate");
}
test("delivery checkout sends the selected area and reviews server totals before payment", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await page.goto("/dashboard/cart");
  await enterDelivery(page);
  await expect(page.getByText(/before any applicable tax/)).toBeVisible();
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByLabel("Delivery area", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-delivery-checkout-390.png"),
  });
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      key: expect.any(String),
      body: {
        branchId: branch.id,
        fulfillmentMethod: "DELIVERY",
        delivery: {
          zoneId: zone.id,
          name: order.deliveryName,
          phone: order.deliveryPhone,
          address: order.deliveryAddress,
          city: zone.city,
          state: zone.state,
          country: "Nigeria",
        },
      },
    },
  ]);
  await page.getByRole("link", { name: "Review order & payment" }).click();
  await expect(page.getByText(order.deliveryAddress, { exact: true })).toBeVisible();
  await expect(page.locator("dl.checkout-summary dd")).toContainText([
    "200.00",
    "0.00",
    "101.01",
    "22.58",
    "323.59",
  ]);
  expect(state.paymentCalls).toBe(0);
  expect(errors).toEqual([]);
});
test("uncertain delivery checkout locks fields and repeats only its original body and key", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "uncertain";
  await page.goto("/dashboard/cart");
  await enterDelivery(page);
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation is pending" }),
  ).toBeVisible();
  await expect(page.getByLabel("Recipient name")).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: "Collection", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Check this checkout again" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.paymentCalls).toBe(0);
});
test("a withdrawn area blocks delivery and lets the customer explicitly switch to collection", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterDelivery(page);
  state.available = false;
  await page.getByRole("button", { name: "Refresh delivery options" }).click();
  await expect(page.getByText(/The selected delivery area is unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Collection", exact: true }).check();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes[0]?.body).toEqual({
    branchId: branch.id,
    fulfillmentMethod: "COLLECTION",
  });
});
test("delivery read failures preserve collection and support retry", async ({ page }) => {
  const state = await fixture(page);
  state.optionsFail = true;
  await page.goto("/dashboard/cart");
  await expect(page.getByText(/We could not load delivery options/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Delivery", exact: true })).toBeDisabled();
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeEnabled();
  state.optionsFail = false;
  await page.getByRole("button", { name: "Refresh delivery options" }).click();
  await expect(page.getByRole("radio", { name: "Delivery", exact: true })).toBeEnabled();
  expect(state.writes).toEqual([]);
});
test("known unavailable ordering blocks checkout without discarding the cart", async ({
  page,
}) => {
  const state = await fixture(page);
  state.checkoutEnabled = false;
  state.available = false;
  await page.goto("/dashboard/cart");
  await expect(page.getByText(/Ordering is temporarily unavailable/)).toBeVisible();
  await expect(page.getByText(product.name, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
});
test("delivery contact details clear after a session change", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterDelivery(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByLabel("Recipient name")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Verify session again" }).click();
  await page.getByRole("radio", { name: "Delivery", exact: true }).check();
  await expect(page.getByLabel("Recipient name")).toHaveValue("");
});
test("staff fulfilment reads the saved delivery address", async ({ page }) => {
  const state = await fixture(page);
  state.role = "STAFF";
  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
  await expect(page.getByText(order.deliveryAddress, { exact: true })).toBeVisible();
  await expect(
    page.getByText(`Recipient: ${order.deliveryName}`, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
