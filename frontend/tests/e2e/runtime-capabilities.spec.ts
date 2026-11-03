import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";
import { ordersFixture, orderRecord, orderId } from "../fixtures/customer-orders";
import { purchaseFixture, guestProduct } from "../fixtures/purchase-guest";
import { branch } from "../fixtures/public-account-actions";
import { workOrderDetailFixture } from "../fixtures/work-order-detail";

// This control belongs to a separate loopback, in-memory API fixture, never the application.
const control = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;

for (const width of [320, 1440]) {
  test(`chosen cart vehicle reaches an automatically checked guest order at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    const state = await purchaseFixture(page);
    const selection = {
      vehicleModelId: orderId(5000),
      year: 2026,
      engineCode: "Synthetic engine",
    };
    await page.addInitScript(
      ({ productId, selection }) =>
        localStorage.setItem(
          "aat:purchase-cart:1",
          JSON.stringify([{ productId, quantity: 2, vehicleSelection: selection }]),
        ),
      { productId: guestProduct.id, selection },
    );
    await page.route(`**/api/v1/public/fitment/models/${orderId(5000)}`, (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic cart model",
          meta: { requestId: "cart-vehicle-fixture" },
          data: {
            id: orderId(5000),
            makeId: orderId(5001),
            name: "Synthetic test model",
            yearFrom: 2020,
            yearTo: 2030,
            make: { id: orderId(5001), name: "Synthetic test make" },
          },
        },
      }),
    );
    const packets: unknown[] = [];
    await page.route("**/api/v1/purchase/orders", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const body = route.request().postDataJSON();
      packets.push(body);
      expect(body.items).toEqual([
        { productId: guestProduct.id, quantity: 2, vehicleSelection: selection },
      ]);
      state.saved = true;
      Object.assign(state.order.purchaseReviews[0].requirements.lines[0], { selection });
      return route.fulfill({
        status: 201,
        json: {
          success: true,
          message: "Synthetic automatic offer",
          meta: { requestId: "cart-vehicle-fixture" },
          data: { order: state.order, replayed: false },
        },
      });
    });
    await page.goto("/cart");
    await expect(
      page.getByText("For Synthetic test make Synthetic test model, 2026", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Engine code: Synthetic engine", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Your name", { exact: true }).fill("Synthetic guest cart test");
    await page.getByLabel("Contact phone", { exact: true }).fill("+2348000000000");
    await page.getByLabel("Collection branch", { exact: true }).selectOption(branch.id);
    await page
      .getByRole("button", { name: "Review collection details", exact: true })
      .click();
    await page.screenshot({ path: info.outputPath(`cart-vehicle-before-${width}.png`) });
    await page.getByRole("button", { name: "Create unpaid order", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/purchase/orders/${state.order.id}$`));
    await expect(
      page.getByRole("button", { name: "Review payment", exact: true }),
    ).toBeEnabled();
    expect(packets).toHaveLength(1);
    expect(state.order.items[0].quantity).toBe(2);
    expect(state.order.totalKobo).toBe("21500");
    expect(state.order.paidAt).toBeNull();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page
      .getByRole("region", { name: "Suitability and availability" })
      .scrollIntoViewIfNeeded();
    const approvedPanel = page.getByRole("region", {
      name: "Suitability and availability",
    });
    const paymentLink = await approvedPanel
      .getByRole("link", { name: "View payment options" })
      .boundingBox();
    const refreshButton = await approvedPanel
      .getByRole("button", { name: "Refresh order status" })
      .boundingBox();
    expect(paymentLink).not.toBeNull();
    expect(refreshButton).not.toBeNull();
    expect(
      refreshButton!.y - paymentLink!.y - paymentLink!.height,
    ).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: info.outputPath(`cart-vehicle-after-${width}.png`) });
    const paymentRequest = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === "/api/v1/purchase/payments" &&
        req.method() === "POST",
    );
    await page.getByRole("button", { name: "Review payment", exact: true }).click();
    expect((await paymentRequest).postDataJSON()).toEqual({
      orderId: state.order.id,
      acceptedReview: {
        id: state.order.purchaseReviews[0].id,
        revision: state.order.purchaseReviews[0].revision,
      },
    });
    await expect(page).toHaveURL(new RegExp(`/purchase/payments/${state.payment.id}$`));
    expect(state.order.paidAt).toBeNull();
  });
  test(`staff exception review supports keyboard and a reasoned decision at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    const { detail: state } = await workOrderDetailFixture(page);
    Object.assign(state.record, {
      status: "PENDING",
      paidAt: null,
      allowedTransitions: ["CANCELLED"],
      purchaseReviews: [
        {
          ...orderRecord(3).purchaseReviews[0],
          status: "REQUESTED",
          decidedAt: null,
          expiresAt: null,
          requirements: {
            lines: state.record.items.map((item) => ({
              orderItemId: item.id,
              selection: null,
            })),
          },
        },
      ],
    });
    const writes: unknown[] = [];
    await page.route(
      `**/api/v1/admin/orders/${state.record.id}/purchase-review/decision`,
      async (route) => {
        const body = route.request().postDataJSON();
        writes.push(body);
        expect(body.decision).toBe("DECLINED");
        expect(body.availability).toEqual([]);
        expect(body.expectedVersion).toBe(state.record.version);
        state.record.version++;
        Object.assign(state.record.purchaseReviews[0], {
          status: "DECLINED",
          decidedAt: new Date().toISOString(),
        });
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic review",
            meta: { requestId: "purchase-review-fixture" },
            data: state.record,
          },
        });
      },
    );
    await page.goto(`/admin/orders/${state.record.id}`);
    await expect(
      page.getByRole("heading", { name: "Purchase review needed" }),
    ).toBeVisible();
    await page.getByLabel("Outcome", { exact: true }).selectOption("DECLINED");
    await page
      .getByLabel("Reason and next step")
      .fill("Synthetic fixture: confirm the missing specification with the customer.");
    const opener = page.getByRole("button", { name: "Review decision", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(writes).toHaveLength(0);
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: info.outputPath(`staff-review-dialog-${width}.png`) });
    await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Purchase review needed" }),
    ).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(state.record.paidAt).toBeNull();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
  test(`explicit repeat-purchase details unlock verified payment at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    const state = await ordersFixture(page);
    const current = state.records.find((entry) => entry.id === orderId(3))!;
    current.purchaseReviews = [];
    current.paymentDueAt = null;
    const previous = orderRecord(1);
    await page.route("**/api/v1/auth/csrf", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic CSRF",
          meta: { requestId: "purchase-review-fixture" },
          data: { csrfToken: "s".repeat(43) },
        },
      }),
    );
    await page.route(`**/api/v1/public/fitment/models/${orderId(5000)}`, (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic vehicle names",
          meta: { requestId: "purchase-review-fixture" },
          data: {
            id: orderId(5000),
            makeId: orderId(5001),
            name: "Synthetic test model",
            yearFrom: 2020,
            yearTo: 2030,
            make: { id: orderId(5001), name: "Synthetic test make" },
          },
        },
      }),
    );
    const submissions: unknown[] = [];
    await page.route(
      `**/api/v1/customers/orders/${current.id}/purchase-review`,
      async (route) => {
        const body = route.request().postDataJSON();
        submissions.push(body);
        expect(body.expectedVersion).toBe(current.version);
        expect(body.lines).toHaveLength(2);
        expect(body.lines[0].selection.vehicleModelId).toBe(orderId(5000));
        expect(body.lines[1].selection.position).toBe("front");
        current.version += 2;
        current.paymentDueAt = previous.paymentDueAt;
        current.purchaseReviews = [
          {
            ...previous.purchaseReviews[0],
            id: orderId(9003),
            revision: 1,
            requirements: { lines: body.lines },
          },
        ];
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic review",
            meta: { requestId: "purchase-review-fixture" },
            data: current,
          },
        });
      },
    );
    await page.goto(`/dashboard/orders/${current.id}`);
    await expect(
      page.getByRole("button", { name: "Review payment options" }),
    ).toBeDisabled();
    const panel = page.getByRole("region", { name: "Suitability and availability" });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`suitability-before-${width}.png`) });
    await page.getByText("Use details from a previous purchase", { exact: true }).click();
    await page.getByRole("button", { name: "Find previous purchases" }).click();
    await expect(page.getByLabel("Intended use").first()).toHaveValue("help");
    await page
      .getByRole("button", {
        name: `Use details from ${previous.orderNumber}`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Model", { exact: true }).first()).toHaveValue(
      "Synthetic test model",
    );
    const editableAccessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(editableAccessibility.violations).toEqual([]);
    await page.getByRole("button", { name: "Check details and availability" }).click();
    await expect(
      page.getByRole("button", { name: "Review payment options" }),
    ).toBeEnabled();
    await expect(
      page.getByText("Change vehicle or part details", { exact: true }),
    ).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(state.writes.filter((path) => path.includes("payments"))).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`suitability-after-${width}.png`) });
    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    const paymentBodies: unknown[] = [];
    await page.route("**/api/v1/customers/payments**", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic history",
            meta: { requestId: "offer-fixture" },
            data: { items: [] },
          },
        });
      paymentBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          message: "Untrusted synthetic server message which must not be displayed.",
          error: { code: "PURCHASE_OFFER_CHANGED" },
          meta: { requestId: "offer-fixture" },
        },
      });
    });
    await page.getByRole("button", { name: "Review payment options" }).click();
    await page
      .getByRole("button", { name: "Create payment request", exact: true })
      .click();
    await expect(
      page.getByText(
        "The offer changed. Refresh the order and review its current details before continuing.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          "The offer changed. Refresh the order and review its current details before continuing.",
      }),
    ).toBeInViewport({ ratio: 1 });
    expect(paymentBodies).toEqual([
      {
        targetType: "ORDER",
        targetId: current.id,
        purpose: "ORDER_PAYMENT",
        acceptedReview: {
          id: current.purchaseReviews[0].id,
          revision: current.purchaseReviews[0].revision,
        },
      },
    ]);
    await expect(
      page.getByText("Untrusted synthetic server message which must not be displayed.", {
        exact: true,
      }),
    ).toHaveCount(0);
    expect(current.paidAt).toBeNull();
    await page.screenshot({
      path: info.outputPath(`payment-offer-changed-${width}.png`),
    });
  });
  test(`guest uncertainty preserves a clear next step without offering payment at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    const state = await purchaseFixture(page);
    Object.assign(state.order, { purchaseReviews: [], paymentDueAt: null });
    let writes = 0;
    await page.route(
      `**/api/v1/purchase/orders/${state.order.id}/purchase-review`,
      async (route) => {
        const body = route.request().postDataJSON();
        writes++;
        expect(body.lines[0].selection).toBeNull();
        Object.assign(state.order, {
          version: 1,
          purchaseReviews: [
            {
              id: orderId(9900),
              revision: 1,
              status: "REQUESTED",
              createdAt: new Date().toISOString(),
              decidedAt: null,
              expiresAt: null,
              requirements: { lines: body.lines },
            },
          ],
        });
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic review",
            meta: { requestId: "purchase-review-fixture" },
            data: state.order,
          },
        });
      },
    );
    await page.goto(`/purchase/orders/${state.order.id}`);
    await expect(
      page.getByRole("heading", { name: "Suitability and availability" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review payment", exact: true }),
    ).toHaveCount(0);
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === `/api/v1/purchase/orders/${state.order.id}`,
    );
    await page.getByRole("button", { name: "Check details and availability" }).click();
    await refreshed;
    await expect(page.getByRole("heading", { name: "Next step" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check saved details" })).toHaveCount(
      0,
    );
    await expect(
      page
        .getByText(
          "We’ll check suitability and availability, then let you know when you can pay.",
          { exact: true },
        )
        .first(),
    ).toBeVisible();
    expect(writes).toBe(1);
    await expect(
      page.getByRole("button", { name: "Review payment", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("heading", { name: "Next step" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`guest-review-pending-${width}.png`) });
  });
}
test.beforeEach(async ({ page }) => {
  if (process.env.CAPABILITY_TEST_TRANSPORT !== "loopback") return;
  if (!control || !/^http:\/\/127\.0\.0\.1:\d+$/.test(control))
    throw Error("The browser fixture transport must remain loopback-only");
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${control}${url.pathname}${url.search}`,
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
});
async function availability(
  request: APIRequestContext,
  mode = "browse_enquiries",
  extra = {},
) {
  if (!control || !/^http:\/\/127\.0\.0\.1:\d+$/.test(control))
    throw Error("A loopback capability fixture is required");
  const response = await request.post(`${control}/__capabilities`, {
    data: { mode, ...extra },
  });
  expect(response.ok()).toBe(true);
}
for (const width of [320, 768, 1440]) {
  test(`independent module switches retain truthful journeys at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await availability(request, "full", {
      checkoutApproved: true,
      bookingRequestsEnabled: false,
      productPurchasesEnabled: true,
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Ask about a workshop visit", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`booking-closed-${width}.png`) });
    await page.goto(
      "/services/request?serviceGroup=37ec8bcf-7edc-4ec7-a185-ec849d71c5de",
    );
    await expect(
      page.getByRole("heading", { name: "Contact the workshop" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Describe your concern" }),
    ).toHaveAttribute(
      "href",
      "/contact?serviceGroup=37ec8bcf-7edc-4ec7-a185-ec849d71c5de#enquiry",
    );
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Returning from checkout does not confirm payment",
    );
    await availability(request, "full", {
      checkoutApproved: true,
      bookingRequestsEnabled: true,
      productPurchasesEnabled: false,
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Request a visit", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`booking-open-checkout-closed-${width}.png`),
    });
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
  test(`runtime availability overrides deployment-time copy and guards direct checkout at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request);
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    page.on("request", (r) => {
      if (
        new URL(r.url()).pathname.startsWith("/api/v1/") &&
        !["GET", "HEAD"].includes(r.method())
      )
        writes.push(r.url());
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    const response = await page.request.get("/checkout");
    expect(new URL(response.url()).pathname).toBe("/contact");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`runtime-disabled-${width}.png`) });
    expect(writes).toEqual([]);
  });
  test(`full appointment availability remains distinct from closed finance at ${width}px`, async ({
    page,
    request,
  }) => {
    await availability(request, "full", { checkoutApproved: false });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await page.goto("/help/booking-a-service");
    await expect(page.locator("main")).toContainText("Sign in to send a booking request");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
    await availability(request, "full");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Returning from checkout does not confirm payment",
    );
    await fixture(page, "CUSTOMER");
    // Session API interception alone does not create an HTTP session cookie.
    // Verify the guest handoff first, then explicitly mark this isolated browser
    // as the fixture customer so the server can select the account handoff.
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    const browserContext = page.context();
    await browserContext.addCookies([
      {
        name: "aat_session",
        value: "synthetic-browser-fixture-only",
        url: page.url(),
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/dashboard\/cart#cart-checkout-form$/);
    await expect(
      page.getByRole("heading", { name: "Your cart", exact: true }),
    ).toBeVisible();
  });
  test(`stale tabs close actions and unavailable checks preserve contact drafts at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await availability(request);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    await page.goto("/contact");
    const subject = page.getByLabel("Subject", { exact: true });
    await expect(subject).toBeEnabled();
    await subject.fill("Synthetic unsent availability check");
    await availability(request, "browse_enquiries", { fail: true });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("complementary", { name: "Online availability" }),
    ).toBeVisible();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    await expect(subject).toBeDisabled();
    expect(await (await page.request.get("/register")).text()).toContain(
      "Account creation is temporarily unavailable",
    );
    await availability(request);
    await page.getByRole("button", { name: "Check availability again" }).click();
    await expect(subject).toBeEnabled();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(subject).toBeDisabled();
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(subject).toBeEnabled();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`runtime-recovered-${width}.png`) });
  });
}

test("server-rendered availability remains truthful without JavaScript", async ({
  browser,
  request,
}) => {
  await availability(request, "full", { checkoutApproved: false });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: /^Describe a vehicle problem/ }),
    ).toHaveAttribute("href", "/services/request");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
  } finally {
    await context.close();
  }
});
