import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { invoicesFixture, invoiceId, invoiceRecord } from "../fixtures/customer-invoices";

test("deposit credit is descriptive and server status alone controls paid labels", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  state.records[0].paidAt = "2026-10-08T12:00:00Z";
  state.records[0].payments = [
    {
      id: invoiceId(501),
      paymentNumber: "QA-PAY-1",
      status: "SUCCEEDED",
      amountKobo: "7363750",
      succeededAt: "2026-10-08T12:00:00Z",
    },
  ];
  await page.goto("/dashboard/invoices");
  const row = page.locator(".invlist-table tbody tr").first();
  await expect(row).toContainText("73,637.50");
  await expect(row).toContainText("17,737.50 credit");
  await expect(row).not.toContainText("55,900.00");
  await expect(row.locator(".invlist-state")).toHaveText("Issued");
  await expect(row).not.toContainText("Payment recorded");
  await expect(row).not.toContainText("QA-PAY-1");
  expect(state.writes).toEqual([]);
});

test("draft records fail closed and draft query values never reach the API", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices?status=DRAFT");
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  expect(state.reads[0].searchParams.has("status")).toBe(false);
  state.records[0].status = "DRAFT";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("heading", { name: /load your invoices/ })).toBeVisible();
  await expect(page.locator(".invlist-table")).toHaveCount(0);
});

test("all three customer invoice statuses use server filtering", async ({ page }) => {
  const state = await invoicesFixture(page);
  const statuses = ["ISSUED", "PAID", "VOID"] as const;
  state.records = statuses.map((status, i) => invoiceRecord(i + 1, status));
  await page.goto("/dashboard/invoices");
  for (const [i, status] of statuses.entries()) {
    await page.getByLabel("Invoice status", { exact: true }).selectOption(status);
    await expect(page.locator(".invlist-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".invlist-state")).toHaveText(
      ["Issued", "Paid", "Void"][i],
    );
    await expect.poll(() => state.reads.at(-1)?.searchParams.get("status")).toBe(status);
  }
  expect(state.writes).toEqual([]);
});

test("real source references and links require no related-record or document reads", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  const extraReads: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/v1\/customers\/(orders|bookings|vehicle-transactions)\//.test(r.url()) ||
      /\/document$/.test(r.url())
    )
      extraReads.push(r.url());
  });
  await page.goto("/dashboard/invoices");
  await expect(page.locator(".invlist-table")).toContainText("Order AA-ORD-1063");
  await expect(page.locator(".invlist-table")).toContainText("Service booking");
  await expect(page.locator(".invlist-table")).toContainText(
    "Vehicle purchase AA-VEH-1064",
  );
  for (const [label, ref, path, id] of [
    ["View booking", 2041, "bookings", 202],
    ["View order", 2042, "orders", 203],
    ["View vehicle purchase", 2043, "vehicle-transactions", 204],
  ] as const)
    await expect(
      page.getByRole("link", { name: `${label} for AA-INV-${ref}`, exact: true }),
    ).toHaveAttribute("href", `/dashboard/${path}/${invoiceId(id)}`);
  expect(extraReads).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("long references, missing issuance/source and exact large totals fit narrow screens", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  state.records = [
    {
      ...invoiceRecord(),
      invoiceNumber: "ExtendedInvoiceReference".repeat(12),
      totalKobo: "9007199254740993",
      issuedAt: null,
      dueAt: null,
      order: null,
      booking: null,
      vehicleTransaction: null,
    },
  ];
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard/invoices");
  const table = page.locator(".invlist-table");
  await expect(table).toContainText("90,071,992,547,409.93");
  await expect(table).toContainText("Created 8 Oct 2026");
  await expect(table).toContainText("No due date");
  await expect(table).toContainText("See invoice details");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("invalid due dates fail closed instead of inventing a deadline", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  state.records[0].dueAt = "invalid-date";
  await page.goto("/dashboard/invoices");
  await expect(page.getByRole("heading", { name: /load your invoices/ })).toBeVisible();
  await expect(page.locator(".invlist-table")).toHaveCount(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`invoices fit ${width}px with readable records and controls`, async ({ page }) => {
    await invoicesFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/invoices");
    await expect(
      page.getByRole("heading", { name: "AA-INV-2041", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator(".customer-invoices a,.customer-invoices button,.customer-invoices select")
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
    await expect(page.locator('.invlist-breadcrumb ol [aria-current="page"]')).toHaveText(
      "Invoices",
    );
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }).last(),
    ).toHaveAttribute("href", "/dashboard");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`invoices accessibility ${width}px`, async ({ page }) => {
    await invoicesFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/invoices");
    await expect(page.locator(".invlist-table")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("status and page size persist across reload, Back and Forward", async ({ page }) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices");
  await page.getByLabel("Invoice status", { exact: true }).selectOption("PAID");
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(1);
  await expect(page).toHaveURL(/status=PAID/);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.reload();
  await expect(page.getByLabel("Invoice status", { exact: true })).toHaveValue("PAID");
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.goBack();
  await expect(page.getByLabel("Rows per page")).toHaveValue("20");
  await page.goForward();
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Invoice status", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("cursor pages survive reload and return to the correct prior page", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices");
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".invlist-pagination")).toContainText("Page 2");
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#invlist-results")).toBeFocused();
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.locator(".invlist-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
});
test("a direct cursor link uses first-page recovery without inventing a page number", async ({
  page,
}) => {
  await invoicesFixture(page);
  await page.goto(`/dashboard/invoices?cursor=${invoiceId(4)}`);
  await expect(page.locator(".invlist-pagination")).toContainText("Later page");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
});
test("changing status resets cursor and ignores untrusted query fields", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto(
    `/dashboard/invoices?cursor=${invoiceId(4)}&_trail=start&customerId=${invoiceId(999)}`,
  );
  await expect(page.locator(".invlist-table")).toBeVisible();
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page.getByLabel("Invoice status", { exact: true }).selectOption("ISSUED");
  await expect(page.locator(".invlist-table")).toContainText("AA-INV-2041");
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
});
test("invalid filters fail safely with a visible explanation", async ({ page }) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices?status=ADMIN&limit=99999&cursor=bad");
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  expect(state.reads[0].searchParams.get("limit")).toBe("20");
  expect(state.reads[0].searchParams.has("status")).toBe(false);
});
for (const mode of ["error", "malformed"])
  test(`${mode} hides stale records and offers retry`, async ({ page }) => {
    const state = await invoicesFixture(page);
    await page.goto("/dashboard/invoices");
    await expect(page.locator(".invlist-table")).toBeVisible();
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your invoices" }),
    ).toBeVisible();
    await expect(page.locator(".invlist-table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry invoices", exact: true }).click();
    await expect(page.locator(".invlist-table")).toBeVisible();
  });
test("empty and filtered-empty accounts have different recovery actions", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  state.mode = "empty";
  await page.goto("/dashboard/invoices");
  await expect(
    page.getByRole("heading", { name: "No invoices have been issued", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to overview", exact: true }).last(),
  ).toHaveAttribute("href", "/dashboard");
  await page.getByLabel("Invoice status", { exact: true }).selectOption("VOID");
  await expect(
    page.getByRole("heading", { name: "No invoices with this status", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset invoice filters", exact: true }),
  ).toBeVisible();
});
test("late responses cannot restore invoices after account invalidation", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices");
  await expect(page.locator(".invlist-table")).toBeVisible();
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
  await expect(page.locator(".invlist-table")).toHaveCount(0);
});
test("a background refresh failure clearly labels the retained list", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices");
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/The list may be out of date/)).toBeVisible();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry invoices", exact: true }).click();
  await expect(page.getByText(/The list may be out of date/)).toHaveCount(0);
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
});

test("detail navigation uses the selected invoice and triggers no mutation", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  await page.goto("/dashboard/invoices");
  await page
    .getByRole("link", { name: "View invoice: AA-INV-2041", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/invoices/${invoiceId(1)}`));
  await expect(
    page.getByRole("heading", { name: "Invoice details", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".invoice-detail")).toContainText("AA-INV-2041");
  await expect(page.locator(".invoice-detail")).toContainText("Issued");
  expect(state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot fetch customer invoices from a direct route`, async ({ page }) => {
    const state = await invoicesFixture(page, role);
    await page.goto("/dashboard/invoices");
    await expect(page.locator(".customer-invoices")).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).waitFor();
    expect(state.reads).toEqual([]);
  });

test("loading and empty cursor recovery remain usable", async ({ page }) => {
  const state = await invoicesFixture(page);
  state.mode = "hold";
  await page.goto(`/dashboard/invoices?cursor=${invoiceId(4)}`);
  await expect(page.getByRole("heading", { name: "Checking invoices…" })).toBeVisible();
  await expect(page.locator(".invlist-list-skeleton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "empty";
  await expect.poll(() => !!state.held).toBe(true);
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No invoices on this page" }),
  ).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
});

test("invalid cursor payload fails closed without a new navigation target", async ({
  page,
}) => {
  await invoicesFixture(page);
  await page.route("**/api/v1/customers/invoices?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "QA",
        meta: { requestId: "qa-invalid-cursor" },
        data: { items: [], nextCursor: "not-a-real-cursor" },
      },
    }),
  );
  await page.goto("/dashboard/invoices");
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your invoices" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});

test("short mobile keyboard controls and filtered empty state are accessible", async ({
  page,
}) => {
  const state = await invoicesFixture(page);
  state.records[2].status = "ISSUED";
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/invoices");
  const filter = page.getByLabel("Invoice status", { exact: true });
  await filter.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveValue("VOID");
  await expect(
    page.getByRole("heading", { name: "No invoices with this status" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Reset invoice filters", exact: true }).click();
  await expect(filter).toBeFocused();
  await expect(page.locator(".invlist-table tbody tr")).toHaveCount(4);
});
