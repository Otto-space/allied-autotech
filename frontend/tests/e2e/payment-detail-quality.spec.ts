import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { PaymentRecord } from "../../lib/api/payment-schemas";
const id = (n: number) => `c9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const initialPayment = (): PaymentRecord => ({
  id: id(1),
  paymentNumber: "AA-PAY-2041",
  amountKobo: "7663750",
  currency: "NGN",
  status: "REQUIRES_PAYMENT",
  purpose: "ORDER_PAYMENT",
  expiresAt: "2099-10-08T11:00:00Z",
  orderId: id(2),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [],
  checkoutProviders: ["PAYSTACK"],
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "payment-quality" },
    },
  });
async function fixture(page: Page) {
  const state = {
    payment: initialPayment(),
    reads: 0,
    writes: [] as { endpoint: string; key?: string; csrf?: string; body: unknown }[],
    mode: "success",
    readStatus: 200,
    changeAfterRead: false,
    disableProviderAfterRead: false,
    role: "CUSTOMER",
    signedIn: true,
    verifyWrongTarget: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session") {
      if (!state.signedIn)
        return route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        });
      return reply(route, {
        id: id(10),
        user: { id: id(11), email: "payment@example.test", role: state.role },
        mfaRequired: false,
        mfaVerifiedAt: null,
      });
    }
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "synthetic-payment-csrf-".repeat(4) });
    if (
      endpoint === `/customers/payments/${id(1)}` &&
      route.request().method() === "GET"
    ) {
      state.reads++;
      if (state.readStatus !== 200)
        return route.fulfill({
          status: state.readStatus,
          json: {
            success: false,
            error: {
              code: state.readStatus === 404 ? "NOT_FOUND" : "DATABASE_UNAVAILABLE",
            },
          },
        });
      if (state.changeAfterRead && state.reads > 1) state.payment.amountKobo = "8000000";
      if (state.disableProviderAfterRead && state.reads > 1)
        state.payment.checkoutProviders = [];
      return reply(route, state.payment);
    }
    if (
      route.request().method() === "POST" &&
      endpoint.startsWith(`/customers/payments/${id(1)}/`)
    ) {
      state.writes.push({
        endpoint,
        key: route.request().headers()["idempotency-key"],
        csrf: route.request().headers()["x-csrf-token"],
        body: route.request().postDataJSON(),
      });
      if (state.mode === "uncertain" && state.writes.length === 1)
        return route.abort("failed");
      if (endpoint.endsWith("/verify")) {
        state.payment.status = "SUCCEEDED";
        state.payment.attempts = state.payment.attempts.map((a) => ({
          ...a,
          status: "SUCCEEDED",
          verificationStatus: "VERIFIED",
        }));
        return reply(route, {
          ...state.payment,
          ...(state.verifyWrongTarget ? { orderId: id(99) } : {}),
        });
      }
      if (endpoint.endsWith("/manual")) {
        state.payment.status = "REQUIRES_REVIEW";
        state.payment.attempts = [
          {
            id: id(3),
            provider: "MANUAL",
            status: "PENDING",
            verificationStatus: "UNVERIFIED",
            initiatedAt: "2026-10-08T09:00:00Z",
            paidAt: null,
          },
        ];
        return reply(route, {
          ...state.payment,
          ...(state.mode === "wrong-manual" ? { orderId: id(99) } : {}),
        });
      }
      if (state.mode === "delayed")
        await new Promise((resolve) => setTimeout(resolve, 800));
      return reply(route, {
        attemptId: id(3),
        authorizationUrl:
          state.mode === "wrong-provider"
            ? "https://sandbox.sdk.monnify.com/synthetic"
            : "https://checkout.paystack.com/synthetic",
        authorizationExpiresAt:
          state.mode === "expired" ? "2020-01-01T00:00:00Z" : "2099-10-08T11:00:00Z",
      });
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.route("https://checkout.paystack.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Synthetic checkout destination</h1>",
    }),
  );
  return state;
}
const visit = (page: Page) => page.goto(`/dashboard/payments/${id(1)}`);
const checkout = (page: Page) =>
  page.getByRole("button", { name: "Continue with Paystack" });
async function fillManual(page: Page) {
  await page.getByLabel("Payer name", { exact: true }).fill("Synthetic payer");
  await page.getByLabel("Payment date and time (Lagos)").fill("2026-10-07T09:00");
  await page.getByRole("button", { name: "Review payment details" }).click();
}
test("checkout rechecks the payable and sends CSRF and one idempotent request before trusted handoff", async ({
  page,
}) => {
  const state = await fixture(page);
  await visit(page);
  await checkout(page).click();
  await expect(page).toHaveURL("https://checkout.paystack.com/synthetic");
  expect(state.reads).toBeGreaterThanOrEqual(2);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    endpoint: `/customers/payments/${id(1)}/paystack`,
    body: {},
  });
  expect(state.writes[0].key).toBeTruthy();
  expect(state.writes[0].csrf).toBeTruthy();
});
test("changed payable prevents initialization and refreshes the amount", async ({
  page,
}) => {
  const state = await fixture(page);
  state.changeAfterRead = true;
  await visit(page);
  await checkout(page).click();
  await expect(
    page.getByText("Payment options changed.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".payment-amount")).toContainText("80,000.00");
  expect(state.writes).toHaveLength(0);
});
test("a provider disabled after the first read cannot be initialized", async ({
  page,
}) => {
  const state = await fixture(page);
  state.disableProviderAfterRead = true;
  await visit(page);
  await checkout(page).click();
  await expect(
    page.getByText("Payment options changed.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Online checkout is currently unavailable.", { exact: false }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
for (const providers of [
  undefined,
  [],
  ["PAYSTACK"],
  ["MONNIFY"],
  ["PAYSTACK", "MONNIFY"],
] as const)
  test(`provider availability ${JSON.stringify(providers)} controls checkout`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.payment.checkoutProviders = providers ? [...providers] : undefined;
    await visit(page);
    await expect(
      page.getByRole("heading", { name: "AA-PAY-2041", exact: true }),
    ).toBeVisible();
    await expect(checkout(page)).toHaveCount(
      providers?.some((p) => p === "PAYSTACK") ? 1 : 0,
    );
    await expect(
      page.getByRole("button", { name: "Pay by bank with Monnify" }),
    ).toHaveCount(providers?.some((p) => p === "MONNIFY") ? 1 : 0);
    await expect(
      page.getByRole("button", { name: "Review payment details" }),
    ).toBeEnabled();
  });
test("uncertain initialization recovers the original body and idempotency key", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "uncertain";
  await visit(page);
  await checkout(page).click();
  await page.getByRole("button", { name: "Reopen the same checkout" }).click();
  await expect(page).toHaveURL("https://checkout.paystack.com/synthetic");
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
});
for (const mode of ["wrong-provider", "expired"])
  test(`${mode} checkout response cannot redirect or initiate another provider`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = mode;
    await visit(page);
    await checkout(page).click();
    await expect(
      page.getByRole("button", { name: "Reopen the same checkout" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/dashboard/payments/${id(1)}`);
    await expect(checkout(page)).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });
test("session change prevents a delayed checkout response from navigating", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "delayed";
  await visit(page);
  await checkout(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await page.waitForTimeout(1100);
  expect(page.url()).not.toContain("checkout.paystack.com");
});
test("verification uses server state and rejects a receipt for a different payable", async ({
  page,
}) => {
  const state = await fixture(page);
  state.payment.status = "PROCESSING";
  state.payment.attempts = [
    {
      id: id(3),
      provider: "PAYSTACK",
      status: "PENDING",
      verificationStatus: "PENDING",
      initiatedAt: "2026-10-08T09:00:00Z",
      paidAt: null,
    },
  ];
  state.verifyWrongTarget = true;
  await visit(page);
  await page.getByRole("button", { name: "Check with provider" }).click();
  await expect(page.locator(".payment-state .status")).toHaveText("Processing");
  await expect(
    page.getByText("We couldn’t confirm your payment yet.", { exact: false }),
  ).toBeVisible();
  state.verifyWrongTarget = false;
  await page.getByRole("button", { name: "Check with provider" }).click();
  await expect(page.locator(".payment-state .status")).toHaveText("Confirmed");
});
test("wrong-target manual receipt remains uncertain and preserves the submitted draft", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "wrong-manual";
  await visit(page);
  await fillManual(page);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("button", { name: "Retry same request" })).toBeVisible();
  await expect(page.getByLabel("Payer name", { exact: true })).toHaveValue(
    "Synthetic payer",
  );
  await expect(
    page.getByText("Your payment details were recorded.", { exact: false }),
  ).toHaveCount(0);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot use customer payment controls`, async ({ page }) => {
    const state = await fixture(page);
    state.role = role;
    await visit(page);
    await expect(page).not.toHaveURL(new RegExp(`/dashboard/payments/${id(1)}$`));
    await expect(checkout(page)).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
    expect(state.reads).toBe(0);
  });
for (const readStatus of [404, 503])
  test(`payment read ${readStatus} cannot expose mutation controls`, async ({ page }) => {
    const state = await fixture(page);
    state.readStatus = readStatus;
    await visit(page);
    await expect(
      page.getByRole("button", { name: "Refresh payment status" }),
    ).toBeEnabled();
    await expect(page.locator(".customer-payment .notice")).toBeVisible();
    await expect(checkout(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review payment details" }),
    ).toHaveCount(0);
  });
test("session invalidation clears a reviewed manual draft and prevents submission", async ({
  page,
}) => {
  const state = await fixture(page);
  await visit(page);
  await fillManual(page);
  const payer = await page.getByLabel("Payer name", { exact: true }).elementHandle();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await payer?.evaluate((el) => (el as HTMLInputElement).value)).toBe("");
  expect(state.writes).toHaveLength(0);
});
for (const width of [390, 1280])
  test(`manual review remains usable at short ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 480 });
    await fixture(page);
    await visit(page);
    await fillManual(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        y: r.y,
        bottom: r.bottom,
        overflow: el.scrollHeight > el.clientHeight + 2,
      };
    });
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(480);
    expect(bounds.overflow).toBe(false);
    for (const button of await dialog.getByRole("button").all()) {
      const b = await button.boundingBox();
      expect(b!.y + b!.height).toBeLessThanOrEqual(480);
      expect(b!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      (await new AxeBuilder({ page }).include(".mutation-review").analyze()).violations,
    ).toEqual([]);
  });
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`payment states and manual review fit ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    await visit(page);
    await expect(
      page.getByRole("heading", { name: "AA-PAY-2041", exact: true }),
    ).toBeVisible();
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(await overflow()).toBe(false);
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `C:/Users/PC/.codex/payment-oct-after-${width}.png`,
        fullPage: true,
      });
    if ([390, 768, 1440].includes(width))
      expect(
        (await new AxeBuilder({ page }).include(".customer-payment").analyze())
          .violations,
      ).toEqual([]);
    await fillManual(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        overflow: el.scrollHeight > el.clientHeight + 2,
      };
    });
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    expect(bounds.overflow).toBe(false);
    for (const button of await dialog.getByRole("button").all()) {
      const b = await button.boundingBox();
      expect(b?.height).toBeGreaterThanOrEqual(44);
      expect(b?.height).toBeLessThan(80);
    }
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `C:/Users/PC/.codex/payment-oct-review-${width}.png`,
      });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Review payment details" }),
    ).toBeFocused();
    for (const status of ["REQUIRES_REVIEW", "SUCCEEDED", "EXPIRED"] as const) {
      state.payment.status = status;
      await page.getByRole("button", { name: "Refresh payment status" }).click();
      await expect(page.locator(".payment-state .status")).toHaveText(
        { REQUIRES_REVIEW: "Needs review", SUCCEEDED: "Confirmed", EXPIRED: "Expired" }[
          status
        ],
      );
      expect(await overflow()).toBe(false);
    }
    expect(errors).toEqual([]);
  });
