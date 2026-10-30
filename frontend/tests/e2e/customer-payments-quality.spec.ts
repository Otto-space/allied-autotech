import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { paymentsFixture, paymentId, paymentRecord } from "../fixtures/customer-payments";

test("server payment status controls confirmation despite a successful attempt", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  Object.assign(state.records[0].attempts[0], {
    status: "SUCCEEDED",
    verificationStatus: "VERIFIED",
    paidAt: "2026-10-08T10:00:00Z",
  });
  await page.goto("/dashboard/payments");
  const rows = page.locator(".paylist-table tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Processing");
  await expect(rows.nth(0)).toContainText("Requested amount");
  await expect(rows.nth(0)).not.toContainText("Confirmed");
  await expect(rows.nth(3)).toContainText("Confirmed amount");
  await expect(page.locator(".customer-payments")).not.toContainText("PAYSTACK");
  expect(state.writes).toEqual([]);
});

test("all six statuses use the backend filter without payment mutations", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  const statuses = [
    "REQUIRES_PAYMENT",
    "PROCESSING",
    "REQUIRES_REVIEW",
    "SUCCEEDED",
    "CANCELLED",
    "EXPIRED",
  ] as const;
  const labels = [
    "Awaiting payment",
    "Processing",
    "Needs review",
    "Confirmed",
    "Cancelled",
    "Expired",
  ];
  state.records = statuses.map((status, i) => paymentRecord(i + 1, status));
  await page.goto("/dashboard/payments");
  for (const [i, status] of statuses.entries()) {
    await page.getByLabel("Payment status", { exact: true }).selectOption(status);
    await expect(page.locator(".paylist-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".paylist-state")).toHaveText(labels[i]);
    await expect.poll(() => state.reads.at(-1)?.searchParams.get("status")).toBe(status);
  }
  expect(state.writes).toEqual([]);
});

test("purposes and linked records use the owner projection without extra reads", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  const purposes = [
    "ORDER_PAYMENT",
    "SERVICE_INVOICE",
    "BOOKING_DEPOSIT",
    "VEHICLE_RESERVATION",
    "VEHICLE_PARTIAL_PAYMENT",
    "VEHICLE_BALANCE_PAYMENT",
    "VEHICLE_FULL_PAYMENT",
  ];
  const labels = [
    "Order payment",
    "Service invoice payment",
    "Booking payment",
    "Vehicle reservation",
    "Vehicle part payment",
    "Vehicle balance",
    "Vehicle purchase",
  ];
  state.records = purposes.map((purpose, i) => ({
    ...paymentRecord(i + 1),
    purpose,
    orderId: i === 0 ? paymentId(201) : null,
    invoiceId: i === 1 ? paymentId(202) : null,
    bookingId: i === 2 ? paymentId(204) : null,
    vehicleTransactionId: i >= 3 ? paymentId(203) : null,
  }));
  const privateReads: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/v1\/customers\/(orders|invoices|bookings|vehicle-transactions)\//.test(
        r.url(),
      )
    )
      privateReads.push(r.url());
  });
  await page.goto("/dashboard/payments");
  for (const label of labels)
    await expect(
      page.locator(".paylist-related strong", { hasText: label }).first(),
    ).toBeVisible();
  for (const [label, ref, path, id] of [
    ["View order", 2041, "orders", 201],
    ["View invoice", 2042, "invoices", 202],
    ["View booking", 2043, "bookings", 204],
    ["View vehicle purchase", 2044, "vehicle-transactions", 203],
  ] as const)
    await expect(
      page.getByRole("link", { name: `${label} for AA-PAY-${ref}`, exact: true }),
    ).toHaveAttribute("href", `/dashboard/${path}/${paymentId(id)}`);
  expect(privateReads).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("long references, missing context and exact large amounts fit a narrow screen", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  state.records = [
    {
      ...paymentRecord(),
      paymentNumber: "ExtendedPaymentReference".repeat(12),
      amountKobo: "9007199254740993",
      createdAt: null,
      orderId: null,
      invoiceId: null,
      bookingId: null,
      vehicleTransactionId: null,
      purpose: "constructor",
    },
  ];
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard/payments");
  const table = page.locator(".paylist-table");
  await expect(table).toContainText("90,071,992,547,409.93");
  await expect(table).toContainText("Date not provided");
  await expect(table).toContainText("See payment details");
  await expect(table).toContainText("Payment request");
  await expect(table).not.toContainText("constructor");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("invalid creation dates fail closed", async ({ page }) => {
  const state = await paymentsFixture(page);
  state.records[0].createdAt = "invalid-date";
  await page.goto("/dashboard/payments");
  await expect(page.getByRole("heading", { name: /load your payments/ })).toBeVisible();
  await expect(page.locator(".paylist-table")).toHaveCount(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`payments fit ${width}px with readable records and controls`, async ({ page }) => {
    await paymentsFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/payments");
    await expect(
      page.getByRole("heading", { name: "AA-PAY-2041", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator(".customer-payments a,.customer-payments button,.customer-payments select")
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
    await expect(page.locator('.paylist-breadcrumb ol [aria-current="page"]')).toHaveText(
      "Payments",
    );
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }).last(),
    ).toHaveAttribute("href", "/dashboard");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`payments accessibility ${width}px`, async ({ page }) => {
    await paymentsFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/payments");
    await expect(page.locator(".paylist-table")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("status and page size persist across reload, Back and Forward", async ({ page }) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments");
  await page
    .getByLabel("Payment status", { exact: true })
    .selectOption("REQUIRES_REVIEW");
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(1);
  await expect(page).toHaveURL(/status=REQUIRES_REVIEW/);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.reload();
  await expect(page.getByLabel("Payment status", { exact: true })).toHaveValue(
    "REQUIRES_REVIEW",
  );
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.goBack();
  await expect(page.getByLabel("Rows per page")).toHaveValue("20");
  await page.goForward();
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Payment status", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("cursor pages survive reload and return to the correct prior page", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments");
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".paylist-pagination")).toContainText("Page 2");
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#paylist-results")).toBeFocused();
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.locator(".paylist-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
});
test("a direct cursor link uses first-page recovery without inventing a page number", async ({
  page,
}) => {
  await paymentsFixture(page);
  await page.goto(`/dashboard/payments?cursor=${paymentId(4)}`);
  await expect(page.locator(".paylist-pagination")).toContainText("Later page");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
});
test("changing status resets cursor and ignores untrusted query fields", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  await page.goto(
    `/dashboard/payments?cursor=${paymentId(4)}&_trail=start&customerId=${paymentId(999)}`,
  );
  await expect(page.locator(".paylist-table")).toBeVisible();
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page
    .getByLabel("Payment status", { exact: true })
    .selectOption("REQUIRES_PAYMENT");
  await expect(page.locator(".paylist-table")).toContainText("AA-PAY-2043");
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
});
test("invalid filters fail safely with a visible explanation", async ({ page }) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments?status=ADMIN&limit=99999&cursor=bad");
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  expect(state.reads[0].searchParams.get("limit")).toBe("20");
  expect(state.reads[0].searchParams.has("status")).toBe(false);
});
for (const mode of ["error", "malformed"])
  test(`${mode} hides stale records and offers retry`, async ({ page }) => {
    const state = await paymentsFixture(page);
    await page.goto("/dashboard/payments");
    await expect(page.locator(".paylist-table")).toBeVisible();
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your payments" }),
    ).toBeVisible();
    await expect(page.locator(".paylist-table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry payments", exact: true }).click();
    await expect(page.locator(".paylist-table")).toBeVisible();
  });
test("empty and filtered-empty accounts have different recovery actions", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  state.mode = "empty";
  await page.goto("/dashboard/payments");
  await expect(
    page.getByRole("heading", { name: "No payments yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to overview", exact: true }).last(),
  ).toHaveAttribute("href", "/dashboard");
  await page.getByLabel("Payment status", { exact: true }).selectOption("CANCELLED");
  await expect(
    page.getByRole("heading", { name: "No payments with this status", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset payment filters", exact: true }),
  ).toBeVisible();
});
test("late responses cannot restore payments after account invalidation", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments");
  await expect(page.locator(".paylist-table")).toBeVisible();
  state.mode = "hold";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  state.held?.();
  await expect(page.locator(".paylist-table")).toHaveCount(0);
});
test("a background refresh failure clearly labels the retained list", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments");
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/The list may be out of date/)).toBeVisible();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry payments", exact: true }).click();
  await expect(page.getByText(/The list may be out of date/)).toHaveCount(0);
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
});

test("detail navigation uses the selected payment and triggers no mutation", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  await page.goto("/dashboard/payments");
  await page
    .getByRole("link", { name: "View payment: AA-PAY-2041", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/payments/${paymentId(1)}`));
  await expect(
    page.getByRole("heading", { name: "Payment status", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".customer-payment")).toContainText("AA-PAY-2041");
  await expect(page.locator(".customer-payment")).toContainText("Processing");
  expect(state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot fetch customer payments from a direct route`, async ({ page }) => {
    const state = await paymentsFixture(page, role);
    await page.goto("/dashboard/payments");
    await expect(page.locator(".customer-payments")).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).waitFor();
    expect(state.reads).toEqual([]);
  });

test("loading and empty cursor recovery remain usable", async ({ page }) => {
  const state = await paymentsFixture(page);
  state.mode = "hold";
  await page.goto(`/dashboard/payments?cursor=${paymentId(4)}`);
  await expect(page.getByRole("heading", { name: "Checking payments…" })).toBeVisible();
  await expect(page.locator(".paylist-list-skeleton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "empty";
  await expect.poll(() => !!state.held).toBe(true);
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No payments on this page" }),
  ).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
});

test("invalid cursor payload fails closed without a new navigation target", async ({
  page,
}) => {
  await paymentsFixture(page);
  await page.route("**/api/v1/customers/payments?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "QA",
        meta: { requestId: "qa-invalid-cursor" },
        data: { items: [], nextCursor: "not-a-real-cursor" },
      },
    }),
  );
  await page.goto("/dashboard/payments");
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your payments" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});

test("short mobile keyboard controls and filtered empty state are accessible", async ({
  page,
}) => {
  await paymentsFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/payments");
  const filter = page.getByLabel("Payment status", { exact: true });
  await filter.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveValue("EXPIRED");
  await expect(
    page.getByRole("heading", { name: "No payments with this status" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Reset payment filters", exact: true }).click();
  await expect(filter).toBeFocused();
  await expect(page.locator(".paylist-table tbody tr")).toHaveCount(4);
});

test("payment history preserves the captured amount but flags a reported reversal", async ({
  page,
}) => {
  const state = await paymentsFixture(page);
  state.records[3].reversalReported = true;
  await page.goto("/dashboard/payments");
  const row = page.locator(".paylist-table tbody tr").nth(3);
  await expect(row).toContainText("Reversal reported");
  await expect(row).toContainText("Originally confirmed amount");
  await expect(row).toContainText("Do not pay again");
  expect(state.writes).toEqual([]);
});
