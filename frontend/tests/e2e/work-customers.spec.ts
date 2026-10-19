import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCustomersFixture, bookingId } from "../fixtures/work-customers";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  rows = (p: Page) => p.locator(".wc-record");
async function open(p: Page) {
  await p.goto("/admin/customers");
  await expect(rows(p)).toHaveCount(25);
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads complete customer identities and verification independently`, async ({
    page,
  }) => {
    const f = await workCustomersFixture(page, role);
    await open(page);
    await expect(rows(page).first()).toContainText("Amina Okafor");
    await expect(rows(page).first()).toContainText(bookingId(30000));
    await expect(rows(page).first()).toContainText("10:00:00.123");
    await expect(
      page.getByRole("link", { name: "Amina Okafor", exact: true }),
    ).toHaveAttribute("href", `/admin/customers/${bookingId(30000)}`);
    expect(f.customers.writes).toHaveLength(0);
  });
test("own profile defers private reads and failed access can recover", async ({
  page,
}) => {
  const f = await workCustomersFixture(page);
  f.state.profileMode = "hold";
  await page.goto("/admin/customers");
  await expect(
    page.getByText("Checking customer access…", { exact: true }),
  ).toBeVisible();
  expect(f.customers.reads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry customer access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry customer access").click();
  await expect(rows(page)).toHaveCount(25);
});
test("Staff cannot read directory or see search controls", async ({ page }) => {
  const f = await workCustomersFixture(page, "STAFF");
  await page.goto("/admin/customers");
  await expect(
    page.getByText("Administrator access is required to view customers.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.customers.reads).toHaveLength(0);
  await expect(page.getByLabel("Search customers", { exact: true })).toHaveCount(0);
});
for (const q of [
  "?search=a",
  "?field=invalid",
  "?search=a&search=b",
  "?cursor=bad!",
  "?branchId=bad",
])
  test(`invalid query ${q} stops before private reads`, async ({ page }) => {
    const f = await workCustomersFixture(page);
    await page.goto("/admin/customers" + q);
    await expect(
      page.getByRole("heading", { name: "Customer filters unavailable" }),
    ).toBeVisible();
    expect(f.customers.reads).toHaveLength(0);
    await btn(page, "Clear customer filters").click();
    await expect(rows(page)).toHaveCount(25);
  });
test("25+3 cursor navigation survives reload and Back", async ({ page }) => {
  await workCustomersFixture(page);
  await open(page);
  await btn(page, "Next").click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page).toHaveURL(/cursor=syntheticOpaqueCursor25/);
  await page.reload();
  await expect(rows(page)).toHaveCount(3);
  await btn(page, "Previous").click();
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(rows(page)).toHaveCount(3);
  await btn(page, "First page").click();
  await expect(rows(page)).toHaveCount(25);
});
test("explicit search normalizes prefix, combines filters and sends no keystroke reads", async ({
  page,
}) => {
  const f = await workCustomersFixture(page);
  await open(page);
  const before = f.customers.reads.length;
  await page.getByLabel("Search customers", { exact: true }).fill(" Amina  Okafor ");
  await page.getByLabel("Email verification", { exact: true }).selectOption("true");
  await page.getByLabel("Sort by", { exact: true }).selectOption("oldest");
  expect(f.customers.reads.length).toBe(before);
  await btn(page, "Search customers").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/search=amina\+okafor/);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("oldest");
  await btn(page, "Clear filters").click();
  await expect(rows(page)).toHaveCount(25);
});
test("invalid submitted search focuses input without dispatch", async ({ page }) => {
  const f = await workCustomersFixture(page);
  await open(page);
  const before = f.customers.reads.length;
  await page.getByLabel("Search by", { exact: true }).selectOption("phone");
  await page.getByLabel("Search customers", { exact: true }).fill("12");
  await btn(page, "Search customers").click();
  await expect(page.getByLabel("Search customers", { exact: true })).toBeFocused();
  expect(f.customers.reads.length).toBe(before);
});
test("named detail and Back restore the current ID search", async ({ page }) => {
  await workCustomersFixture(page);
  await open(page);
  await page.getByLabel("Email verification", { exact: true }).selectOption("true");
  await btn(page, "Search customers").click();
  await expect(rows(page)).toHaveCount(14);
  await page.reload();
  await expect(rows(page)).toHaveCount(14);
  await page.getByLabel("Search by", { exact: true }).selectOption("id");
  await page.getByLabel("Search customers", { exact: true }).fill(bookingId(30000));
  await btn(page, "Search customers").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`search=${bookingId(30000)}`));
  await page.getByRole("link", { name: "Amina Okafor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Amina Okafor", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/customers/${bookingId(30000)}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`search=${bookingId(30000)}`));
  await expect(rows(page)).toHaveCount(1);
});
for (const mode of ["malformed", "duplicate", "bad-cursor"])
  test(`${mode} page exposes no rows`, async ({ page }) => {
    const f = await workCustomersFixture(page);
    f.customers.mode = mode;
    await page.goto("/admin/customers");
    await expect(btn(page, "Retry customers")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
test("outage keeps labelled old facts and blocks paging; denial clears private data", async ({
  page,
}) => {
  const f = await workCustomersFixture(page);
  await open(page);
  f.customers.mode = "error";
  await btn(page, "Refresh customers").click();
  await expect(btn(page, "Retry customers")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(btn(page, "Next")).toBeDisabled();
  await expect(
    page.getByText("Previously loaded customers are shown.", { exact: false }),
  ).toBeVisible();
  f.customers.mode = "denied";
  await btn(page, "Retry customers").click();
  await expect(rows(page)).toHaveCount(0);
});
test("empty, error and access failure remain distinct accessible states", async ({
  page,
}) => {
  const f = await workCustomersFixture(page);
  f.customers.mode = "empty";
  await page.goto("/admin/customers");
  await expect(
    page.getByRole("heading", { name: "No customers on this page" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  f.customers.mode = "error";
  await btn(page, "Refresh customers").click();
  await expect(btn(page, "Retry customers")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  f.state.profileMode = "denied";
  await page.reload();
  await expect(btn(page, "Retry customer access")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("seven responsive widths and long identities fit without horizontal scrolling", async ({
  page,
}) => {
  const f = await workCustomersFixture(page);
  f.customers.records = f.customers.records.slice(0, 3);
  f.customers.records[0].firstName = "N".repeat(180);
  f.customers.records[0].email = "x".repeat(100) + "@example.test";
  await page.goto("/admin/customers");
  await expect(rows(page)).toHaveCount(3);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
});
