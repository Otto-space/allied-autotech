import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import {
  workVehicleStockFixture,
  stockRecord,
  bookingId,
} from "../fixtures/work-vehicle-stock";
const button = (p: Page, name: string) =>
  ["Next", "Previous", "First page"].includes(name)
    ? p
        .getByRole("navigation", { name: "Vehicle stock pages", exact: true })
        .getByRole("button", { name, exact: true })
    : p.getByRole("button", { name, exact: true });
const table = (p: Page) => p.getByRole("table", { name: "Vehicle stock", exact: true });
const rows = (p: Page) => p.locator(".ws-table tbody tr");
async function open(p: Page, query = "") {
  await p.goto(`/admin/vehicles${query}`);
  await expect(table(p)).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} sees named stock, listing and branch facts with no writes`, async ({
    page,
  }) => {
    const { state } = await workVehicleStockFixture(page, role);
    await open(page);
    await expect(page).toHaveTitle(/Vehicle/);
    await expect(rows(page)).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: "Manage 2022 Toyota Camry (AA-001)", exact: true }),
    ).toHaveAttribute("href", `/admin/vehicles/${bookingId(7000)}`);
    await expect(
      page.getByRole("link", { name: "Add vehicle record", exact: true }),
    ).toHaveAttribute("href", "/admin/vehicles/new");
    await expect(page.getByLabel("Branch filter", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    if (role === "STAFF") {
      await expect(page.getByText(/Showing your assigned active branch/)).toBeVisible();
      await expect(page.locator(".ws-price").last()).toContainText(
        "99,999,999,999,999.99",
      );
      await expect(
        page.locator(".ws-specs").filter({ hasText: /^New · 0 km/ }),
      ).toBeVisible();
    } else {
      await expect(page.getByText("Inactive branch", { exact: true })).toBeVisible();
      await expect(page.getByText("Not listed", { exact: true })).toBeVisible();
    }
    await expect(page.locator(".ws-price").first()).toContainText("28,500,000.00");
    expect(state.writes).toHaveLength(0);
    await expect.poll(() => state.imageReads.length).toBeGreaterThan(0);
  });
test("customer does not request private stock", async ({ page }) => {
  const { state } = await workVehicleStockFixture(page, "CUSTOMER");
  await page.goto("/admin/vehicles");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(state.reads).toHaveLength(0);
});
test("stock waits for verified profile and retries profile failure", async ({ page }) => {
  const { state } = await workVehicleStockFixture(page);
  state.profileMode = "hold";
  await page.goto("/admin/vehicles");
  await expect(page.getByText("Checking stock access…", { exact: true })).toBeVisible();
  expect(state.reads).toHaveLength(0);
  state.profileMode = "error";
  state.held?.();
  await expect(button(page, "Retry stock access")).toBeVisible();
  expect(state.reads).toHaveLength(0);
  state.profileMode = "normal";
  await button(page, "Retry stock access").click();
  await expect(table(page)).toBeVisible();
});
for (const mode of ["inactive", "unassigned", "inactive-branch"])
  test(`Staff ${mode} cannot use unavailable stock scope`, async ({ page }) => {
    const { state } = await workVehicleStockFixture(page, "STAFF");
    if (mode === "inactive") state.profileMode = "inactive";
    else state.profileBranch = mode === "unassigned" ? null : bookingId(102);
    await page.goto("/admin/vehicles");
    await expect(table(page)).toHaveCount(0);
    await expect(
      button(
        page,
        mode === "inactive"
          ? "Retry stock access"
          : mode === "unassigned"
            ? "Recheck branch assignment"
            : "Retry vehicle stock",
      ),
    ).toBeVisible();
    if (mode !== "inactive-branch") expect(state.reads).toHaveLength(0);
    await expect(
      page.getByRole("link", { name: "Add vehicle record", exact: true }),
    ).toHaveCount(0);
  });
test("filters apply deliberately and survive paging, reload and browser history", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  await open(page);
  await button(page, "Next").click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await button(page, "Previous").click();
  await expect(rows(page)).toHaveCount(3);
  const count = state.reads.length;
  await page.getByLabel("Exact make", { exact: true }).fill("Toyota");
  await page.getByLabel("Exact model", { exact: true }).fill("Camry");
  await page.getByLabel("Model year filter").fill("2022");
  await page.getByLabel("Listing status filter").selectOption("AVAILABLE");
  expect(state.reads).toHaveLength(count);
  await button(page, "Apply stock filters").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/make=Toyota&model=Camry&year=2022&status=AVAILABLE$/);
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Exact model", { exact: true })).toHaveValue("Camry");
  await button(page, "Clear stock filters").first().click();
  await expect(rows(page)).toHaveCount(3);
  await page.goBack();
  await expect(rows(page)).toHaveCount(1);
});
test("literal search and listed versus unlisted filters remain distinct", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  await open(page);
  await page.getByLabel("Search stock records").fill("%_");
  await button(page, "Apply stock filters").click();
  await expect(rows(page)).toHaveCount(1);
  expect(state.reads.at(-1)?.searchParams.get("search")).toBe("%_");
  await button(page, "Clear stock filters").click();
  await page.getByLabel("Listing status filter").selectOption("UNLISTED");
  await button(page, "Apply stock filters").click();
  await expect(page.getByText("Not listed", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await page.getByLabel("Listing status filter").selectOption("LISTED");
  await button(page, "Apply stock filters").click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText("Not listed", { exact: true })).toHaveCount(0);
});
test("historical and off-page branch names resolve from authoritative branch reads", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  await open(page, `?branchId=${bookingId(103)}`);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator("#stock-filter-branch option:checked")).toHaveText(
    "Remote workshop",
  );
  expect(state.branchReads).toContain(bookingId(103));
  await page.reload();
  await expect(page.locator("#stock-filter-branch option:checked")).toHaveText(
    "Remote workshop",
  );
  await page.getByLabel("Branch filter", { exact: true }).selectOption(bookingId(102));
  await button(page, "Apply stock filters").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText("Inactive branch", { exact: true })).toBeVisible();
});
for (const query of [
  "year=2e3",
  "listed=false&status=AVAILABLE",
  "search=a&search=b",
  "minPriceKobo=100",
])
  test(`invalid stock link ${query} issues no list request`, async ({ page }) => {
    const { state } = await workVehicleStockFixture(page);
    await page.goto(`/admin/vehicles?${query}`);
    await expect(
      page.getByRole("heading", { name: "Stock filters unavailable" }),
    ).toBeVisible();
    expect(state.reads).toHaveLength(0);
    await button(page, "Clear stock filters").click();
    await expect(table(page)).toBeVisible();
  });
test("Staff foreign branch links are rejected before requesting stock", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page, "STAFF");
  await page.goto(`/admin/vehicles?branchId=${bookingId(102)}`);
  await expect(
    page.getByRole("heading", { name: "Stock filters unavailable" }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
});
for (const mode of [
  "empty",
  "error",
  "denied",
  "malformed",
  "duplicate",
  "mismatch",
  "leak",
])
  test(`${mode} retains honest stock state and recovery`, async ({ page }) => {
    const { state } = await workVehicleStockFixture(
      page,
      mode === "leak" ? "STAFF" : "ADMIN",
    );
    state.mode = mode;
    await page.goto(`/admin/vehicles${mode === "mismatch" ? "?year=2022" : ""}`);
    if (mode === "empty") {
      await expect(
        page.getByRole("heading", { name: "No vehicle stock yet", exact: true }),
      ).toBeVisible();
      return;
    }
    await expect(button(page, "Retry vehicle stock")).toBeVisible();
    await expect(table(page)).toHaveCount(0);
    state.mode = "normal";
    await button(page, "Retry vehicle stock").click();
    await expect(table(page)).toBeVisible();
  });
test("revalidated branch reassignment removes previous branch facts", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page, "STAFF");
  await open(page);
  await expect(rows(page)).toHaveCount(3);
  state.profileBranch = bookingId(103);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Manage 2018 Test%_Make/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage 2022 Toyota Camry (AA-001)", exact: true }),
  ).toHaveCount(0);
});
test("refresh failure preserves prior facts with paging blocked; permission denial clears them", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  await open(page);
  state.mode = "error";
  await button(page, "Refresh vehicle stock").click();
  await expect(page.getByText(/Previously loaded stock records/)).toBeVisible();
  await expect(table(page)).toBeVisible();
  await expect(button(page, "Next")).toBeDisabled();
  state.mode = "denied";
  await button(page, "Retry vehicle stock").click();
  await expect(table(page)).toHaveCount(0);
});
test("all historical listings and exact prices remain visible; failed image has useful fallback", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  state.imageMode = "error";
  state.records[0].listings.push({
    ...state.records[0].listings[0],
    id: bookingId(7300),
    title: "Previous archived sale",
    status: "ARCHIVED",
    priceKobo: "1234567891",
  });
  await open(page);
  await expect(page.getByText("Previous archived sale", { exact: true })).toBeVisible();
  await expect(table(page).getByText("Archived", { exact: true })).toBeVisible();
  await expect(page.locator(".ws-price").nth(1)).toContainText("12,345,678.91");
  await expect(page.locator(".ws-thumb").first()).toContainText("Image unavailable");
});
test("cursor-only entry returns to the first page without inventing a page number", async ({
  page,
}) => {
  await workVehicleStockFixture(page);
  await open(page, `?cursor=${bookingId(7002)}`);
  await expect(page.getByText("Later page", { exact: true })).toBeVisible();
  await button(page, "First page").click();
  await expect(page).toHaveURL(/\/admin\/vehicles$/);
  await expect(rows(page)).toHaveCount(3);
});
test("named stock route opens and browser back restores the applied filters", async ({
  page,
}) => {
  await workVehicleStockFixture(page);
  await open(page, "?year=2022");
  await page
    .getByRole("link", { name: "Manage 2022 Toyota Camry (AA-001)", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/vehicles/${bookingId(7000)}$`));
  await page.goBack();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel("Model year filter")).toHaveValue("2022");
});
test("responsive layouts preserve every stock fact, readable controls and keyboard filter disclosure", async ({
  page,
}) => {
  await workVehicleStockFixture(page);
  await open(page);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    const toggle = page.locator(".ws-filter-toggle");
    if (width <= 1180) {
      await expect(toggle).toBeVisible();
      await expect(page.getByLabel("Search stock records")).toBeHidden();
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Search stock records")).toBeVisible();
      await page.getByLabel("Search stock records").focus();
      await expect(page.getByLabel("Search stock records")).toHaveCSS(
        "outline-color",
        "rgb(208, 3, 1)",
      );
      await toggle.click();
    } else await expect(toggle).toBeHidden();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(rows(page)).toHaveCount(3);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: path.join("C:/Users/PC/.codex", `work-vehicle-stock-${width}.png`),
      fullPage: true,
    });
  }
});
test("long stock, branch, listing names and maximum money wrap at small and large widths", async ({
  page,
}) => {
  const { state } = await workVehicleStockFixture(page);
  const record = stockRecord(3);
  record.make = "W".repeat(80);
  record.model = "M".repeat(80);
  record.stockNumber = "S".repeat(40);
  record.branch.name = "B".repeat(180);
  record.branch.code = "C".repeat(40);
  record.listings[0].title = "L".repeat(180);
  state.records = [record];
  await open(page);
  for (const width of [320, 430, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.locator(".ws-price")).toContainText("99,999,999,999,999.99");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join("C:/Users/PC/.codex", `work-vehicle-stock-long-${width}.png`),
      fullPage: true,
    });
  }
});
