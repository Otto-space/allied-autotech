import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerAftercareFixture } from "../fixtures/customer-aftercare";

const id = (n: number) => `ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const url = `/dashboard/orders/${id(1)}/aftercare`;
const marker = `aat:aftercare-create:v1:${id(7)}:${id(1)}`;
const explanation =
  "One brake pad arrived damaged. Please review a return for this item.";
const review = (page: Page) =>
  page.getByRole("button", { name: "Review order request", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh order requests", exact: true });
const acknowledge = (page: Page) =>
  page.getByRole("button", { name: "I have checked the saved requests", exact: true });
async function open(page: Page) {
  await page.goto(url);
  await expect(review(page)).toBeEnabled();
}
async function prepare(page: Page, scope = "ALL") {
  await page.getByLabel("Request type", { exact: true }).selectOption("RETURN");
  await page.getByLabel("Products to review").selectOption(scope);
  if (scope === "SELECTED") {
    await page
      .getByRole("checkbox", { name: "Synthetic product 3", exact: true })
      .check();
    await page.getByLabel("Quantity for Synthetic product 3", { exact: true }).fill("1");
  }
  await page.getByLabel("Reason for your request").fill(explanation);
}
async function confirm(page: Page) {
  await review(page).click();
  await page.getByRole("button", { name: "Send order request", exact: true }).click();
}

test("owned breadcrumb, empty history, review cancellation and focus", async ({
  page,
}) => {
  const state = await customerAftercareFixture(page);
  await open(page);
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await expect(breadcrumb).toHaveCount(1);
  await expect(
    breadcrumb.getByRole("link", { name: state.order.orderNumber }),
  ).toHaveAttribute("href", `/dashboard/orders/${state.order.id}`);
  await expect(
    page.getByText("No return or cancellation requests are recorded for this order."),
  ).toBeVisible();
  await prepare(page, "SELECTED");
  await review(page).click();
  await expect(page.getByRole("dialog")).toContainText("has not been rejected");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review(page)).toBeFocused();
  await expect(page.getByLabel("Reason for your request")).toHaveValue(explanation);
  expect(state.writes).toHaveLength(0);
});

for (const scope of ["ALL", "SELECTED"])
  test(`draft restores request context and quantities after reload: ${scope}`, async ({
    page,
  }) => {
    const state = await customerAftercareFixture(page);
    await open(page);
    await prepare(page, scope);
    await page.reload();
    await expect(page.getByLabel("Request type", { exact: true })).toHaveValue("RETURN");
    await expect(page.getByLabel("Products to review")).toHaveValue(scope);
    await expect(page.getByLabel("Reason for your request")).toHaveValue(explanation);
    if (scope === "SELECTED") {
      await expect(
        page.getByRole("checkbox", { name: "Synthetic product 3", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByLabel("Quantity for Synthetic product 3", { exact: true }),
      ).toHaveValue("1");
    }
    expect(state.writes).toHaveLength(0);
  });

test("validated success clears the draft and uses whole return endpoint", async ({
  page,
}) => {
  const state = await customerAftercareFixture(page);
  await open(page);
  await prepare(page);
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([
    { endpoint: `/customers/orders/${id(1)}/returns`, body: { reason: explanation } },
  ]);
  await page.reload();
  await expect(review(page)).toBeEnabled();
  await expect(page.getByLabel("Request type", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Reason for your request")).toHaveValue("");
});

test("approved duplicate retains original explanation and zero reviewed fee", async ({
  page,
}) => {
  const state = await customerAftercareFixture(page, { history: true });
  state.history[0].status = "APPROVED";
  state.history[0].approvedFeeKobo = "0";
  state.history[0].reviewNote =
    "Staff reviewed this request; check payment records separately.";
  state.history[0].inspectionNote = "PRIVATE-INSPECTION-NOTE";
  await open(page);
  await prepare(page);
  await confirm(page);
  await expect(page.getByText(/An existing request was returned/)).toBeVisible();
  await expect(page.locator(".ca-record")).toContainText(state.history[0].reason);
  await expect(page.locator(".ca-record")).toContainText("₦0.00");
  await expect(page.locator(".ca-record")).toContainText("This is not a refund amount.");
  await expect(page.locator("body")).not.toContainText("PRIVATE-INSPECTION-NOTE");
});

for (const field of ["order", "history"] as const)
  test(`failed ${field} read blocks intake and recovers`, async ({ page }) => {
    const state = await customerAftercareFixture(page);
    if (field === "order") state.failOrder = true;
    else state.failHistory = true;
    await page.goto(url);
    await expect(refresh(page)).toBeEnabled();
    if (field === "order") await expect(review(page)).toHaveCount(0);
    else await expect(review(page)).toBeDisabled();
    state.failOrder = state.failHistory = false;
    await refresh(page).click();
    await expect(review(page)).toBeEnabled();
    expect(state.writes).toHaveLength(0);
  });

test("fresh order conflict rejects an already-reviewed submission without POST", async ({
  page,
}) => {
  const state = await customerAftercareFixture(page);
  await open(page);
  await prepare(page);
  await review(page).click();
  state.order.version++;
  await page.getByRole("button", { name: "Send order request", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send order request", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

for (const changed of ["account", "role"] as const)
  test(`fresh ${changed} change prevents submission`, async ({ page }) => {
    const state = await customerAftercareFixture(page);
    await open(page);
    await prepare(page);
    await review(page).click();
    if (changed === "account") state.sessionUserId = id(99);
    else state.sessionRole = "STAFF";
    await page.getByRole("button", { name: "Send order request", exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(0);
    await expect(
      page.getByRole("button", { name: "Send order request", exact: true }),
    ).toBeDisabled();
  });

for (const outcome of ["unknown", "committed-unknown", "mismatch"] as const)
  test(`${outcome} survives reload and requires explicit successful manual reconciliation`, async ({
    page,
  }) => {
    const state = await customerAftercareFixture(page, { outcome });
    await open(page);
    await prepare(page, "SELECTED");
    await confirm(page);
    await expect(
      page.getByRole("button", { name: "Close & review record", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await expect(review(page)).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check before sending again" }),
    ).toBeVisible();
    await expect(page.getByLabel("Reason for your request")).toHaveValue(explanation);
    await expect(acknowledge(page)).toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(refresh(page)).toBeEnabled();
    await expect(acknowledge(page)).toBeDisabled();
    await refresh(page).click();
    await expect(acknowledge(page)).toBeEnabled();
    await acknowledge(page).click();
    await expect(review(page)).toBeEnabled();
    expect(state.writes).toHaveLength(1);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
  });

test("failed manual history refresh cannot be satisfied by later background success", async ({
  page,
}) => {
  const state = await customerAftercareFixture(page);
  await page.addInitScript((key) => sessionStorage.setItem(key, "pending"), marker);
  await page.goto(url);
  await expect(refresh(page)).toBeEnabled();
  state.failHistory = true;
  await refresh(page).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(refresh(page)).toBeEnabled();
  state.failHistory = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(review(page)).toBeDisabled();
  await expect(refresh(page)).toBeEnabled();
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
});

test("unavailable recovery storage fails before any POST", async ({ page }) => {
  const state = await customerAftercareFixture(page);
  await open(page);
  await prepare(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:aftercare-create:")) throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Send order request", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByText(/could not save the recovery marker/)).toBeVisible();
});

test("invalid record products fail closed", async ({ page }) => {
  const state = await customerAftercareFixture(page, { history: true });
  state.history[0].items[0].orderItemId = id(99);
  await page.goto(url);
  await expect(page.getByText(/request history did not match this order/)).toBeVisible();
  await expect(review(page)).toBeDisabled();
});

for (const width of [360, 390, 430, 768, 1024, 1280, 1440, 1505, 1920])
  test(`responsive selected-product form and history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1045 });
    await customerAftercareFixture(page, { history: true });
    await open(page);
    await prepare(page, "SELECTED");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(review(page)).toBeVisible();
    if ([390, 768, 1505].includes(width)) {
      const scan = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
    }
    await review(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press("Escape");
    await expect(review(page)).toBeFocused();
  });
