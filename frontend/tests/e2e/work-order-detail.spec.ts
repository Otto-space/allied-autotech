import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingId, workOrderDetailFixture } from "../fixtures/work-order-detail";
const path = `/admin/orders/${bookingId(1100)}`;
const review = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Review fulfilment change", exact: true });
test("direct detail has named navigation, saved VAT, historical lines and authorized links", async ({
  page,
}) => {
  await workOrderDetailFixture(page);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ORD-20261017-001");
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("table", { name: "Order items", exact: true }),
  ).toContainText("BP-102");
  await expect(page.locator(".work-order-totals")).toContainText("₦1,837.50");
  await expect(
    page.getByRole("link", { name: "View invoice INV-20261017-001", exact: true }),
  ).toHaveAttribute("href", `/admin/invoices/${bookingId(1300)}`);
  await expect(
    page.getByRole("link", { name: "Open aftercare", exact: true }),
  ).toHaveAttribute("href", `${path}/aftercare`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ORD-20261017-001");
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} sees usable transitions with role-specific invoice access`, async ({
    page,
  }) => {
    const { detail } = await workOrderDetailFixture(page, role);
    const requests: string[] = [];
    page.on("request", (req) => requests.push(new URL(req.url()).pathname));
    await page.goto(path);
    await expect(page.getByLabel("Next status")).toBeEnabled();
    expect(
      await page.getByLabel("Next status").locator("option").allTextContents(),
    ).toEqual(["Choose next status", "Ready"]);
    await expect(page.getByRole("link", { name: /View invoice/ })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    expect(
      requests.filter(
        (p) =>
          p.startsWith("/api/v1/") &&
          /\/payments|\/invoices|\/aftercare|\/admin\/branches/.test(p),
      ),
    ).toEqual([]);
    expect(detail.writes).toHaveLength(0);
  });
test("customer direct navigation does not fetch staff detail", async ({ page }) => {
  const { detail } = await workOrderDetailFixture(page, "CUSTOMER");
  await page.goto(path);
  await expect(page.getByLabel("Next status")).toHaveCount(0);
  expect(detail.reads).toEqual([]);
});
test("review validates, cancels with focus restored and writes once with observed version and CSRF", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  await page.goto(path);
  await review(page).click();
  await expect(page.getByLabel("Next status")).toBeFocused();
  await page.getByLabel("Next status").selectOption("READY");
  await review(page).click();
  await expect(page.getByRole("dialog")).toContainText("Ready");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review(page)).toBeFocused();
  expect(detail.writes).toHaveLength(0);
  await review(page).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.locator(".work-order-summary .status")).toHaveText("Ready");
  expect(detail.writes).toHaveLength(1);
  expect(detail.writes[0].body).toEqual({ status: "READY", expectedVersion: 0 });
  expect(detail.writes[0].csrf).toBeTruthy();
});
test("unpaid pending orders offer cancellation with a required one-paragraph reason", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  Object.assign(detail.record, {
    status: "PENDING",
    paidAt: null,
    allowedTransitions: ["CANCELLED"],
  });
  await page.goto(path);
  await expect(page.getByLabel("Next status")).toBeEnabled();
  expect(
    await page.getByLabel("Next status").locator("option").allTextContents(),
  ).toEqual(["Choose next status", "Cancelled"]);
  await page.getByLabel("Next status").selectOption("CANCELLED");
  await review(page).click();
  await expect(page.getByLabel("Reason (required for cancellation)")).toBeFocused();
  await page.getByLabel("Reason (required for cancellation)").fill("One\nTwo");
  await review(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Reason (required for cancellation)")
    .fill("Customer requested cancellation.");
  await review(page).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.locator(".work-order-summary .status")).toHaveText("Cancelled");
  expect(detail.writes[0].body).toMatchObject({
    reason: "Customer requested cancellation.",
  });
});
test("approved cancellation becomes selectable; terminal orders have no mutation controls", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  detail.record.allowedTransitions = ["READY", "CANCELLED"];
  await page.goto(path);
  await expect(
    page.getByLabel("Next status").locator('option[value="CANCELLED"]'),
  ).toHaveCount(1);
  detail.record.status = "COMPLETED";
  detail.record.allowedTransitions = [];
  await page.getByRole("button", { name: "Refresh order", exact: true }).click();
  await expect(
    page.getByText("No further fulfilment changes are available."),
  ).toBeVisible();
  await expect(review(page)).toHaveCount(0);
});
test("freshness check catches a changed record before POST", async ({ page }) => {
  const { detail } = await workOrderDetailFixture(page);
  await page.goto(path);
  await page.getByLabel("Next status").selectOption("READY");
  await review(page).click();
  detail.record.version++;
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  expect(detail.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review(page)).toBeEnabled();
});
for (const outcome of ["uncertain", "uncommitted", "contradictory"])
  test(`${outcome} save survives reload and reconciles without replay`, async ({
    page,
  }) => {
    const { detail } = await workOrderDetailFixture(page);
    detail.outcome = outcome;
    await page.goto(path);
    await page.getByLabel("Next status").selectOption("READY");
    await review(page).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await page.reload();
    await expect(review(page)).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Load saved order and clear pending change",
        exact: true,
      })
      .click();
    await expect(review(page)).toBeEnabled();
    expect(detail.writes).toHaveLength(1);
    await expect(page.locator(".work-order-summary .status")).toHaveText(
      outcome === "uncommitted" ? "Processing" : "Ready",
    );
  });
test("known rejection requires returning from review and does not lock a pending outcome", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  detail.outcome = "reject";
  await page.goto(path);
  await page.getByLabel("Next status").selectOption("READY");
  await review(page).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review(page)).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Load saved order and clear pending change" }),
  ).toHaveCount(0);
});
for (const mode of ["error", "denied", "missing", "malformed", "mismatch"])
  test(`${mode} read hides private details and recovers`, async ({ page }) => {
    const { detail } = await workOrderDetailFixture(page);
    detail.mode = mode;
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Retry order", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("ada@example.test", { exact: true })).toHaveCount(0);
    detail.mode = "normal";
    await page.getByRole("button", { name: "Retry order", exact: true }).click();
    await expect(page.getByText("ada@example.test", { exact: true })).toBeVisible();
  });
test("transient refresh retains disclosed records but disables edits; denial removes private data", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  await page.goto(path);
  await expect(review(page)).toBeEnabled();
  detail.mode = "error";
  await page.getByRole("button", { name: "Refresh order", exact: true }).click();
  await expect(page.getByText(/Previously loaded details/)).toBeVisible();
  await expect(review(page)).toBeDisabled();
  await expect(page.getByText("ada@example.test", { exact: true })).toBeVisible();
  detail.mode = "denied";
  await page.getByRole("button", { name: "Retry order", exact: true }).click();
  await expect(page.getByText("ada@example.test", { exact: true })).toHaveCount(0);
});
test("delivery, missing address, absent tax and unassigned branch are truthful", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  detail.record.fulfillmentMethod = "DELIVERY";
  detail.record.branch = null;
  delete detail.record.taxKobo;
  await page.goto(path);
  await expect(page.getByText(/Delivery details are unavailable/)).toBeVisible();
  await expect(page.getByText("Branch not recorded.", { exact: true })).toBeVisible();
  await expect(page.locator(".work-order-totals")).toContainText("Not provided.");
  Object.assign(detail.record, {
    deliveryAddress: "133 Synthetic Road",
    deliveryName: "Recipient QA",
    deliveryPhone: "+2348000000000",
    deliveryCity: "Port Harcourt",
    deliveryState: "Rivers",
    deliveryCountry: "Nigeria",
  });
  await page.getByRole("button", { name: "Refresh order", exact: true }).click();
  await expect(page.getByText("133 Synthetic Road", { exact: true })).toBeVisible();
});
test("invalid route is rejected without a detail request", async ({ page }) => {
  const { detail } = await workOrderDetailFixture(page);
  const response = await page.goto("/admin/orders/invalid");
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.getByRole("heading", { name: /couldn.*find that page/i }),
  ).toBeVisible();
  expect(detail.reads).toHaveLength(0);
});
test("long content and reduced motion remain accessible across widths", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page);
  detail.record.orderNumber = "REFERENCE".repeat(13);
  detail.record.customerName = "Long customer name ".repeat(12);
  detail.record.items[0].productName = "Historical product name ".repeat(15);
  detail.record.totalKobo = "999999999999999999";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(review(page)).toBeEnabled();
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
