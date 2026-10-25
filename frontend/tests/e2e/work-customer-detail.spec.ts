import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCustomerDetailFixture, bookingId } from "../fixtures/work-customer-detail";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  rows = (p: Page) => p.locator(".wcd-record");
async function open(p: Page, q = "") {
  await p.goto(`/admin/customers/${bookingId(30000)}${q}`);
  await expect(
    p.getByRole("heading", { name: "Amina Okafor", exact: true }),
  ).toBeVisible();
  await expect(rows(p)).toHaveCount(25);
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads complete named profile and exact activity facts`, async ({
    page,
  }) => {
    await workCustomerDetailFixture(page, role);
    await open(page, "?collection=orders");
    await expect(page.locator(".wcd-overview")).toContainText(bookingId(30000));
    await expect(page.locator(".wcd-overview")).toContainText("Not provided");
    await expect(page.locator(".wcd-overview")).toContainText("10:00");
    await expect(rows(page).first()).toContainText("99,999,999,999,999.99");
    await expect(rows(page).nth(1)).toContainText("₦0.00");
    await expect(
      page.getByRole("link", { name: "AAT-ORDER-1", exact: true }),
    ).toHaveAttribute("href", `/admin/orders/${bookingId(40000)}`);
  });
test("own identity gate defers all private detail and activity reads", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  f.state.profileMode = "hold";
  await page.goto(`/admin/customers/${bookingId(30000)}`);
  await expect(
    page.getByText("Checking customer access…", { exact: true }),
  ).toBeVisible();
  expect(f.detail.reads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry customer access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry customer access").click();
  await expect(rows(page)).toHaveCount(25);
});
test("Staff has no customer detail controls or private reads", async ({ page }) => {
  const f = await workCustomerDetailFixture(page, "STAFF");
  await page.goto(`/admin/customers/${bookingId(30000)}`);
  await expect(
    page.getByText("Administrator access is required to view customers.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.detail.reads).toHaveLength(0);
});
for (const mode of ["malformed", "mismatch", "denied", "missing"])
  test(`${mode} summary reveals no account or activity`, async ({ page }) => {
    const f = await workCustomerDetailFixture(page);
    f.detail.mode = mode;
    await page.goto(`/admin/customers/${bookingId(30000)}`);
    await expect(btn(page, "Retry customer details")).toBeVisible();
    await expect(page.locator(".wcd-overview")).toHaveCount(0);
    expect(f.detail.activityReads).toHaveLength(0);
  });
for (const q of [
  "?collection=bad",
  "?collection=orders&collection=payments",
  "?cursor=opaque",
  "?search=Amina",
])
  test(`invalid activity query ${q} stops collection reads`, async ({ page }) => {
    const f = await workCustomerDetailFixture(page);
    await page.goto(`/admin/customers/${bookingId(30000)}${q}`);
    await expect(
      page.getByRole("heading", { name: "Activity filters unavailable" }),
    ).toBeVisible();
    expect(f.detail.activityReads).toHaveLength(0);
    await btn(page, "Reset activity filters").click();
    await expect(rows(page)).toHaveCount(25);
  });
test("every activity collection has independent URL state and resets cursors", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  await open(page);
  for (const [label, kind] of [
    ["Bookings", "bookings"],
    ["Quotations", "quotations"],
    ["Orders", "orders"],
    ["Payments", "payments"],
    ["Enquiries", "enquiries"],
    ["Complaints", "complaints"],
    ["Garage", "vehicles"],
  ]) {
    await btn(page, label).click();
    await expect(btn(page, label)).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page)).toHaveCount(25);
    expect(f.detail.activityReads.at(-1)?.pathname).toContain("/" + kind);
    await expect(btn(page, "Previous")).toBeDisabled();
  }
});
test("25+3 activity paging, reload, collection changes and Back preserve state", async ({
  page,
}) => {
  await workCustomerDetailFixture(page);
  await open(page, "?collection=orders");
  await btn(page, "Next").click();
  await expect(rows(page)).toHaveCount(3);
  await page.reload();
  await expect(rows(page)).toHaveCount(3);
  await btn(page, "Payments").click();
  await expect(rows(page)).toHaveCount(25);
  await expect(page).not.toHaveURL(/cursor=/);
  await page.goBack();
  await expect(rows(page)).toHaveCount(3);
  await expect(btn(page, "Orders")).toHaveAttribute("aria-pressed", "true");
  await btn(page, "Previous").click();
  await expect(rows(page)).toHaveCount(25);
});
test("summary outage preserves labelled facts and blocks activity; denial clears both", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  await open(page);
  f.detail.mode = "error";
  await btn(page, "Refresh customer").click();
  await expect(btn(page, "Retry customer details")).toBeVisible();
  await expect(page.locator(".wcd-overview")).toBeVisible();
  await expect(btn(page, "Orders")).toBeDisabled();
  await expect(rows(page)).toHaveCount(0);
  f.detail.mode = "denied";
  await btn(page, "Retry customer details").click();
  await expect(page.locator(".wcd-overview")).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Customer activity", exact: true }),
  ).toHaveCount(0);
});
test("activity outage and denial remain independent of readable profile", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  await open(page);
  f.detail.activityMode = "error";
  await btn(page, "Refresh activity").click();
  await expect(btn(page, "Retry activity")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(btn(page, "Next")).toBeDisabled();
  await expect(page.locator(".wcd-overview")).toBeVisible();
  f.detail.activityMode = "denied";
  await btn(page, "Retry activity").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator(".wcd-overview")).toBeVisible();
});
test("empty and malformed activity never imply an empty customer", async ({ page }) => {
  const f = await workCustomerDetailFixture(page);
  f.detail.activityMode = "empty";
  await page.goto(`/admin/customers/${bookingId(30000)}?collection=orders`);
  await expect(
    page.getByRole("heading", { name: "No orders on this page" }),
  ).toBeVisible();
  f.detail.activityMode = "malformed";
  await btn(page, "Payments").click();
  await expect(btn(page, "Retry activity")).toBeVisible();
  await expect(page.locator(".wcd-overview")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});
test("garage records have no fabricated management links and foreign currency stays explicit", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  f.detail.records[0].currency = "USD";
  await open(page);
  await expect(rows(page).first().getByRole("link")).toHaveCount(0);
  await expect(rows(page).first()).not.toContainText("Recorded amount");
  await expect(rows(page).first()).not.toContainText("Status");
  await btn(page, "Orders").click();
  await expect(rows(page).first()).toContainText(
    "USD · 9,999,999,999,999,999 minor units",
  );
});
test("seven responsive widths fit full long facts and pass accessibility", async ({
  page,
}) => {
  const f = await workCustomerDetailFixture(page);
  f.detail.record.firstName = "N".repeat(180);
  f.detail.record.email = "x".repeat(100) + "@example.test";
  f.detail.records = f.detail.records.slice(0, 3);
  await page.goto(`/admin/customers/${bookingId(30000)}?collection=orders`);
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
