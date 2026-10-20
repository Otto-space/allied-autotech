import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceOrdersFixture, orderFixtureId } from "../fixtures/workforce-orders";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
const root = "/admin/workforce/orders";
const rows = (page: Page) => page.locator(".wfc-results tbody tr");
const detail = (page: Page) =>
  page.getByRole("region", { name: "Selected order", exact: true });
const review = (page: Page) =>
  page.getByRole("button", { name: "Review preparation update", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh records", exact: true });
async function ready(page: Page) {
  const state = await workforceOrdersFixture(page);
  await page.goto(root + "?selected=" + orderFixtureId(1));
  await expect(rows(page)).toHaveCount(2);
  await expect(review(page)).toBeEnabled();
  return state;
}
async function axe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const width of [320, 375, 430, 768, 1024, 1280, 1440])
  test(`orders layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Order progress", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(detail(page)).toContainText("Front brake pads");
    await expect(detail(page)).toContainText("Recorded progress");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    expect(errors).toEqual([]);
    if ([430, 768, 1280, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({
        path: `C:/Users/PC/.codex/workforce-orders-final-${width}.png`,
        fullPage: true,
      });
    }
  });
test("combined filters, selection, reload, empty and clear", async ({ page }) => {
  await ready(page);
  await page.getByLabel("Search orders", { exact: true }).fill("Oil filter");
  await page.getByLabel("Order status", { exact: true }).selectOption("PROCESSING");
  await page.getByLabel("Fulfillment", { exact: true }).selectOption("COLLECTION");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByRole("button", { name: "View order: AA-2026-0149", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("selected=" + orderFixtureId(2)));
  await page.reload();
  await expect(
    detail(page).getByRole("heading", { name: "AA-2026-0149", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search orders", { exact: true }).fill("Unmatched");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByText("No orders match these filters", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
});
test("queue paging survives reload and Back", async ({ page }) => {
  const state = await workforceOrdersFixture(page);
  for (let n = 3; n <= 27; n++)
    state.items.push({
      ...state.items[0],
      id: orderFixtureId(n),
      orderNumber: `Order ${n}`,
    });
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await page.getByRole("button", { name: "Next orders", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(rows(page)).toHaveCount(2);
});
test("exact preparation then ready transitions record once each", async ({ page }) => {
  const state = await ready(page);
  for (const [status, note] of [
    ["PROCESSING", "Collected all listed items for preparation."],
    ["READY", "Checked all quantities and packed for collection."],
  ]) {
    await page.getByLabel("Preparation note", { exact: true }).fill(note);
    await review(page).click();
    await expect(page.getByRole("dialog")).toContainText(note);
    await expect(page.getByRole("dialog")).toContainText(
      status === "PROCESSING" ? "Processing" : "Ready",
    );
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(
      page.getByText("The preparation update was recorded.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => state.items[0].status).toBe(status);
  }
  expect(state.writes).toHaveLength(2);
  expect(state.writes.map((w) => w.body.expectedVersion)).toEqual([0, 1]);
  await expect(review(page)).toHaveCount(0);
});
test("fresh preflight stops a changed order before dispatch", async ({ page }) => {
  const state = await ready(page);
  await page
    .getByLabel("Preparation note", { exact: true })
    .fill("Preparation note being reviewed");
  await review(page).click();
  state.items[0].version++;
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("The order changed");
  expect(state.writes).toHaveLength(0);
});
test("refresh retains a draft and changed base requires explicit adoption", async ({
  page,
}) => {
  const state = await ready(page);
  await page
    .getByLabel("Preparation note", { exact: true })
    .fill("Retained preparation note");
  await refresh(page).click();
  await expect(page.getByLabel("Preparation note", { exact: true })).toHaveValue(
    "Retained preparation note",
  );
  state.items[0].version++;
  await refresh(page).click();
  await expect(page.getByText("The order has changed", { exact: true })).toBeVisible();
  await expect(review(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Use retained draft with latest order", exact: true })
    .click();
  await expect(review(page)).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
for (const kind of [
  "lostResponse",
  "malformedReceipt",
  "timeoutResponse",
  "throttledResponse",
] as const)
  test(`${kind} stays locked through reload without replay`, async ({ page }) => {
    const state = await ready(page);
    state[kind] = true;
    await page
      .getByLabel("Preparation note", { exact: true })
      .fill("Audited preparation for collection");
    await review(page).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    await expect(page.getByRole("dialog")).toContainText("could not");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Review an earlier order change", exact: true }),
    ).toBeVisible();
    await expect(review(page)).toBeDisabled();
    await page
      .getByRole("button", { name: "Inspect current order", exact: true })
      .click();
    await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
    await page
      .getByRole("button", { name: "Finish reconciliation", exact: true })
      .click();
    await expect(
      page.getByText(
        "Reconciliation recorded for this browser session. No change was resent.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    await axe(page);
  });
for (const template of ["CUSTOMER_SERVICE", "SALES_SUPERVISOR"] as const)
  test(`${template} can inspect but cannot prepare`, async ({ page }) => {
    const state = await workforceOrdersFixture(page, template);
    await page.goto(root + "?selected=" + orderFixtureId(1));
    await expect(detail(page)).toContainText(
      "Your current responsibilities allow you to view this order",
    );
    await expect(review(page)).toHaveCount(0);
    await expect(page.getByLabel("Preparation note", { exact: true })).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });
test("unpaid, delivery, ready and terminal orders have no preparation form", async ({
  page,
}) => {
  const state = await workforceOrdersFixture(page);
  const row = state.items[0];
  row.paidAt = null;
  await page.goto(root + "?selected=" + row.id);
  await expect(detail(page)).toContainText("until payment is recorded");
  await expect(review(page)).toHaveCount(0);
  row.paidAt = "2026-10-20T08:15:00.000Z";
  row.fulfillmentMethod = "DELIVERY";
  await refresh(page).click();
  await expect(detail(page)).toContainText("Delivery orders cannot be prepared");
  row.fulfillmentMethod = "COLLECTION";
  for (const status of ["PENDING", "READY", "COMPLETED", "CANCELLED"]) {
    row.status = status;
    await refresh(page).click();
    await expect(detail(page)).toContainText("No preparation update is available");
    await expect(review(page)).toHaveCount(0);
  }
});
test("failed refresh, mismatched scope and detail denial hide unverified facts", async ({
  page,
}) => {
  const state = await ready(page);
  state.listFailure = true;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Orders could not be refreshed", exact: true }),
  ).toBeVisible();
  await expect(review(page)).toHaveCount(0);
  state.listFailure = false;
  state.listMismatch = true;
  await refresh(page).click();
  await expect(
    page.getByRole("heading", { name: "Your responsibilities changed", exact: true }),
  ).toBeVisible();
  state.listMismatch = false;
  state.detailDenied = true;
  await refresh(page).click();
  await expect(
    page.getByRole("heading", { name: "Order access unavailable", exact: true }),
  ).toBeVisible();
  await expect(review(page)).toHaveCount(0);
});
test("invalid URL filters make no order requests", async ({ page }) => {
  const state = await workforceOrdersFixture(page);
  for (const q of [
    "status=UNKNOWN",
    "q=a&q=b",
    "cursor=bad",
    "selected=bad",
    "foreign=true",
    "fulfillmentMethod=OTHER",
  ]) {
    await page.goto(root + "?" + q);
    await expect(
      page.getByRole("heading", { name: "Order filters unavailable", exact: true }),
    ).toBeVisible();
  }
  expect(state.reads).toEqual([]);
});
test("accountant cannot discover order records", async ({ page }) => {
  const state = await workforceNotificationsFixture(page, "ACCOUNTANT");
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  expect(state.requests.some((r) => r.startsWith("/staff/workforce/orders"))).toBe(false);
});
test("loading and empty states are visible", async ({ page }) => {
  const state = await workforceOrdersFixture(page);
  state.items.splice(0);
  state.hold = true;
  await page.goto(root);
  await expect(
    page.getByText("Checking permitted orders…", { exact: true }),
  ).toBeVisible();
  state.hold = false;
  state.release?.();
  await expect(
    page.getByText("No orders in your current scope", { exact: true }),
  ).toBeVisible();
});
test("long content and keyboard preparation review fit 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const state = await workforceOrdersFixture(page);
  state.items[0].orderNumber = "O".repeat(100);
  state.items[0].items[0].productName = "P".repeat(250);
  await page.goto(root + "?selected=" + orderFixtureId(1));
  await expect(review(page)).toBeEnabled();
  await page.getByLabel("Preparation note", { exact: true }).fill("N".repeat(1000));
  await review(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await axe(page);
  expect(state.writes).toHaveLength(0);
});
