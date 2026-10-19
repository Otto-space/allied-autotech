import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInventoryDetailFixture, bookingId } from "../fixtures/work-inventory-detail";
import { workInventoryFixture } from "../fixtures/work-inventory";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function open(page: Page) {
  await page.goto(`/admin/inventory/${bookingId(4000)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Brake pads", exact: true }),
  ).toBeVisible();
  await expect(button(page, "Review stock movement")).toBeEnabled();
}
async function review(page: Page, operation: string) {
  if (operation === "movement") {
    await page.getByLabel("Units moved").fill("3");
    await button(page, "Review stock movement").click();
  }
  if (operation === "reservation") {
    await page.getByLabel("Units to reserve").fill("3");
    await page
      .getByLabel("Reservation expiry (Lagos time)")
      .fill(new Date(Date.now() + 86400000 + 3600000).toISOString().slice(0, 16));
    await button(page, "Review stock reservation").click();
  }
  if (operation === "release") await button(page, "Review release").click();
  if (operation === "reorder") {
    await page.getByLabel("Low-stock threshold").fill("8");
    await button(page, "Review reorder level").click();
  }
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} has named stock facts and reviewed actions`, async ({ page }) => {
    await workInventoryDetailFixture(page, role);
    await open(page);
    await expect(page).toHaveTitle(/Inventory record/);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
      "Product inventory",
    );
    await expect(
      page.getByRole("heading", { name: "Stock movement history", exact: true }),
    ).toBeVisible();
  });
for (const mode of ["error", "denied", "malformed", "mismatch"])
  test(`${mode} hides invalid detail and can retry`, async ({ page }) => {
    const { state } = await workInventoryDetailFixture(page);
    state.mode = mode;
    await page.goto(`/admin/inventory/${bookingId(4000)}`);
    await expect(button(page, "Retry inventory record")).toBeVisible();
    await expect(button(page, "Review stock movement")).toHaveCount(0);
    state.mode = "normal";
    await button(page, "Retry inventory record").click();
    await expect(button(page, "Review stock movement")).toBeEnabled();
  });
test("customer does not fetch private inventory detail", async ({ page }) => {
  const { state } = await workInventoryDetailFixture(page, "CUSTOMER");
  await page.goto(`/admin/inventory/${bookingId(4000)}`);
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(state.reads).toHaveLength(0);
});
test("cancel preserves movement draft and restores focus without writes", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  await open(page);
  await review(page, "movement");
  await button(page, "Go back").click();
  await expect(button(page, "Review stock movement")).toBeFocused();
  await expect(page.getByLabel("Units moved")).toHaveValue("3");
  expect(state.writes).toHaveLength(0);
});
test("changed stock during review blocks POST and rechecks current facts", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  await open(page);
  await review(page, "movement");
  state.record = { ...state.record, version: 1, quantity: 11, available: 9 };
  await button(page, "Confirm change").click();
  await expect(page.getByText(/inventory changed during review/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("revoked access before confirmation blocks POST and removes private data", async ({
  page,
}) => {
  const { base, state } = await workInventoryDetailFixture(page);
  await open(page);
  await review(page, "movement");
  base.state.profileMode = "mismatch";
  await button(page, "Confirm change").click();
  await expect(button(page, "Go back")).toBeVisible();
  await button(page, "Go back").click();
  await expect(button(page, "Review stock movement")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
for (const operation of ["movement", "reservation", "release", "reorder"])
  test(`${operation} unknown outcome stays locked after reload and reconciles without replay`, async ({
    page,
  }) => {
    const { state } = await workInventoryDetailFixture(page);
    state.outcome = "uncertain";
    await open(page);
    await review(page, operation);
    await button(page, "Confirm change").click();
    await button(page, "Close & review record").click();
    expect(state.writes).toHaveLength(1);
    await page.reload();
    await expect(button(page, "Check saved balances and history")).toBeVisible();
    await expect(button(page, "Review stock movement")).toBeDisabled();
    await expect(button(page, "Resolve pending stock change")).toHaveCount(0);
    state.historyMode = "error";
    await button(page, "Check saved balances and history").click();
    await expect(button(page, "Check saved balances and history")).toBeEnabled();
    await expect(button(page, "Review stock movement")).toBeDisabled();
    state.historyMode = "normal";
    await button(page, "Check saved balances and history").click();
    await expect(page.getByText(/Nothing was resent/)).toBeVisible();
    await expect(button(page, "Review stock movement")).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });
test("contradictory successful response locks mutation rather than announcing success", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  state.outcome = "contradictory";
  await open(page);
  await review(page, "movement");
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await expect(button(page, "Resolve pending stock change")).toBeVisible();
  await expect(button(page, "Review stock movement")).toBeDisabled();
});
test("storage failure prevents stock mutation", async ({ page }) => {
  const { state } = await workInventoryDetailFixture(page);
  await open(page);
  await review(page, "movement");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("Unavailable");
    };
  });
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  expect(state.writes).toHaveLength(0);
});
test("revocation during an original-request retry preserves the reload lock", async ({
  page,
}) => {
  const { state, base } = await workInventoryDetailFixture(page);
  state.outcome = "uncertain";
  await open(page);
  await review(page, "movement");
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await expect(button(page, "Resolve pending stock change")).toBeEnabled();
  base.state.profileMode = "mismatch";
  await button(page, "Resolve pending stock change").click();
  await button(page, "Confirm change").click();
  await button(page, "Go back").click();
  base.state.profileMode = "normal";
  await page.reload();
  await expect(button(page, "Check saved balances and history")).toBeVisible();
  await expect(button(page, "Review stock movement")).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("throttled stock responses preserve a pending lock until explicit saved-record review", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  state.outcome = "throttled";
  await open(page);
  await review(page, "movement");
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await page.reload();
  await expect(button(page, "Review stock movement")).toBeDisabled();
  await button(page, "Check saved balances and history").click();
  await expect(page.getByText(/Nothing was resent/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("throttled creation preserves the shared inventory reload lock", async ({
  page,
}) => {
  const { state } = await workInventoryFixture(page);
  state.outcome = "throttled";
  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  await button(page, "Add inventory record").click();
  await page.getByLabel("Inventory branch", { exact: true }).selectOption(bookingId(101));
  await page.getByLabel("Inventory part", { exact: true }).selectOption(bookingId(4110));
  await button(page, "Review inventory record").click();
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await page.reload();
  await expect(button(page, "Review inventory record")).toBeDisabled();
  await button(page, "Check saved branch inventory").click();
  await expect(page.getByText(/Nothing was resent/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("expired active reservations allow release without offering a sale", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  state.reservations[0].expiresAt = new Date(Date.now() - 3600000).toISOString();
  await open(page);
  await expect(button(page, "Review release")).toBeVisible();
  await expect(button(page, "Record reserved sale")).toHaveCount(0);
});
test("inactive historical part keeps stock facts and hides new reservation", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  state.record.product.isActive = false;
  await open(page);
  await expect(button(page, "Review stock reservation")).toHaveCount(0);
  await expect(button(page, "Review stock movement")).toBeEnabled();
});
test("complete mobile facts and forms remain accessible with long references", async ({
  page,
}) => {
  const { state } = await workInventoryDetailFixture(page);
  state.history[0].note = "Long synthetic condition note ".repeat(40);
  state.reservations[0].referenceId = "REFERENCE".repeat(12);
  await open(page);
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Movement type", { exact: true })).toBeVisible();
});
