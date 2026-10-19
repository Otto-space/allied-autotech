import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleSalesFixture, bookingId } from "../fixtures/work-vehicle-sales";
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true }),
  rows = (page: Page) => page.locator(".wvs-record");
async function open(page: Page, query = "") {
  await page.goto(`/admin/vehicle-sales${query}`);
  await expect(rows(page).first()).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} sees named complete purchases with exact money and current scope`, async ({
    page,
  }) => {
    const f = await workVehicleSalesFixture(page, role);
    await open(page);
    await expect(rows(page)).toHaveCount(25);
    await expect(rows(page).first()).toContainText("Amina Okafor");
    await expect(rows(page).first()).toContainText("99,999,999,999,999.99");
    await expect(rows(page).first()).toContainText("Not agreed");
    await expect(rows(page).first()).toContainText("10:00:37.123");
    await expect(rows(page).nth(1)).toContainText("44,000,000.00");
    await expect(rows(page).nth(1)).toContainText("1,000,000.00");
    await expect(rows(page).nth(2)).toContainText("Ready");
    await expect(
      page.getByRole("link", { name: "AAT-VS-2026-001", exact: true }),
    ).toHaveAttribute("href", `/admin/vehicle-sales/${bookingId(10000)}`);
    await expect(page.getByLabel("Branch filter", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    await expect.poll(() => f.state.imageReads.length).toBeGreaterThan(0);
    expect(f.sales.writes).toHaveLength(0);
  });
test("profile gate defers private reads and recovers an outage", async ({ page }) => {
  const f = await workVehicleSalesFixture(page);
  f.state.profileMode = "hold";
  await page.goto("/admin/vehicle-sales");
  await expect(
    page.getByText("Checking vehicle-sales access…", { exact: true }),
  ).toBeVisible();
  expect(f.sales.reads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry sales access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry sales access").click();
  await expect(rows(page).first()).toBeVisible();
});
for (const query of [
  "?status=bad",
  "?search=Camry",
  "?cursor=bad",
  "?status=PAID&status=ENQUIRY",
])
  test(`invalid filter ${query} performs no collection read`, async ({ page }) => {
    const f = await workVehicleSalesFixture(page);
    await page.goto("/admin/vehicle-sales" + query);
    await expect(
      page.getByRole("heading", { name: "Purchase filters unavailable" }),
    ).toBeVisible();
    expect(f.sales.reads).toHaveLength(0);
    await btn(page, "Clear purchase filters").click();
    await expect(rows(page).first()).toBeVisible();
  });
test("Staff foreign branch link and response are rejected", async ({ page }) => {
  const f = await workVehicleSalesFixture(page, "STAFF");
  await page.goto(`/admin/vehicle-sales?branchId=${bookingId(103)}`);
  await expect(
    page.getByRole("heading", { name: "Purchase filters unavailable" }),
  ).toBeVisible();
  expect(f.sales.reads).toHaveLength(0);
  f.sales.mode = "foreign";
  f.sales.records[0].vehicleListing.branchId = bookingId(103);
  await btn(page, "Clear purchase filters").click();
  await expect(btn(page, "Retry vehicle sales")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});
test("cursor navigation survives reload and keeps exact filters/history", async ({
  page,
}) => {
  const f = await workVehicleSalesFixture(page);
  await open(page);
  const nav = page.getByRole("navigation", {
    name: "Vehicle purchases pages",
    exact: true,
  });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page).toHaveURL(/cursor=/);
  await page.reload();
  await expect(rows(page)).toHaveCount(3);
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page.getByLabel("Branch filter", { exact: true }).selectOption(bookingId(101));
  await page.getByLabel("Purchase status", { exact: true }).selectOption("NEGOTIATING");
  await btn(page, "Apply filters").click();
  await expect(rows(page)).toHaveCount(1);
  expect(f.sales.reads.at(-1)?.searchParams.get("branchId")).toBe(bookingId(101));
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await page.getByLabel("Purchase status", { exact: true }).selectOption("CANCELLED");
  await btn(page, "Apply filters").click();
  await expect(
    page.getByRole("heading", { name: "No purchases match these filters" }),
  ).toBeVisible();
  await page.goBack();
  await expect(rows(page)).toHaveCount(1);
  expect(f.sales.writes).toHaveLength(0);
});
for (const mode of ["malformed", "duplicate", "denied"])
  test(`${mode} collection shows no private purchase`, async ({ page }) => {
    const f = await workVehicleSalesFixture(page);
    f.sales.mode = mode;
    await page.goto("/admin/vehicle-sales");
    await expect(btn(page, "Retry vehicle sales")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
test("temporary errors preserve facts and block paging; denial removes them", async ({
  page,
}) => {
  const f = await workVehicleSalesFixture(page);
  await open(page);
  f.sales.mode = "error";
  await btn(page, "Refresh vehicle sales").click();
  await expect(btn(page, "Retry vehicle sales")).toBeVisible();
  await expect(rows(page).first()).toContainText("Amina Okafor");
  await expect(
    page
      .getByRole("navigation", { name: "Vehicle purchases pages", exact: true })
      .getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  f.sales.mode = "denied";
  await btn(page, "Retry vehicle sales").click();
  await expect(rows(page)).toHaveCount(0);
});
test("customer cannot request staff sales", async ({ page }) => {
  const f = await workVehicleSalesFixture(page, "CUSTOMER");
  await page.goto("/admin/vehicle-sales");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(f.sales.reads).toHaveLength(0);
});
test("protected image failure leaves a readable fallback and record", async ({
  page,
}) => {
  const f = await workVehicleSalesFixture(page);
  f.state.imageMode = "error";
  await open(page);
  await expect(
    rows(page).first().getByText("Image unavailable", { exact: true }),
  ).toBeVisible();
  await expect(rows(page).first()).toContainText("Toyota Camry SE");
  expect(f.sales.writes).toHaveLength(0);
});
test("empty, unavailable and access-error states have valid accessible structure", async ({
  page,
}) => {
  const f = await workVehicleSalesFixture(page);
  for (const mode of ["empty", "error", "profile-error"]) {
    f.sales.mode = mode === "profile-error" ? "normal" : mode;
    f.state.profileMode = mode === "profile-error" ? "error" : "normal";
    await page.goto("/admin/vehicle-sales");
    if (mode === "empty")
      await expect(
        page.getByRole("heading", {
          name: "No vehicle purchases on this page",
          exact: true,
        }),
      ).toBeVisible();
    else
      await expect(
        btn(page, mode === "error" ? "Retry vehicle sales" : "Retry sales access"),
      ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
test("seven responsive widths and long record facts pass accessibility checks", async ({
  page,
}) => {
  const f = await workVehicleSalesFixture(page);
  f.sales.records = f.sales.records.slice(0, 3);
  await open(page);
  for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  f.sales.records[0].customerName = "N".repeat(220);
  f.sales.records[0].transactionNumber = "T".repeat(50);
  f.sales.records[0].vehicleListing.title = "V".repeat(180);
  await btn(page, "Refresh vehicle sales").click();
  await expect(rows(page).first()).toContainText("N".repeat(220));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
