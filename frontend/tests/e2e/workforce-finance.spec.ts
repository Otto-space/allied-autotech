import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceFinanceFixture, paymentFixtureId } from "../fixtures/workforce-finance";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
const root = "/admin/workforce/finance",
  rows = (p: Page) => p.locator(".wfc-results tbody tr"),
  detail = (p: Page) => p.getByRole("region", { name: "Selected payment", exact: true });
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function ready(page: Page) {
  const state = await workforceFinanceFixture(page);
  await page.goto(root + "?selected=" + paymentFixtureId(1));
  await expect(rows(page)).toHaveCount(2);
  await expect(detail(page)).toContainText("NGN 27,500.50");
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
  test(`finance layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state = await ready(page);
    await expect(
      page.getByRole("heading", { name: "Payment records", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(detail(page)).toContainText("Recorded dates");
    await expect(detail(page)).toContainText(
      "Bank settlement and refunds are handled separately.",
    );
    await expect(detail(page).locator("form")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    expect(errors).toEqual([]);
    expect(state.writes).toEqual([]);
    if ([430, 768, 1280, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({
        path: `C:/Users/PC/.codex/workforce-finance-final-${width}.png`,
        fullPage: true,
      });
    }
  });
test("combined filters, invoice search, selection, reload, empty and clear", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Search payments", { exact: true }).fill("INV-2026-0082");
  await page.getByLabel("Payment status", { exact: true }).selectOption("PROCESSING");
  await page.getByLabel("Purpose", { exact: true }).selectOption("SERVICE_INVOICE");
  await button(page, "Apply filters").click();
  await expect(rows(page)).toHaveCount(1);
  await button(page, "View payment: PAY-2026-0149").click();
  await page.reload();
  await expect(
    detail(page).getByRole("heading", { name: "PAY-2026-0149", exact: true }),
  ).toBeVisible();
  await expect(detail(page)).toContainText("Service invoice");
  await page.getByLabel("Search payments", { exact: true }).fill("Unmatched");
  await button(page, "Apply filters").click();
  await expect(
    page.getByText("No payments match these filters", { exact: true }),
  ).toBeVisible();
  await button(page, "Clear filters").click();
  await expect(rows(page)).toHaveCount(2);
});
test("paging and selected payment survive reload and Back", async ({ page }) => {
  const s = await workforceFinanceFixture(page);
  for (let n = 3; n <= 27; n++)
    s.items.push({
      ...s.items[0],
      id: paymentFixtureId(n),
      paymentNumber: `Payment ${n}`,
    });
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await button(page, "Next payments").click();
  await expect(rows(page)).toHaveCount(2);
  await button(page, "View payment: Payment 26").click();
  await page.reload();
  await expect(detail(page)).toContainText("Payment 26");
  await button(page, "Previous page").click();
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(rows(page)).toHaveCount(2);
});
test("current detail refresh updates recorded facts and keeps selection", async ({
  page,
}) => {
  const s = await ready(page);
  s.items[0].status = "CANCELLED";
  s.items[0].cancelledAt = "2026-10-20T09:10:00.000Z";
  await button(page, "Refresh records").click();
  await expect(detail(page)).toContainText("Cancelled");
  await expect(detail(page)).toContainText("20 Oct 2026, 10:10");
  expect(s.writes).toEqual([]);
});
test("failed refresh hides retained facts and retry recovers", async ({ page }) => {
  const s = await ready(page);
  s.listFailure = true;
  await button(page, "Refresh records").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(detail(page)).not.toContainText("NGN 27,500.50");
  s.listFailure = false;
  await button(page, "Refresh records").click();
  await expect(rows(page)).toHaveCount(2);
  s.detailFailure = true;
  await button(page, "Refresh records").click();
  await expect(detail(page)).toContainText("Payment could not be verified");
  await expect(detail(page)).not.toContainText("NGN 27,500.50");
  s.detailFailure = false;
  await button(page, "Check payment again").click();
  await expect(detail(page)).toContainText("NGN 27,500.50");
});
test("denied and mismatched detail never show private payment facts", async ({
  page,
}) => {
  const s = await ready(page);
  s.detailDenied = true;
  await button(page, "Refresh records").click();
  await expect(detail(page)).toContainText("Payment access unavailable");
  await expect(detail(page)).not.toContainText("NGN 27,500.50");
  s.detailDenied = false;
  s.detailMismatch = true;
  await button(page, "Check payment again").click();
  await expect(detail(page)).toContainText("Payment could not be verified");
  await expect(detail(page)).not.toContainText("NGN 27,500.50");
});
test("scope mismatch and responsibility revocation hide payment records", async ({
  page,
}) => {
  const s = await ready(page);
  s.listMismatch = true;
  await button(page, "Refresh records").click();
  await expect(
    page.getByText("Your responsibilities changed", { exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  s.listMismatch = false;
  s.base.access.permissions = [];
  s.base.access.assignments = [];
  await button(page, "Refresh records").click();
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  await expect(detail(page)).toHaveCount(0);
});
test("invalid URLs do not send finance requests", async ({ page }) => {
  const s = await workforceFinanceFixture(page);
  await page.goto(root + "?status=constructor&selected=bad");
  await expect(
    page.getByText("Payment filters unavailable", { exact: true }),
  ).toBeVisible();
  expect(s.reads).toEqual([]);
  await button(page, "Clear filters").click();
  await expect(rows(page)).toHaveCount(2);
});
test("Operations cannot open Accountant payment records", async ({ page }) => {
  const s = await workforceNotificationsFixture(page, "OPERATIONS");
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  expect(s.requests.filter((p) => p.startsWith("/staff/workforce/finance"))).toEqual([]);
});
test("loading and empty state expose no selected financial facts", async ({ page }) => {
  const s = await workforceFinanceFixture(page);
  s.hold = true;
  await page.goto(root + "?selected=" + paymentFixtureId(1));
  await expect(
    page.getByText("Checking permitted payments…", { exact: true }),
  ).toBeVisible();
  await expect(detail(page)).not.toContainText("NGN 27,500.50");
  s.items.splice(0);
  s.hold = false;
  s.release?.();
  await expect(rows(page)).toHaveCount(0);
  await expect(
    page.getByText("No payments in your current scope", { exact: true }),
  ).toBeVisible();
});
test("keyboard selection and close restore focus and large money stays exact at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  const s = await workforceFinanceFixture(page);
  s.items[0].paymentNumber = "PAY-" + "LONGREFERENCE".repeat(8);
  s.items[0].amountKobo = "900719925474099101";
  s.items[0].sources[0].reference = "Record " + "long reference ".repeat(30);
  await page.goto(root);
  const view = button(page, "View payment: " + s.items[0].paymentNumber);
  await view.focus();
  await page.keyboard.press("Enter");
  await expect(
    detail(page).getByRole("heading", { name: s.items[0].paymentNumber, exact: true }),
  ).toBeFocused();
  await expect(detail(page)).toContainText("NGN 9,007,199,254,740,991.01");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await axe(page);
  await button(page, "Close selection").click();
  await expect(view).toBeFocused();
  expect(s.writes).toEqual([]);
});
