import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingId, workOrdersFixture } from "../fixtures/work-orders";
const path = "/admin/orders";
test("exact lookup, status, branch, pagination, reload and history preserve scope", async ({
  page,
}) => {
  const { state } = await workOrdersFixture(page);
  await page.goto(path);
  await expect(page.getByText("3 orders on this page")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("2 orders on this page")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Order number", { exact: true }).fill("  ORD-20261017-004  ");
  await page.getByLabel("Fulfilment status").selectOption("COMPLETED");
  await page.getByLabel("Branch", { exact: true }).selectOption(bookingId(101));
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 order on this page")).toBeVisible();
  expect(Object.fromEntries(state.reads.at(-1)!.searchParams)).toEqual({
    limit: "25",
    orderNumber: "ORD-20261017-004",
    status: "COMPLETED",
    branchId: bookingId(101),
  });
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 order on this page")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ORD-20261017-004", exact: true }),
  ).toHaveAttribute("href", `/admin/orders/${bookingId(1103)}`);
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} has only relevant discovery controls`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(new URL(req.url()).pathname));
    const { base } = await workOrdersFixture(page, role);
    await page.goto(path);
    await expect(page.getByText("3 orders on this page")).toBeVisible();
    await expect(page.getByLabel("Branch", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    if (role === "STAFF") expect(requests).not.toContain("/api/v1/admin/branches");
    expect(requests.filter((p) => /\/invoices|\/payments|\/refunds/.test(p))).toEqual([]);
    expect(base.writes).toEqual([]);
  });
test("customer direct access makes no operational requests", async ({ page }) => {
  const { state } = await workOrdersFixture(page, "CUSTOMER");
  await page.goto(path);
  await expect(page.getByLabel("Order number", { exact: true })).toHaveCount(0);
  expect(state.reads).toHaveLength(0);
});
for (const query of [
  "status=INVALID",
  "status=READY&status=PENDING",
  "cursor=bad",
  "orderNumber=a&orderNumber=b",
])
  test(`invalid link ${query} recovers without an API request`, async ({ page }) => {
    const { state } = await workOrdersFixture(page);
    await page.goto(`${path}?${query}`);
    await expect(
      page.getByRole("heading", { name: "Order filters unavailable" }),
    ).toBeVisible();
    expect(state.reads).toHaveLength(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("3 orders on this page")).toBeVisible();
  });
test("customer scope survives filters and can be cleared", async ({ page }) => {
  const { state } = await workOrdersFixture(page);
  await page.goto(`${path}?customerId=${bookingId(400)}`);
  await expect(page.getByText("Filtered to one customer")).toBeVisible();
  await page.getByLabel("Fulfilment status").selectOption("PENDING");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 order on this page")).toBeVisible();
  expect(state.reads.at(-1)!.searchParams.get("customerId")).toBe(bookingId(400));
  await page.getByRole("button", { name: "Clear customer filter" }).click();
  await expect(page).not.toHaveURL(/customerId=/);
});
for (const mode of ["error", "malformed", "denied", "mismatch"])
  test(`${mode} response recovers with retry`, async ({ page }) => {
    const { state } = await workOrdersFixture(page);
    state.mode = mode;
    await page.goto(`${path}${mode === "mismatch" ? "?status=READY" : ""}`);
    await expect(page.getByRole("button", { name: "Retry orders" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry orders" }).click();
    await expect(page.getByRole("table")).toBeVisible();
  });
test("temporary refresh failure retains records; denied refresh removes them", async ({
  page,
}) => {
  const { state } = await workOrdersFixture(page);
  await page.goto(path);
  await expect(page.getByRole("table")).toBeVisible();
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh orders" }).click();
  await expect(page.getByText(/Previously loaded orders/)).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "denied";
  await page.getByRole("button", { name: "Retry orders" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
});
test("loading, empty search and keyboard submission remain usable", async ({ page }) => {
  const { state } = await workOrdersFixture(page);
  state.mode = "hold";
  await page.goto(path);
  await expect(
    page.getByRole("status").filter({ hasText: /Loading orders/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  state.mode = "normal";
  state.held!();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Order number", { exact: true }).fill("NO-MATCH");
  await page.getByLabel("Order number", { exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "No orders match these filters" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});
test("long content, reduced motion and responsive accessibility", async ({ page }) => {
  const { state } = await workOrdersFixture(page);
  state.records[0].orderNumber = "REFERENCE".repeat(13);
  state.records[0].branch.name = "Long workshop name ".repeat(10);
  state.records[0].totalKobo = "999999999999999999";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.getByRole("table")).toBeVisible();
  for (const width of [320, 375, 430, 768, 1024, 1280, 1467, 1920]) {
    await page.setViewportSize({ width, height: 1050 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
});
