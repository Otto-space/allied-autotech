import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { CustomerOrder } from "../../lib/api/order-payment";
import type { PaymentRecord } from "../../lib/api/payment-schemas";

const id = (n: number) => `e9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const initialOrder = (): CustomerOrder => ({
  id: id(1),
  orderNumber: "AA-ORD-2041",
  status: "PENDING",
  fulfillmentMethod: "DELIVERY",
  currency: "NGN",
  subtotalKobo: "6850000",
  discountAmountKobo: "0",
  taxKobo: "513750",
  deliveryFeeKobo: "300000",
  totalKobo: "7663750",
  version: 2,
  createdAt: "2026-10-08T09:00:00Z",
  paymentDueAt: "2099-10-08T09:30:00Z",
  paidAt: null,
  branch: { id: id(2), code: "TEST", name: "Stadium Road workshop" },
  invoice: { id: id(9), invoiceNumber: "AA-INV-2041", status: "ISSUED" },
  deliveryName: "Synthetic Customer",
  deliveryPhone: "+2348000000000",
  deliveryAddress: "12 Synthetic Road",
  deliveryCity: "Port Harcourt",
  deliveryState: "Rivers",
  deliveryCountry: "Nigeria",
  items: [
    {
      id: id(3),
      productId: id(4),
      productName: "Oil filter",
      sku: "AAT-OF-001",
      quantity: 1,
      unitPriceKobo: "1250000",
      subtotalKobo: "1250000",
    },
    {
      id: id(5),
      productId: id(6),
      productName: "Front brake pads",
      sku: "AAT-BP-004",
      quantity: 2,
      unitPriceKobo: "2800000",
      subtotalKobo: "5600000",
    },
  ],
});
const initialPayment = (): PaymentRecord => ({
  id: id(20),
  paymentNumber: "AA-PAY-2041",
  amountKobo: "7663750",
  currency: "NGN",
  purpose: "ORDER_PAYMENT",
  status: "REQUIRES_PAYMENT",
  expiresAt: "2099-10-08T09:30:00Z",
  orderId: id(1),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [],
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "order-quality" },
    },
  });
async function fixture(page: Page) {
  const state = {
    order: initialOrder(),
    payment: initialPayment(),
    history: [] as PaymentRecord[],
    role: "CUSTOMER",
    signedIn: true,
    failOrder: false,
    mismatchOrder: false,
    failHistory: false,
    paginate: false,
    repeatCursor: false,
    historyReads: 0,
    outcome: "success",
    delay: 0,
    reads: 0,
    writes: [] as { path: string; body: Record<string, unknown>; key?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code:
              status === 409
                ? "CONFLICT"
                : status === 401
                  ? "UNAUTHENTICATED"
                  : "NOT_FOUND",
          },
        },
      });
    if (endpoint === "/auth/session")
      return state.signedIn
        ? reply(route, {
            id: id(30),
            user: { id: id(31), email: "synthetic@example.test", role: state.role },
            mfaRequired: state.role !== "CUSTOMER",
            mfaVerifiedAt: state.role !== "CUSTOMER" ? "2026-10-08T09:00:00Z" : null,
          })
        : fail(401);
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "order-quality-csrf-".repeat(4) });
    if (endpoint === `/customers/orders/${id(1)}`) {
      state.reads++;
      if (state.failOrder) return fail(503);
      return reply(route, {
        ...state.order,
        ...(state.mismatchOrder ? { id: id(88) } : {}),
      });
    }
    if (endpoint === "/customers/payments" && route.request().method() === "GET") {
      state.historyReads++;
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.failHistory) return fail(503);
      if (state.repeatCursor) return reply(route, { items: [], nextCursor: id(55) });
      if (state.paginate && !url.searchParams.has("cursor"))
        return reply(route, { items: [], nextCursor: id(55) });
      return reply(route, { items: state.history });
    }
    if (
      route.request().method() === "POST" &&
      ["/customers/payments", `/customers/orders/${id(1)}/cancel`].includes(endpoint)
    ) {
      state.writes.push({
        path: endpoint,
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      expect(route.request().headers()["x-csrf-token"]).toBe(
        "order-quality-csrf-".repeat(4),
      );
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.outcome === "unknown" && state.writes.length === 1)
        return route.abort("failed");
      if (state.outcome === "conflict") return fail(409);
      if (endpoint === "/customers/payments")
        return reply(route, {
          payment: state.payment,
          replayed: state.writes.length > 1,
        });
      state.order.status = "CANCELLED";
      state.order.version++;
      return reply(route, state.order);
    }
    return fail(404);
  });
  return state;
}
async function open(page: Page) {
  await page.goto(`/dashboard/orders/${id(1)}`);
  await expect(
    page.getByRole("heading", { name: "AA-ORD-2041", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await page.getByRole("button", { name: "Review payment options" }).click();
  await expect(
    page.getByRole("heading", { name: "Review payment request", exact: true }),
  ).toBeVisible();
}

test("reviews server amount, creates once and links the validated payment and invoice", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(page).toHaveTitle(/Order details/);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("link", { name: /View invoice/ })).toHaveAttribute(
    "href",
    `/dashboard/invoices/${id(9)}`,
  );
  await review(page);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(
    page.getByRole("link", { name: "View payment", exact: true }),
  ).toHaveAttribute("href", `/dashboard/payments/${id(20)}`);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({
    targetType: "ORDER",
    targetId: id(1),
    purpose: "ORDER_PAYMENT",
  });
  expect(state.writes[0].key?.length).toBeGreaterThan(15);
  await expect(page.getByRole("button", { name: /Paystack|Monnify/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("finds an existing payment beyond the first page without a new write", async ({
  page,
}) => {
  const state = await fixture(page);
  state.paginate = true;
  state.history = [initialPayment()];
  await open(page);
  await page.getByRole("button", { name: "Review payment options" }).click();
  await expect(
    page.getByRole("link", { name: "View payment", exact: true }),
  ).toBeVisible();
  expect(state.historyReads).toBe(2);
  expect(state.writes).toHaveLength(0);
});

test("rechecks history at confirmation and uses a payment created elsewhere", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await review(page);
  state.history = [initialPayment()];
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(
    page.getByRole("link", { name: "View payment", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("changed order amount invalidates review before any payment write", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await review(page);
  state.order.totalKobo = "8000000";
  state.order.version++;
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(
    page.getByText(
      "The order changed. Refresh and review its current total before continuing.",
    ),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

for (const mode of ["failed", "repeated cursor"] as const)
  test(`${mode} history fails closed`, async ({ page }) => {
    const state = await fixture(page);
    state.failHistory = mode === "failed";
    state.repeatCursor = mode === "repeated cursor";
    await open(page);
    await page.getByRole("button", { name: "Review payment options" }).click();
    await expect(page.locator(".customer-order .notice").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create payment request" }),
    ).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });

test("unknown payment creation recovers the same key even after the order expires", async ({
  page,
}) => {
  const state = await fixture(page);
  state.outcome = "unknown";
  await open(page);
  await review(page);
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(
    page.getByRole("button", { name: "Recover payment request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toBeDisabled();
  state.order.paymentDueAt = "2000-01-01T00:00:00Z";
  await page.getByRole("button", { name: "Refresh order" }).click();
  await page.getByRole("button", { name: "Recover payment request" }).click();
  await expect(
    page.getByRole("link", { name: "View payment", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].key).toBe(state.writes[0].key);
  expect(state.writes[1].body).toEqual(state.writes[0].body);
});

test("wrong-target payment receipt never becomes a payment link", async ({ page }) => {
  const state = await fixture(page);
  state.payment.orderId = id(99);
  await open(page);
  await review(page);
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(
    page.getByRole("button", { name: "Recover payment request" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View payment", exact: true })).toHaveCount(
    0,
  );
});

for (const deadline of ["2000-01-01T00:00:00Z", "invalid-date", ""])
  test(`unavailable deadline ${deadline || "empty"} prevents preparation`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.order.paymentDueAt = deadline;
    await open(page);
    await expect(
      page.getByRole("button", { name: "Review payment options" }),
    ).toBeDisabled();
    expect(state.historyReads).toBe(0);
    expect(state.writes).toHaveLength(0);
  });

test("deadline expiring while review is open disables confirmation", async ({ page }) => {
  const state = await fixture(page);
  await page.clock.install({ time: new Date("2026-10-08T09:00:00Z") });
  state.order.paymentDueAt = "2026-10-08T09:00:30Z";
  await open(page);
  await review(page);
  await page.clock.fastForward(31_000);
  await expect(
    page.getByRole("button", { name: "Create payment request" }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("confirmed unpaid orders can review; paid and cancelled orders cannot create", async ({
  page,
}) => {
  const state = await fixture(page);
  state.order.status = "CONFIRMED";
  await open(page);
  await review(page);
  expect(state.writes).toHaveLength(0);
  state.order.paidAt = "2026-10-08T09:01:00Z";
  await page.getByRole("button", { name: "Refresh order" }).click();
  await expect(page.getByText("Payment recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review payment options" })).toHaveCount(
    0,
  );
  state.order.status = "CANCELLED";
  await page.getByRole("button", { name: "Refresh order" }).click();
  await expect(
    page.getByText(/Payment was received, but this order is cancelled/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
});

test("cancellation reviews the order, sends its version and reports the confirmed result", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("AA-ORD-2041");
  await page.getByLabel("Reason for cancellation").fill("Order no longer needed.");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(sessionStorage)
          .filter(
            ([key]) => key.startsWith("aat:form-draft:") && key.includes("order-detail"),
          )
          .map(([, value]) => value)
          .join(""),
      ),
    )
    .toContain("Order no longer needed.");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Order cancelled. Check payment records for any refund status."),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({
    expectedVersion: 2,
    reason: "Order no longer needed.",
  });
  await expect(
    page.getByRole("heading", { name: "Order details", exact: true }),
  ).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(sessionStorage)
          .filter(
            ([key]) => key.startsWith("aat:form-draft:") && key.includes("order-detail"),
          )
          .map(([, value]) => value)
          .join(""),
      ),
    )
    .not.toContain("Order no longer needed.");
});

test("dialog closes with Escape and restores focus; whitespace cannot submit", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Reason for cancellation").fill("   ");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog").getByText(/Enter a reason/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toBeFocused();
});

test("session change discards private review and blocks delayed payment preparation", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  state.delay = 500;
  await page.getByRole("button", { name: "Review payment options" }).click();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(
    page.getByRole("heading", { name: "AA-ORD-2041", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create payment request" })).toHaveCount(
    0,
  );
  expect(state.writes).toHaveLength(0);
});

test("session change clears a saved cancellation draft", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Reason for cancellation").fill("Private cancellation draft.");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(sessionStorage)
          .filter(
            ([key]) => key.startsWith("aat:form-draft:") && key.includes("order-detail"),
          )
          .map(([, value]) => value)
          .join(""),
      ),
    )
    .toContain("Private cancellation draft.");
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(sessionStorage)
          .filter(
            ([key]) => key.startsWith("aat:form-draft:") && key.includes("order-detail"),
          )
          .map(([, value]) => value)
          .join(""),
      ),
    )
    .not.toContain("Private cancellation draft.");
  expect(state.writes).toHaveLength(0);
});

test("unreadable and mismatched orders expose no private details or mutations", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mismatchOrder = true;
  await page.goto(`/dashboard/orders/${id(1)}`);
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AA-ORD-2041", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
  state.mismatchOrder = false;
  await page.getByRole("button", { name: "Refresh order" }).click();
  await expect(
    page.getByRole("heading", { name: "AA-ORD-2041", exact: true }),
  ).toBeVisible();
});

test("copy denial exposes a selectable reference and collection uses recorded branch", async ({
  page,
}) => {
  const state = await fixture(page);
  state.order.fulfillmentMethod = "COLLECTION";
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    }),
  );
  await open(page);
  await page.getByRole("button", { name: "Copy order reference" }).click();
  await expect(page.getByLabel("Order reference", { exact: true })).toBeFocused();
  await expect(page.getByText(/Select and copy the value/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collection details" })).toBeVisible();
  await expect(page.getByText("12 Synthetic Road")).toHaveCount(0);
});

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot read customer order page`, async ({ page }) => {
    const state = await fixture(page);
    state.role = role;
    await page.goto(`/dashboard/orders/${id(1)}`);
    await expect(page).not.toHaveURL(new RegExp(`/dashboard/orders/${id(1)}`));
    expect(state.reads).toBe(0);
    expect(state.writes).toHaveLength(0);
  });

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`order, review and cancellation remain accessible at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 960 });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await review(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Back to order" }).click();
    await page.getByRole("button", { name: "Cancel order", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    for (const button of await page.getByRole("dialog").getByRole("button").all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(box!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(box!.x + box!.width);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeLessThanOrEqual(65);
    }
    await page.getByRole("button", { name: "Keep order", exact: true }).click();
    await review(page);
    await page.getByRole("button", { name: "Create payment request" }).click();
    await expect(
      page.getByRole("link", { name: "View payment", exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });

test("long references and amounts wrap; short mobile dialogs keep actions reachable", async ({
  page,
}) => {
  const state = await fixture(page);
  state.order.orderNumber = "LONG-ORDER-REFERENCE-".repeat(7);
  state.order.items[0].productName = "LongProductName".repeat(12);
  state.order.items[0].sku = "LONGSKU".repeat(20);
  state.order.items[0].subtotalKobo = "999999999999999999";
  state.order.totalKobo = "999999999999999999";
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/dashboard/orders/${id(1)}`);
    await expect(
      page.getByRole("heading", { name: state.order.orderNumber, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Cancel order", exact: true }).click();
    await page.getByLabel("Reason for cancellation").fill("Reason ".repeat(70));
    await page.getByRole("button", { name: "Keep order", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});

test("anonymous access redirects before customer reads", async ({ page }) => {
  const state = await fixture(page);
  state.signedIn = false;
  await page.goto(`/dashboard/orders/${id(1)}`);
  await expect(page).toHaveURL(/\/login/);
  expect(state.reads).toBe(0);
  expect(state.writes).toHaveLength(0);
});

test("unavailable delivery and invoice data have truthful fallbacks", async ({
  page,
}) => {
  const state = await fixture(page);
  state.order.deliveryAddress = null;
  state.order.invoice = null;
  await open(page);
  await expect(page.getByText(/Delivery details are unavailable/)).toBeVisible();
  await expect(
    page.getByText("An invoice is not available on this record."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /View invoice/ })).toHaveCount(0);
});

test("cancellation in flight cannot be submitted twice or dismissed", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  state.delay = 700;
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Reason for cancellation").fill("No longer needed.");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    page.getByRole("button", { name: "Keep order", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
});
