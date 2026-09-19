import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { PaymentRecord } from "@/lib/api/payment-schemas";
import type { CustomerVehicleSale } from "@/lib/api/vehicle-payment";
const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const saleFixture = (): CustomerVehicleSale => ({
  id: id(1),
  transactionNumber: "TEST-PURCHASE",
  status: "RESERVED",
  version: 3,
  askingPriceKobo: "9007199254740995",
  agreedPriceKobo: "9007199254740993",
  reservationRequiredKobo: "10001",
  currency: "NGN",
  reservationExpiresAt: "2027-01-01T00:00:00Z",
  termsVersion: null,
  termsAcceptedAt: null,
  paidAt: null,
  cancellationReason: null,
  createdAt: time,
  vehicleListing: { id: id(2), title: "Test purchase vehicle", status: "RESERVED" },
  statusHistory: [],
  handover: null,
});
const paymentFixture = (n = 20): PaymentRecord => ({
  id: id(n),
  paymentNumber: `TEST-PAYMENT-${n}`,
  amountKobo: "10001",
  currency: "NGN",
  status: "REQUIRES_PAYMENT",
  purpose: "VEHICLE_RESERVATION",
  expiresAt: "2027-01-01T00:00:00Z",
  orderId: null,
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: id(1),
  attempts: [],
});
const ok = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "vehicle-payment-test" },
    },
  });
const fail = (route: Route, status = 503) =>
  route.fulfill({
    status,
    json: {
      success: false,
      message: "Private exception",
      error: { code: status === 409 ? "CONFLICT" : "DATABASE_UNAVAILABLE" },
    },
  });
async function fixture(page: Page) {
  const state = {
    sale: saleFixture(),
    pages: [[]] as PaymentRecord[][],
    failHistory: false,
    failPurchase: false,
    repeatedCursor: false,
    mode: "success",
    serverAmount: "10001",
    reads: [] as string[],
    writes: [] as {
      endpoint: string;
      body: Record<string, unknown>;
      key?: string;
      csrf?: string;
    }[],
    saved: paymentFixture(),
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return ok(route, {
        id: id(10),
        user: { id: id(11), email: "vehicle-pay@example.test", role: "CUSTOMER" },
        mfaRequired: false,
        mfaVerifiedAt: null,
      });
    if (endpoint === "/auth/csrf")
      return ok(route, { csrfToken: "isolated-vehicle-pay-csrf-".repeat(3) });
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (endpoint === `/customers/vehicle-transactions/${id(1)}`)
        return state.failPurchase ? fail(route) : ok(route, state.sale);
      if (endpoint === "/customers/payments") {
        if (state.failHistory) return fail(route);
        const index = url.searchParams.has("cursor") ? 1 : 0;
        return ok(route, {
          items: state.pages[index] ?? [],
          ...((index === 0 && state.pages.length > 1) || state.repeatedCursor
            ? { nextCursor: id(80) }
            : {}),
        });
      }
      if (endpoint === `/customers/payments/${id(20)}`) return ok(route, state.saved);
      return ok(route, { items: [] });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({
      endpoint,
      body,
      key: request.headers()["idempotency-key"],
      csrf: request.headers()["x-csrf-token"],
    });
    if (endpoint === "/customers/payments") {
      state.saved = {
        ...paymentFixture(),
        purpose: String(body.purpose),
        amountKobo: state.serverAmount,
      };
      if (state.mode === "wrong-target") state.saved.vehicleTransactionId = id(99);
      if (state.mode === "wrong-purpose") state.saved.purpose = "ORDER_PAYMENT";
      if (state.mode === "rejected") return fail(route, 409);
      state.pages = [[state.saved]];
      if (state.mode === "unknown") return fail(route);
      return ok(route, { payment: state.saved, replayed: state.writes.length > 1 });
    }
    return fail(route, 409);
  });
  return state;
}
const purchasePath = `/dashboard/vehicle-transactions/${id(1)}`;
async function review(page: Page, purpose = "VEHICLE_RESERVATION") {
  await page.getByLabel("Payment purpose", { exact: true }).selectOption(purpose);
  await page.getByRole("button", { name: "Review payment request", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
const confirm = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Request payment amount", exact: true })
    .click();
for (const purpose of [
  "VEHICLE_RESERVATION",
  "VEHICLE_PARTIAL_PAYMENT",
  "VEHICLE_BALANCE_PAYMENT",
  "VEHICLE_FULL_PAYMENT",
]) {
  test(`${purpose} creates only the exact source and purpose, then opens existing payment options`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.serverAmount =
      purpose === "VEHICLE_FULL_PAYMENT"
        ? state.sale.agreedPriceKobo!
        : purpose === "VEHICLE_BALANCE_PAYMENT"
          ? "9007199254740001"
          : "10001";
    await page.goto(purchasePath);
    await review(page, purpose);
    await expect(page.getByRole("dialog")).toContainText("90,071,992,547,409.93");
    await expect(page.getByRole("dialog")).toContainText(
      "does not accept reservation terms",
    );
    expect(state.writes).toHaveLength(0);
    await confirm(page);
    const next = page.getByRole("link", {
      name: "Review payment & checkout options",
      exact: true,
    });
    await expect(next).toBeVisible();
    expect(state.writes[0].body).toEqual({
      targetType: "VEHICLE_TRANSACTION",
      targetId: id(1),
      purpose,
    });
    expect(state.writes[0].key).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.writes[0].csrf).toBeTruthy();
    await next.click();
    await expect(page).toHaveURL(`/dashboard/payments/${id(20)}`);
    await expect(
      page.getByRole("button", { name: "Continue with Paystack", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View vehicle purchase", exact: true }),
    ).toHaveAttribute("href", purchasePath);
    expect(state.writes).toHaveLength(1);
  });
}
for (const status of ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"] as const) {
  test(`${status} on a later history page blocks a duplicate request`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const other = { ...paymentFixture(21), vehicleTransactionId: id(99) };
    state.pages = [[other], [{ ...paymentFixture(), status }]];
    await page.goto(purchasePath);
    await expect(
      page.getByRole("link", { name: "TEST-PAYMENT-20", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "TEST-PAYMENT-21", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review payment request", exact: true }),
    ).toBeDisabled();
    expect(state.reads).toContain(`/customers/payments?limit=100&cursor=${id(80)}`);
    expect(state.writes).toHaveLength(0);
  });
}
for (const broken of ["failed", "cursor"]) {
  test(`${broken} payment history never claims empty history or permits creation`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.failHistory = broken === "failed";
    state.repeatedCursor = broken === "cursor";
    await page.goto(purchasePath);
    await expect(
      page.getByText(/could not check the complete payment history/),
    ).toBeVisible();
    await expect(
      page.getByText("No payment requests for this purchase were found."),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review payment request", exact: true }),
    ).toBeDisabled();
    state.failHistory = false;
    state.repeatedCursor = false;
    await page
      .getByRole("button", { name: "Refresh purchase payments", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Review payment request", exact: true }),
    ).toBeEnabled();
  });
}
for (const change of ["price", "deadline", "existing-request"]) {
  test(`fresh ${change} check prevents a stale payment request`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(purchasePath);
    await review(page);
    if (change === "price") state.sale.agreedPriceKobo = "20001";
    if (change === "deadline") state.sale.reservationExpiresAt = "2000-01-01T00:00:00Z";
    if (change === "existing-request") state.pages = [[paymentFixture()]];
    await confirm(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    expect(state.writes).toHaveLength(0);
  });
}
test("unknown creation recovers the original key and purpose even after the purchase changes", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "unknown";
  await page.goto(purchasePath);
  await review(page, "VEHICLE_BALANCE_PAYMENT");
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Payment purpose", { exact: true })).toHaveCount(0);
  state.mode = "success";
  state.sale.status = "PARTIALLY_PAID";
  state.sale.version++;
  await page
    .getByRole("button", { name: "Refresh purchase progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check the same payment request", exact: true })
    .click();
  await confirm(page);
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test("a rejected replay after expiry stays in reconciliation instead of permitting a fresh key", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "unknown";
  await page.goto(purchasePath);
  await review(page);
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  state.mode = "rejected";
  state.sale.status = "EXPIRED";
  await page
    .getByRole("button", { name: "Refresh purchase progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check the same payment request", exact: true })
    .click();
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Payment purpose", { exact: true })).toHaveCount(0);
  expect(state.writes[1].key).toBe(state.writes[0].key);
});
for (const mode of ["wrong-target", "wrong-purpose"]) {
  test(`${mode} success is not acknowledged or offered as a payment destination`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = mode;
    await page.goto(purchasePath);
    await review(page);
    await confirm(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("link", { name: "Review payment & checkout options", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/This payment request has an unknown outcome/),
    ).toBeVisible();
  });
}
for (const status of [
  "CANCELLED",
  "EXPIRED",
  "PAID",
  "HANDOVER_PENDING",
  "COMPLETED",
] as const) {
  test(`${status} purchase has no enabled creation control`, async ({ page }) => {
    const state = await fixture(page);
    state.sale.status = status;
    await page.goto(purchasePath);
    await expect(
      page.getByText("This purchase is not open for another payment request."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review payment request", exact: true }),
    ).toBeDisabled();
    expect(state.writes).toHaveLength(0);
  });
}
test("approved amounts and previous settlement determine available purposes without an invented balance", async ({
  page,
}) => {
  const state = await fixture(page);
  state.sale.reservationRequiredKobo = null;
  state.pages = [[{ ...paymentFixture(), status: "SUCCEEDED" }]];
  await page.goto(purchasePath);
  const select = page.getByLabel("Payment purpose", { exact: true });
  await expect(select.locator('option[value="VEHICLE_RESERVATION"]')).toBeDisabled();
  await expect(select.locator('option[value="VEHICLE_PARTIAL_PAYMENT"]')).toBeDisabled();
  await expect(select.locator('option[value="VEHICLE_FULL_PAYMENT"]')).toBeDisabled();
  await expect(select.locator('option[value="VEHICLE_BALANCE_PAYMENT"]')).toBeEnabled();
  await review(page, "VEHICLE_BALANCE_PAYMENT");
  await expect(page.getByRole("dialog")).toContainText("server will calculate");
  expect(state.writes).toHaveLength(0);
});
test("the reservation deadline disables creation while the page remains open", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(time) });
  const state = await fixture(page);
  state.sale.reservationExpiresAt = "2026-09-17T10:01:00Z";
  await page.goto(purchasePath);
  await expect(
    page.getByRole("button", { name: "Review payment request", exact: true }),
  ).toBeEnabled();
  await page.clock.fastForward(61_000);
  await expect(page.getByText(/recorded reservation deadline has passed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review payment request", exact: true }),
  ).toBeDisabled();
});
test("account changes discard purchase payment history and open confirmation", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(purchasePath);
  await review(page);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("TEST-PURCHASE", { exact: true })).toHaveCount(0);
});
for (const width of [320, 1280]) {
  test(`vehicle payment review is accessible at ${width}px`, async ({ page }) => {
    await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (["error", "warning"].includes(entry.type())) errors.push(entry.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(purchasePath);
    await expect(page).toHaveURL(purchasePath);
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vehicle purchase progress",
    );
    await review(page, "VEHICLE_FULL_PAYMENT");
    await page.evaluate(() =>
      window.scrollTo({ top: window.scrollY, behavior: "instant" }),
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-vehicle-payment-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Review payment request", exact: true }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
