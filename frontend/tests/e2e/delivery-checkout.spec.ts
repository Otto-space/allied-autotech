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
    paid: false,
    cancelled: false,
    feeKobo: zone.feeKobo,
    checkoutDelay: 0,
    quantity: 2,
    cartWrites: [] as unknown[],
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
    if (endpoint.endsWith("/notifications/summary"))
      return reply(route, { unreadCount: 0, groups: [] });
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
          ? {
              enabled: true,
              policyVersion: 4,
              zones: [{ ...zone, feeKobo: state.feeKobo }],
            }
          : collectionOnlyOptions.delivery,
      });
    }
    if (endpoint === "/customers/cart")
      return reply(route, {
        subtotalKobo: state.created ? "0" : String(state.quantity * 10000),
        items: state.created
          ? []
          : [
              {
                id: id(8),
                quantity: state.quantity,
                unitPriceKobo: "10000",
                lineSubtotalKobo: String(state.quantity * 10000),
                product,
              },
            ],
      });
    if (endpoint === `/customers/cart/items/${product.id}`) {
      state.cartWrites.push(route.request().postDataJSON());
      state.quantity = route.request().postDataJSON().quantity;
      return reply(route, {});
    }
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
      if (state.mode === "malformed")
        return reply(route, { order: { id: order.id }, replayed: false });
      if (state.checkoutDelay)
        await new Promise((resolve) => setTimeout(resolve, state.checkoutDelay));
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
      return reply(route, {
        order: {
          ...saved,
          ...(state.paid ? { paidAt: "2026-10-08T09:00:00Z", status: "CONFIRMED" } : {}),
          ...(state.cancelled ? { status: "CANCELLED" } : {}),
        },
        replayed: state.writes
          .slice(0, -1)
          .some((write) => write.key === route.request().headers()["idempotency-key"]),
      });
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
        allowedTransitions: [],
      });
    if (endpoint.startsWith("/customers/payments")) state.paymentCalls++;
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function enterCollection(page: Page) {
  await page.getByLabel("Collection branch").selectOption(branch.id);
}

test("collection checkout excludes delivery and reviews server totals before payment", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await expect(
    page.getByText("Orders are collection only. Delivery is unavailable."),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Delivery", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Recipient name")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByLabel("Collection branch", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-delivery-checkout-390.png"),
  });
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      key: expect.any(String),
      body: {
        branchId: branch.id,
        fulfillmentMethod: "COLLECTION",
      },
    },
  ]);
  await page.getByRole("link", { name: "Review order & payment" }).click();
  // Historical delivery snapshots remain readable after collection-only checkout.
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
test("uncertain collection checkout locks fields and repeats only its original body and key", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "uncertain";
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation is pending" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Check this checkout again" }).click();
  await expect(
    page.getByRole("heading", { name: "Order found", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.paymentCalls).toBe(0);
});
test("retained delivery policies cannot enable a delivery option in customer checkout", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await expect(page.getByRole("radio", { name: "Delivery", exact: true })).toHaveCount(0);
  state.available = false;
  await page.getByRole("button", { name: "Refresh ordering availability" }).click();
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes[0]?.body).toEqual({
    branchId: branch.id,
    fulfillmentMethod: "COLLECTION",
  });
});

test("ordering availability failures block checkout and support retry without losing the cart", async ({
  page,
}) => {
  const state = await fixture(page);
  state.optionsFail = true;
  await page.goto("/dashboard/cart");
  await expect(
    page.getByText(/Ordering availability could not be checked/),
  ).toBeVisible();
  await enterCollection(page);
  await expect(
    page.getByRole("button", { name: "Review checkout", exact: true }),
  ).toBeDisabled();
  state.optionsFail = false;
  await page.getByRole("button", { name: "Refresh ordering availability" }).click();
  await expect(
    page.getByRole("button", { name: "Review checkout", exact: true }),
  ).toBeEnabled();
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
    page.getByRole("button", { name: "Review checkout", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
});
test("collection details clear after a session change", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Verify session again" }).click();
  await expect(page.getByLabel("Collection branch")).toHaveValue("");
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

test("review is read-only, can be edited, and successful checkout clears the collection draft", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review your checkout" })).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel("Quantity", { exact: true })).toBeDisabled();
  await expect(page.locator(".cart-review-facts")).toContainText(branch.name);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.getByLabel("Collection branch")).toBeFocused();
  await expect(page.getByLabel("Collection branch")).toHaveValue(branch.id);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".cart-confirmation .cart-amounts dd")).toContainText([
    "200.00",
    "0.00",
    "0.00",
    "15.00",
    "215.00",
  ]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.entries(sessionStorage).filter(
            ([key]) => key.startsWith("aat:form-draft:") && key.includes("cart-checkout"),
          ).length,
      ),
    )
    .toBe(0);
  expect(state.writes).toHaveLength(1);
  expect(state.paymentCalls).toBe(0);
});

test("a missing collection branch focuses its error and sends no order", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.getByLabel("Collection branch")).toBeFocused();
  await expect(page.getByLabel("Collection branch")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Review your checkout" })).toHaveCount(
    0,
  );
  expect(state.writes).toHaveLength(0);
});

test("edited quantities cannot silently reach checkout and use the authoritative updated subtotal", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByLabel("Quantity", { exact: true }).fill("3");
  await expect(
    page.getByRole("button", { name: "Review checkout", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("3");
  await expect(page.locator(".cart-subtotal")).toContainText("300.00");
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.locator(".cart-checkout-review .cart-amounts")).toContainText(
    "300.00",
  );
  expect(state.cartWrites).toEqual([{ quantity: 3 }]);
  expect(state.writes).toHaveLength(0);
});

test("newly unavailable ordering blocks an existing review until availability recovers", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  state.checkoutEnabled = false;
  await page.getByRole("button", { name: "Refresh ordering availability" }).click();
  await expect(page.getByText(/Ordering is temporarily unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeDisabled();
  state.checkoutEnabled = true;
  await page.getByRole("button", { name: "Refresh ordering availability" }).click();
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});

for (const kind of ["paid", "cancelled"] as const) {
  test(`an uncertain checkout replay shows the actual ${kind} order state`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = "uncertain";
    state[kind] = true;
    await page.goto("/dashboard/cart");
    await enterCollection(page);
    await page.getByRole("button", { name: "Review checkout", exact: true }).click();
    await page.getByRole("button", { name: "Create order & review total" }).click();
    await page.getByRole("button", { name: "Check this checkout again" }).click();
    await expect(
      page.getByRole("heading", { name: "Order found", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(kind === "paid" ? "Payment recorded" : "Order cancelled", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Awaiting payment", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Payment deadline:/)).toHaveCount(0);
    expect(state.writes[1]).toEqual(state.writes[0]);
  });
}

test("malformed success cannot manufacture an order receipt", async ({ page }) => {
  const state = await fixture(page);
  state.mode = "malformed";
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation is pending" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("session invalidation during checkout removes private review and suppresses a late success", async ({
  page,
}) => {
  const state = await fixture(page);
  state.checkoutDelay = 1400;
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  await expect(page.locator(".cart-checkout-review")).toHaveCount(0);
  await expect.poll(() => state.created).toBe(true);
  await expect(
    page.getByText("Order created. Review the total and payment deadline.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".cart-confirmation")).toHaveCount(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`checkout editor, review and server confirmation fit ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/dashboard/cart");
    await enterCollection(page);
    await page.evaluate(() => document.fonts.ready);
    for (const stage of ["editor", "review", "receipt"]) {
      if (stage === "review")
        await page.getByRole("button", { name: "Review checkout", exact: true }).click();
      if (stage === "receipt")
        await page.getByRole("button", { name: "Create order & review total" }).click();
      if (stage === "receipt")
        await expect(
          page.getByRole("heading", { name: "Order created", exact: true }),
        ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".cart-page")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-collection-${width}-${stage}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

test("a rejected checkout remains editable and a new review gets a new idempotency key", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "rejected";
  await page.goto("/dashboard/cart");
  await enterCollection(page);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.locator(".cart-page > .feedback[role='alert'], .cart-page > [role='alert']"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Collection branch").selectOption(branch.id);
  state.mode = "success";
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Order created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].key).not.toBe(state.writes[0].key);
  expect(state.writes[1].body).toEqual({
    branchId: branch.id,
    fulfillmentMethod: "COLLECTION",
  });
});

test("branch pagination retains an explicitly selected branch from another page", async ({
  page,
}) => {
  const state = await fixture(page);
  const next = { ...branch, id: id(40), name: "Second page branch" };
  const reads: string[] = [];
  await page.route("**/public/branches?**", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    reads.push(cursor ?? "first");
    return reply(
      route,
      cursor ? { items: [next] } : { items: [branch], nextCursor: id(41) },
    );
  });
  await page.goto("/dashboard/cart");
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page
    .getByRole("navigation", { name: "Branch choices pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByRole("option", { name: "Second page branch" })).toHaveCount(1);
  await expect(page.getByLabel("Collection branch")).toHaveValue(branch.id);
  await page.getByLabel("Collection branch").selectOption(next.id);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.locator(".cart-review-facts")).toContainText(next.name);
  expect([...new Set(reads)]).toEqual(["first", id(41)]);
  expect(state.writes).toHaveLength(0);
});

test("promotion preview is an estimate and only the server receipt supplies the payable total", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route("**/customers/promotions/preview", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      code: "QA10",
      subtotalKobo: "20000",
    });
    return reply(route, { code: "QA10", discountAmountKobo: "1000" });
  });
  await page.goto("/dashboard/cart");
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByLabel("Promotion code (optional)").fill("qa10");
  await page.getByRole("button", { name: "Check promotion code", exact: true }).click();
  await expect(page.getByText(/Estimated discount/)).toBeVisible();
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.locator(".cart-review-facts")).toContainText("qa10");
  await expect(page.locator(".cart-checkout-review .cart-amounts dd")).toHaveCount(1);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(page.locator(".cart-confirmation .cart-final-total")).toContainText(
    "215.00",
  );
});

for (const width of [390, 1440]) {
  test(`multiple products keep independent quantities and render real media responses at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    const quantities = [2, 7];
    const products = [
      {
        ...product,
        name: "QA oil filter",
        images: [
          {
            id: id(60),
            url: `/api/v1/public/catalog/products/images/${id(60)}`,
            altText: null,
            isPrimary: true,
          },
        ],
      },
      {
        ...product,
        id: id(61),
        name: "QA replacement brake pads with a longer product description",
        sku: "QA-PART-".repeat(9),
      },
    ];
    await page.route(`**/public/catalog/products/images/${id(60)}`, (route) =>
      route.fulfill({
        path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
        contentType: "image/webp",
      }),
    );
    await page.route("**/customers/cart", (route) =>
      reply(route, {
        subtotalKobo: String(quantities.reduce((a, b) => a + b, 0) * 10000),
        items: products.map((item, index) => ({
          id: id(70 + index),
          product: item,
          quantity: quantities[index],
          unitPriceKobo: "10000",
          lineSubtotalKobo: String(quantities[index] * 10000),
        })),
      }),
    );
    const writes: unknown[] = [];
    await page.route("**/customers/cart/items/**", (route) => {
      const index = route.request().url().endsWith(products[0].id) ? 0 : 1;
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      quantities[index] = route.request().postDataJSON().quantity;
      writes.push({ index, quantity: quantities[index] });
      return reply(route, {});
    });
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/dashboard/cart");
    const first = page.getByRole("article", { name: products[0].name, exact: true });
    const second = page.getByRole("article", { name: products[1].name, exact: true });
    await expect
      .poll(() =>
        first
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await first.getByLabel("Quantity", { exact: true }).fill("3");
    await expect(second.getByLabel("Quantity", { exact: true })).toHaveValue("7");
    await first.getByRole("button", { name: "Update", exact: true }).click();
    await expect(first.getByLabel("Quantity", { exact: true })).toHaveValue("3");
    await expect(second.getByLabel("Quantity", { exact: true })).toHaveValue("7");
    expect(writes).toEqual([{ index: 0, quantity: 3 }]);
    await page.reload();
    await expect(first.getByLabel("Quantity", { exact: true })).toHaveValue("3");
    await expect(second.getByLabel("Quantity", { exact: true })).toHaveValue("7");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".cart-page").analyze()).violations,
    ).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(os.homedir(), ".codex", `cart-oct-multiple-${width}.png`),
      fullPage: true,
    });
  });
}

test("a cart changed elsewhere must be reviewed again before any order write", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  state.quantity = 4;
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByText(
      "Your cart changed. Edit details and review the updated items before creating your order.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("4");
  await expect(
    page.getByRole("button", { name: "Create order & review total" }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.locator(".cart-checkout-review .cart-amounts")).toContainText(
    "400.00",
  );
});

test("failed checkout preflight sends no order and does not claim an uncertain write", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await page.route("**/customers/cart", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(page.getByText(/No checkout was sent/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation is pending" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});

test("empty branch choices explain the dependency and can recover without losing the cart", async ({
  page,
}) => {
  const state = await fixture(page);
  let empty = true;
  await page.route("**/public/branches?**", (route) =>
    reply(route, { items: empty ? [] : [branch] }),
  );
  await page.goto("/dashboard/cart");
  await expect(page.getByText(/No branch is available for checkout/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review checkout", exact: true }),
  ).toBeDisabled();
  empty = false;
  await page.getByRole("button", { name: "Refresh branch choices", exact: true }).click();
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByRole("button", { name: "Review checkout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review your checkout" })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

for (const viewport of [
  { width: 390, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`collection review and manual copy remain usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await fixture(page);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("Test clipboard denied")) },
      }),
    );
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard/cart");
    await enterCollection(page);
    await page.getByRole("button", { name: "Review checkout", exact: true }).click();
    await expect(page.locator(".cart-review-facts")).toContainText(branch.name);
    const create = page.getByRole("button", { name: "Create order & review total" });
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeInViewport();
    await create.click();
    await expect(
      page.getByRole("heading", { name: "Order created", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Copy order reference", exact: true }).click();
    await expect(page.getByLabel("Order reference", { exact: true })).toBeFocused();
    await expect(page.getByText(/Select and copy the value above/)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".cart-page").analyze()).violations,
    ).toEqual([]);
  });
}

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} is redirected away from customer checkout before cart reads or writes`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.role = role;
    const customerRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/v1\/customers\/(cart|orders\/checkout)/.test(request.url()))
        customerRequests.push(request.url());
    });
    await page.goto("/dashboard/cart");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator(".cart-page")).toHaveCount(0);
    expect(customerRequests).toEqual([]);
    expect(state.writes).toHaveLength(0);
  });
}

test("anonymous checkout redirects to sign in without fetching a customer's cart", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route("**/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: { success: false, error: { code: "UNAUTHENTICATED" } },
    }),
  );
  const customerRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/v1\/customers\/(cart|orders\/checkout)/.test(request.url()))
      customerRequests.push(request.url());
  });
  await page.goto("/dashboard/cart");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.locator(".cart-page")).toHaveCount(0);
  expect(customerRequests).toEqual([]);
  expect(state.writes).toHaveLength(0);
});
