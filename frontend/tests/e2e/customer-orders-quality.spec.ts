import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ordersFixture, orderId } from "../fixtures/customer-orders";

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`orders fit ${width}px with readable records and controls`, async ({ page }) => {
    await ordersFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/orders");
    await expect(
      page.getByRole("heading", { name: "AA-ORD-2041", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator(".customer-orders a,.customer-orders button,.customer-orders select")
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
    await expect(page.locator('.order-breadcrumb ol [aria-current="page"]')).toHaveText(
      "Orders",
    );
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }).last(),
    ).toHaveAttribute("href", "/dashboard");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`orders accessibility ${width}px`, async ({ page }) => {
    await ordersFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/orders");
    await expect(page.locator(".order-table")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("status and page size persist across reload, Back and Forward", async ({ page }) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders");
  await page.getByLabel("Order status", { exact: true }).selectOption("CONFIRMED");
  await expect(page.locator(".order-table tbody tr")).toHaveCount(1);
  await expect(page).toHaveURL(/status=CONFIRMED/);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.reload();
  await expect(page.getByLabel("Order status", { exact: true })).toHaveValue("CONFIRMED");
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.goBack();
  await expect(page.getByLabel("Rows per page")).toHaveValue("20");
  await page.goForward();
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Order status", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("cursor pages survive reload and return to the correct prior page", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders");
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".order-pagination")).toContainText("Page 2");
  await expect(page.locator(".order-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#order-results")).toBeFocused();
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.locator(".order-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
});
test("a direct cursor link uses first-page recovery without inventing a page number", async ({
  page,
}) => {
  await ordersFixture(page);
  await page.goto(`/dashboard/orders?cursor=${orderId(4)}`);
  await expect(page.locator(".order-pagination")).toContainText("Later page");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
});
test("changing status resets cursor and ignores untrusted query fields", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  await page.goto(
    `/dashboard/orders?cursor=${orderId(4)}&_trail=start&customerId=${orderId(999)}`,
  );
  await expect(page.locator(".order-table")).toBeVisible();
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page.getByLabel("Order status", { exact: true }).selectOption("PENDING");
  await expect(page.locator(".order-table")).toContainText("Spark plugs");
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
});
test("invalid filters fail safely with a visible explanation", async ({ page }) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders?status=ADMIN&limit=99999&cursor=bad");
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  expect(state.reads[0].searchParams.get("limit")).toBe("20");
  expect(state.reads[0].searchParams.has("status")).toBe(false);
});
for (const mode of ["error", "malformed"])
  test(`${mode} hides stale records and offers retry`, async ({ page }) => {
    const state = await ordersFixture(page);
    await page.goto("/dashboard/orders");
    await expect(page.locator(".order-table")).toBeVisible();
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your orders" }),
    ).toBeVisible();
    await expect(page.locator(".order-table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry orders", exact: true }).click();
    await expect(page.locator(".order-table")).toBeVisible();
  });
test("empty and filtered-empty accounts have different recovery actions", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  state.mode = "empty";
  await page.goto("/dashboard/orders");
  await expect(
    page.getByRole("heading", { name: "No orders yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse parts", exact: true }).last(),
  ).toHaveAttribute("href", "/parts");
  await page.getByLabel("Order status", { exact: true }).selectOption("CANCELLED");
  await expect(
    page.getByRole("heading", { name: "No orders with this status", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset order filters", exact: true }),
  ).toBeVisible();
});
test("late responses cannot restore orders after account invalidation", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders");
  await expect(page.locator(".order-table")).toBeVisible();
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
  await expect(page.locator(".order-table")).toHaveCount(0);
});
test("long item names, missing delivery details and exact large totals fit a short screen", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  state.records[0].items[0].productName = "ExtendedProductName".repeat(15);
  state.records[0].orderNumber = "LongOrderNumber".repeat(12);
  state.records[0].totalKobo = "9007199254740993";
  state.records[0].paidAt = null;
  state.records[1].deliveryCity = null;
  state.records[1].deliveryState = null;
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard/orders");
  await expect(page.locator(".order-table")).toContainText("90,071,992,547,409.93");
  await expect(page.locator(".order-table")).toContainText(
    "See order for delivery details",
  );
  await expect(page.locator(".order-table")).not.toContainText("Payment recorded");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("a background refresh failure clearly labels the retained list", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders");
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/The list may be out of date/)).toBeVisible();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry orders", exact: true }).click();
  await expect(page.getByText(/The list may be out of date/)).toHaveCount(0);
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
});

test("detail navigation uses the selected order and triggers no mutation", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  await page.goto("/dashboard/orders");
  await page.getByRole("link", { name: "View order: AA-ORD-2041", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${orderId(1)}`));
  await expect(
    page.getByRole("heading", { name: "Order details", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot fetch customer orders from a direct route`, async ({ page }) => {
    const state = await ordersFixture(page, role);
    await page.goto("/dashboard/orders");
    await expect(page.locator(".customer-orders")).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).waitFor();
    expect(state.reads).toEqual([]);
  });

test("collection, delivery, item summaries and all server statuses remain distinct", async ({
  page,
}) => {
  const state = await ordersFixture(page);
  state.records[0].items.push({
    ...state.records[0].items[0],
    id: orderId(900),
    productName: "Hidden third item",
  });
  state.records[1].deliveryAddress = "PRIVATE STREET NOT NEEDED ON LIST";
  state.records[2].branch = null;
  state.records[3].items = [];
  await page.goto("/dashboard/orders");
  await expect(page.locator(".order-table")).toContainText("+1 more item");
  await expect(page.locator(".order-table")).not.toContainText("Hidden third item");
  await expect(page.locator(".order-table")).not.toContainText("PRIVATE STREET");
  await expect(page.locator(".order-table")).toContainText("Port Harcourt, Rivers");
  await expect(page.locator(".order-table")).toContainText(
    "Collection branch not assigned",
  );
  await expect(page.locator(".order-table")).toContainText("See order for item details");
  for (const status of [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]) {
    await page.getByLabel("Order status", { exact: true }).selectOption(status);
    await expect.poll(() => state.reads.at(-1)?.searchParams.get("status")).toBe(status);
  }
  expect(state.writes).toEqual([]);
});

test("loading and empty cursor recovery remain usable", async ({ page }) => {
  const state = await ordersFixture(page);
  state.mode = "hold";
  await page.goto(`/dashboard/orders?cursor=${orderId(4)}`);
  await expect(page.getByRole("heading", { name: "Checking orders…" })).toBeVisible();
  await expect(page.locator(".order-list-skeleton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "empty";
  await expect.poll(() => !!state.held).toBe(true);
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No orders on this page" }),
  ).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
});

test("invalid cursor payload fails closed without a new navigation target", async ({
  page,
}) => {
  await ordersFixture(page);
  await page.route("**/api/v1/customers/orders?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "QA",
        meta: { requestId: "qa-invalid-cursor" },
        data: { items: [], nextCursor: "not-a-real-cursor" },
      },
    }),
  );
  await page.goto("/dashboard/orders");
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your orders" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});

test("short mobile keyboard controls and filtered empty state are accessible", async ({
  page,
}) => {
  await ordersFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/orders");
  const filter = page.getByLabel("Order status", { exact: true });
  await filter.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveValue("CANCELLED");
  await expect(
    page.getByRole("heading", { name: "No orders with this status" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Reset order filters", exact: true }).click();
  await expect(filter).toBeFocused();
  await expect(page.locator(".order-table tbody tr")).toHaveCount(4);
});
