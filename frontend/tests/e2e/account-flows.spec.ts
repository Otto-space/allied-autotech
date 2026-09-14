import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Synthetic records remain inside intercepted browser tests. No backend mutations.
const id = (suffix: number) =>
  `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const branch = { id: id(1), code: "TEST", name: "Isolated test branch" };
const category = {
  id: id(2),
  name: "Test category",
  slug: "test-category",
  description: null,
};
const product = {
  id: id(3),
  name: "Isolated test part",
  slug: "test-part",
  sku: "TEST-001",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "12345",
  compareAtPriceKobo: null,
  currency: "NGN",
  category,
  images: [],
  compatibilities: [],
  availability: [{ branch, inStock: true }],
};
const order = {
  id: id(4),
  orderNumber: "ISOLATED-ORDER-A",
  status: "PENDING",
  fulfillmentMethod: "COLLECTION",
  currency: "NGN",
  subtotalKobo: "24690",
  discountAmountKobo: "0",
  deliveryFeeKobo: "0",
  totalKobo: "24690",
  version: 0,
  createdAt: "2026-09-12T09:00:00.000Z",
  paymentDueAt: "2026-09-20T09:30:00.000Z",
  paidAt: null,
  branch,
  items: [
    {
      id: id(5),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unitPriceKobo: "12345",
      quantity: 2,
      subtotalKobo: "24690",
    },
  ],
  invoice: null,
};
const session = (role = "CUSTOMER", suffix = 6) => ({
  id: id(7),
  expiresAt: "2027-01-01T00:00:00Z",
  idleExpiresAt: "2027-01-01T00:00:00Z",
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-12T08:00:00Z",
  user: {
    id: id(suffix),
    email: `account-${suffix}@example.test`,
    role,
    emailVerifiedAt: "2026-09-12T08:00:00Z",
  },
});
const reply = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "browser-test" },
    },
  });
const failure = (route: Route, code: string, status: number) =>
  route.fulfill({
    status,
    json: {
      success: false,
      message: "Never display this test exception",
      error: { code },
      meta: { requestId: "browser-test" },
    },
  });
async function isolate(
  page: Page,
  handler: (route: Route, path: string) => Promise<boolean | void>,
  role = "CUSTOMER",
) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, path)) return;
    if (path === "/auth/session") return reply(route, session(role));
    if (path === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
    if (path === "/public/branches") return reply(route, { items: [branch] });
    if (path === "/customers/bookings" || path === "/public/services")
      return reply(route, { items: [] });
    return failure(route, "NOT_FOUND", 404);
  });
}

test("uncertain checkout reuses its key and payload without initiating payment", async ({
  page,
}) => {
  const checkouts: { key: string | undefined; body: unknown }[] = [];
  let paymentCalls = 0;
  let created = false;
  await isolate(page, async (route, path) => {
    if (path.startsWith("/customers/payments")) {
      paymentCalls++;
      await failure(route, "NOT_FOUND", 404);
      return true;
    }
    if (path === "/customers/cart") {
      await reply(route, {
        subtotalKobo: created ? "0" : "24690",
        items: created
          ? []
          : [
              {
                id: id(8),
                quantity: 2,
                unitPriceKobo: "12345",
                lineSubtotalKobo: "24690",
                product,
              },
            ],
      });
      return true;
    }
    if (path === "/customers/orders/checkout") {
      checkouts.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (checkouts.length === 1) await route.abort("connectionreset");
      else {
        created = true;
        await reply(route, { order, replayed: true });
      }
      return true;
    }
  });
  await page.goto("/dashboard/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(product.name)).toBeVisible();
  await page.getByLabel("Collection branch").selectOption(branch.id);
  await page.getByLabel("Promotion code (optional)").fill("TEST-CODE");
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout confirmation is pending" }),
  ).toBeVisible();
  await expect(page.getByLabel("Collection branch")).toBeDisabled();
  await page.getByRole("button", { name: "Check this checkout again" }).click();
  await expect(page.getByRole("heading", { name: "Order created" })).toBeVisible();
  expect(checkouts).toHaveLength(2);
  expect(checkouts[1]).toEqual(checkouts[0]);
  expect(checkouts[0].key).toMatch(/^[0-9a-f-]{36}$/);
  expect(checkouts[0].body).toEqual({
    branchId: branch.id,
    fulfillmentMethod: "COLLECTION",
    promotionCode: "TEST-CODE",
  });
  expect(paymentCalls).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("pending provider verification blocks another payment and shows the server outcome", async ({
  page,
}) => {
  let verified = false;
  let initiationCalls = 0;
  const payment = () => ({
    id: id(9),
    paymentNumber: "ISOLATED-PAYMENT",
    amountKobo: "24690",
    currency: "NGN",
    status: verified ? "SUCCEEDED" : "PROCESSING",
    purpose: "ORDER_PAYMENT",
    expiresAt: null,
    orderId: order.id,
    invoiceId: null,
    bookingId: null,
    vehicleTransactionId: null,
    attempts: [
      {
        id: id(10),
        provider: "PAYSTACK",
        status: verified ? "SUCCEEDED" : "PENDING",
        verificationStatus: verified ? "VERIFIED" : "PENDING",
        initiatedAt: "2026-09-12T09:00:00Z",
        paidAt: verified ? "2026-09-12T09:05:00Z" : null,
      },
    ],
  });
  await isolate(page, async (route, path) => {
    if (path.endsWith("/verify")) {
      verified = true;
      await reply(route, payment());
      return true;
    }
    if (path === `/customers/payments/${id(9)}`) {
      await reply(route, payment());
      return true;
    }
    if (/\/(paystack|monnify)$/.test(path)) {
      initiationCalls++;
      await failure(route, "NOT_FOUND", 404);
      return true;
    }
  });
  await page.goto(`/dashboard/payments/${id(9)}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Your payment is being processed.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Paystack" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Check with provider" }).click();
  await expect(page.getByText("SUCCEEDED", { exact: true })).toBeVisible();
  expect(initiationCalls).toBe(0);
});

test("customer cannot enter administrator screens", async ({ page }) => {
  let administrativeRequests = 0;
  await isolate(page, async (route, path) => {
    if (path.startsWith("/admin/")) {
      administrativeRequests++;
      await failure(route, "FORBIDDEN", 403);
      return true;
    }
  });
  const response = await page.goto("/admin/categories", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Review changes" })).toHaveCount(0);
  expect(administrativeRequests).toBe(0);
});

test("a failed orders request does not claim the account has no orders", async ({
  page,
}) => {
  let recovered = false;
  await isolate(page, async (route, path) => {
    if (path === "/customers/orders") {
      if (recovered) await reply(route, { items: [] });
      else await failure(route, "SERVICE_UNAVAILABLE", 503);
      return true;
    }
  });
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Retry orders" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toHaveCount(0);
  recovered = true;
  await page.getByRole("button", { name: "Retry orders" }).click();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
});

test("session invalidation removes the previous customer's orders before revalidation", async ({
  page,
}) => {
  let account = 6;
  await isolate(page, async (route, path) => {
    if (path === "/auth/session") {
      await reply(route, session("CUSTOMER", account));
      return true;
    }
    if (path === "/customers/orders") {
      await reply(route, { items: account === 6 ? [order] : [] });
      return true;
    }
  });
  await page.goto("/dashboard/orders", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(order.orderNumber)).toBeVisible();
  account = 11;
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByText(order.orderNumber)).toHaveCount(0);
  await page.getByRole("button", { name: "Verify session again" }).click();
  await expect(page.getByText("account-11@example.test")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await expect(page.getByText(order.orderNumber)).toHaveCount(0);
});

test("administrator reviews category changes before submitting the exact contract", async ({
  page,
}) => {
  const mutations: unknown[] = [];
  await isolate(
    page,
    async (route, path) => {
      if (path === "/admin/catalog/categories") {
        if (route.request().method() === "POST") {
          mutations.push(route.request().postDataJSON());
          await reply(route, { ...category, isActive: true });
        } else
          await reply(route, {
            items: mutations.length ? [{ ...category, isActive: true }] : [],
          });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/categories", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name", { exact: true }).fill("Test category");
  await page.getByLabel("URL name").fill("test-category");
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(mutations).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm save" }).click();
  await expect(page.getByText("Category saved.")).toBeVisible();
  expect(mutations).toEqual([
    { name: "Test category", slug: "test-category", description: null, isActive: true },
  ]);
  await expect(
    page.getByRole("cell", { name: "Test category", exact: true }),
  ).toBeVisible();
});

test("administrator lookup paging preserves the edited category without submitting the form", async ({
  page,
}) => {
  let mutations = 0;
  const second = { ...category, id: id(33), name: "Second test category" };
  await isolate(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") mutations++;
      if (path === "/admin/catalog/products") {
        await reply(route, { items: [{ ...product, isActive: true, featured: false }] });
        return true;
      }
      if (path === "/admin/catalog/categories") {
        const next = new URL(route.request().url()).searchParams.has("cursor");
        await reply(route, {
          items: next ? [second] : [category],
          ...(next ? {} : { nextCursor: category.id }),
        });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "View & edit" }).click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(category.id);
  const pagination = page.getByRole("navigation", { name: "Category choices pages" });
  await pagination.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByLabel("Category", { exact: true }).locator(`option[value='${second.id}']`),
  ).toHaveCount(1);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(category.id);
  await page.getByLabel("Category", { exact: true }).selectOption(second.id);
  await pagination.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page
      .getByLabel("Category", { exact: true })
      .locator(`option[value='${category.id}']`),
  ).toHaveCount(1);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(second.id);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(mutations).toBe(0);
});
