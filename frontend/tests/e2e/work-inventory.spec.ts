import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInventoryFixture, bookingId } from "../fixtures/work-inventory";
const table = (page: Page) =>
  page.getByRole("table", { name: "Parts inventory", exact: true });
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function open(page: Page) {
  await page.goto("/admin/inventory");
  await expect(table(page)).toBeVisible();
}
async function creation(page: Page) {
  await button(page, "Add inventory record").click();
  await expect(page.getByLabel("Inventory branch", { exact: true })).toBeFocused();
  await page.getByLabel("Inventory branch", { exact: true }).selectOption(bookingId(101));
  await page.getByLabel("Inventory part", { exact: true }).selectOption(bookingId(4110));
  await page.getByLabel("Initial reorder level").fill("7");
  await button(page, "Review inventory record").click();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} sees complete stock with only permitted controls`, async ({ page }) => {
    const { state } = await workInventoryFixture(page, role);
    await open(page);
    await expect(page.getByText("Previous workshop (inactive branch)")).toBeVisible();
    await expect(button(page, "Add inventory record")).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    await expect(page.getByLabel("Branch", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    expect(state.writes).toHaveLength(0);
  });
test("customer cannot invoke operational inventory reads", async ({ page }) => {
  const { state } = await workInventoryFixture(page, "CUSTOMER");
  await page.goto("/admin/inventory");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(state.reads).toHaveLength(0);
});
test("search, low stock, historical branches and cursor navigation survive reload", async ({
  page,
}) => {
  await workInventoryFixture(page);
  await open(page);
  await page.getByLabel("Search part name or SKU").fill("Oil");
  await page.getByLabel("Show only low-stock records").check();
  await button(page, "Apply filters").click();
  await expect(page).toHaveURL(/search=Oil.*lowStock=true/);
  await expect(page.locator(".wi-table tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Search part name or SKU")).toHaveValue("Oil");
  await button(page, "Clear filters").first().click();
  await expect(page.locator(".wi-table tbody tr")).toHaveCount(3);
  await button(page, "Next").click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".wi-table tbody tr")).toHaveCount(2);
  await button(page, "Previous").click();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.getByLabel("Branch", { exact: true }).selectOption(bookingId(102));
  await button(page, "Apply filters").click();
  await expect(page.locator(".wi-table tbody tr")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".wi-table tbody tr")).toHaveCount(3);
});
for (const query of ["search=a&search=b", "branchId=broken", "lowStock=invalid"])
  test(`invalid filter ${query} blocks API reads`, async ({ page }) => {
    const { state } = await workInventoryFixture(page);
    await page.goto(`/admin/inventory?${query}`);
    await expect(
      page.getByRole("heading", { name: "Inventory filters unavailable" }),
    ).toBeVisible();
    expect(state.reads).toHaveLength(0);
    await button(page, "Clear filters").click();
    await expect(table(page)).toBeVisible();
  });
for (const mode of ["empty", "error", "denied", "malformed", "mismatch"])
  test(`${mode} has an honest list state`, async ({ page }) => {
    const { state } = await workInventoryFixture(page);
    state.mode = mode;
    await page.goto(
      `/admin/inventory${mode === "mismatch" ? `?branchId=${bookingId(101)}` : ""}`,
    );
    if (mode === "empty")
      await expect(
        page.getByRole("heading", { name: "No inventory records on this page" }),
      ).toBeVisible();
    else {
      await expect(button(page, "Retry inventory")).toBeVisible();
      await expect(table(page)).toHaveCount(0);
      state.mode = "normal";
      await button(page, "Retry inventory").click();
      await expect(table(page)).toBeVisible();
    }
  });
test("refresh failure retains blocked old facts and denial removes them", async ({
  page,
}) => {
  const { state } = await workInventoryFixture(page);
  await open(page);
  state.mode = "error";
  await button(page, "Refresh inventory").click();
  await expect(page.getByText(/Previously loaded inventory is shown/)).toBeVisible();
  await expect(button(page, "Next")).toBeDisabled();
  state.mode = "denied";
  await button(page, "Retry inventory").click();
  await expect(table(page)).toHaveCount(0);
});
test("creation validates, reviews, cancels without writes and opens saved stock", async ({
  page,
}) => {
  const { state } = await workInventoryFixture(page);
  await open(page);
  await expect(page).toHaveTitle(/Product inventory/);
  await button(page, "Add inventory record").click();
  await button(page, "Review inventory record").click();
  await expect(page.getByLabel("Inventory branch", { exact: true })).toBeFocused();
  await creation(page);
  await button(page, "Go back").click();
  expect(state.writes).toHaveLength(0);
  await expect(button(page, "Review inventory record")).toBeFocused();
  await button(page, "Review inventory record").click();
  await button(page, "Confirm change").click();
  await expect(page).toHaveURL(new RegExp(`/admin/inventory/${bookingId(4900)}$`));
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].csrf).toBeTruthy();
  expect(state.writes[0].body).toEqual({
    branchId: bookingId(101),
    productId: bookingId(4110),
    reorderLevel: 7,
  });
});
for (const outcome of ["uncertain", "contradictory", "uncommitted"])
  test(`${outcome} creation survives reload and reconciles without replay`, async ({
    page,
  }) => {
    const { state } = await workInventoryFixture(page);
    state.outcome = outcome;
    await open(page);
    await creation(page);
    await button(page, "Confirm change").click();
    await button(page, "Close & review record").click();
    await page.reload();
    await expect(button(page, "Review inventory record")).toBeDisabled();
    state.mode = "error";
    await button(page, "Check saved branch inventory").click();
    await expect(button(page, "Check saved branch inventory")).toBeEnabled();
    await expect(button(page, "Review inventory record")).toBeDisabled();
    state.mode = "normal";
    await button(page, "Check saved branch inventory").click();
    await expect(page.getByText(/Nothing was resent/).first()).toBeVisible();
    await expect(button(page, "Review inventory record")).toBeEnabled();
    if (outcome !== "uncommitted")
      await expect(
        page.getByRole("link", { name: "Open saved inventory record" }),
      ).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });
for (const profileMode of ["error", "mismatch"])
  test(`${profileMode} current access blocks creation before POST`, async ({ page }) => {
    const { state } = await workInventoryFixture(page);
    await open(page);
    await creation(page);
    state.profileMode = profileMode;
    await button(page, "Confirm change").click();
    await expect(button(page, "Close & review record")).toBeVisible();
    expect(state.writes).toHaveLength(0);
  });
test("unavailable storage blocks creation before POST", async ({ page }) => {
  const { state } = await workInventoryFixture(page);
  await open(page);
  await creation(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("Unavailable");
    };
  });
  await button(page, "Confirm change").click();
  await expect(button(page, "Close & review record")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("complete long records, mobile filters and creation remain accessible", async ({
  page,
}) => {
  const { state } = await workInventoryFixture(page);
  state.records[0].product.name = "Synthetic long brake pad description ".repeat(8);
  state.records[0].product.sku = "SKU".repeat(30);
  state.records[0].branch.name = "Long workshop name ".repeat(12);
  await open(page);
  await button(page, "Add inventory record").click();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      width < 768 &&
      (await button(page, "Filters").getAttribute("aria-expanded")) === "false"
    )
      await button(page, "Filters").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Initial reorder level")).toBeVisible();
});
