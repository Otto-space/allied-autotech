import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workDisputeOverviewFixture,
  disputeOverviewRow,
  id,
} from "../fixtures/work-payment-disputes";
const root = "/admin/payment-disputes";
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads an exact read-only overview without a management capability`, async ({
    page,
  }) => {
    const f = await workDisputeOverviewFixture(page, role);
    await page.goto(root);
    await expect(page.locator(".wd-record")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Open dispute work queue" })).toHaveCount(
      0,
    );
    expect(f.writes).toHaveLength(0);
  });
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} never reads administrator disputes`, async ({ page }) => {
    const f = await workDisputeOverviewFixture(page, role);
    await page.goto(root);
    await expect(page.locator("main")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.writes).toHaveLength(0);
  });
for (const mode of ["error", "denied", "inactive", "mismatch"])
  test(`profile ${mode} blocks the overview`, async ({ page }) => {
    const f = await workDisputeOverviewFixture(page);
    f.base.profileMode = mode;
    await page.goto(root);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    await expect(page.getByRole("link", { name: "Open dispute work queue" })).toHaveCount(
      0,
    );
  });
test("management destination follows current live capability and revocation", async ({
  page,
}) => {
  const f = await workDisputeOverviewFixture(page);
  f.grants = ["DISPUTE_MANAGE"];
  await page.goto(root);
  await expect(
    page.getByRole("link", { name: "Open dispute work queue" }),
  ).toHaveAttribute("href", root + "/work");
  f.grants = [];
  await page.reload();
  await expect(page.locator(".wd-record")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Open dispute work queue" })).toHaveCount(
    0,
  );
  expect(f.writes).toHaveLength(0);
});
test("disclosures preserve URL/reload and full provider facts without another queue read", async ({
  page,
}) => {
  const f = await workDisputeOverviewFixture(page);
  await page.goto(root);
  await expect(page.locator(".wd-record")).toHaveCount(4);
  const reads = f.reads.length;
  await page.locator(".wd-record").nth(1).getByRole("button").click();
  await expect(page).toHaveURL(new RegExp(`expanded=${id(220001)}`));
  await expect(page.locator(".wd-details:visible")).toContainText(
    "chargeback amount or resolution time is not confirmed",
  );
  await expect(page.locator(".wd-details:visible")).toContainText("10:00:37.123");
  expect(f.reads).toHaveLength(reads);
  expect(f.reads.every((u) => !u.searchParams.has("expanded"))).toBe(true);
  await page.reload();
  await expect(page.locator(".wd-details:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "Hide record details" }).click();
  await expect(page.locator(".wd-details:visible")).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("exact large disputed money is never struck through or confused with confirmed chargeback", async ({
  page,
}) => {
  await workDisputeOverviewFixture(page);
  await page.goto(root);
  const row = page.locator(".wd-record").nth(3);
  await expect(row.locator(".wd-money")).toContainText("92,233,720,368,547,758.07");
  await expect(row.locator(".wd-chargeback")).toContainText("50,000.00");
  expect(
    await row
      .locator(".wd-money strong")
      .evaluate((el) => getComputedStyle(el).textDecorationLine),
  ).toBe("none");
  await expect(
    page.locator(".wd-record").first().locator(".wd-chargeback"),
  ).toContainText("Not confirmed");
});
test("cursor, filters and previous navigation survive reload", async ({ page }) => {
  const f = await workDisputeOverviewFixture(page);
  f.records = Array.from({ length: 28 }, (_, n) => disputeOverviewRow(n));
  await page.goto(root);
  await expect(page.locator(".wd-record")).toHaveCount(25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".wd-record")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".wd-record")).toHaveCount(3);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".wd-record")).toHaveCount(25);
  await page.getByLabel("Dispute category").selectOption("FRAUD");
  await expect(page.locator(".wd-record")).toHaveCount(7);
  expect(new URL(page.url()).searchParams.has("cursor")).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Dispute category")).toHaveValue("FRAUD");
  expect(f.writes).toHaveLength(0);
});
test("invalid URL fetches no protected queue and resets explicitly", async ({ page }) => {
  const f = await workDisputeOverviewFixture(page);
  await page.goto(root + "?provider=PAYSTACK");
  await expect(page.locator("main").getByRole("alert")).toContainText("unsupported");
  expect(f.reads).toHaveLength(0);
  await page.getByRole("button", { name: "Reset dispute view" }).click();
  await expect(page.locator(".wd-record")).toHaveCount(4);
});
test("an expanded reference outside the page is not treated as a current lookup", async ({
  page,
}) => {
  const f = await workDisputeOverviewFixture(page);
  await page.goto(root + "?expanded=" + id(999));
  await expect(page.locator(".wd-outside")).toContainText("outside this result page");
  await expect(page.locator(".wd-details:visible")).toHaveCount(0);
  expect(f.reads.length).toBeGreaterThan(0);
  expect(
    f.reads.every(
      (u) =>
        u.pathname === "/api/v1/admin/operations/payment-disputes" &&
        !u.searchParams.has("expanded"),
    ),
  ).toBe(true);
});
for (const mode of ["error", "empty"])
  test(`queue ${mode} is explicit`, async ({ page }) => {
    const f = await workDisputeOverviewFixture(page);
    f.mode = mode;
    await page.goto(root);
    await expect(
      mode === "empty"
        ? page.getByRole("heading", { name: "No matching disputes" })
        : page.getByRole("button", { name: "Retry dispute overview" }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(0);
  });
test("temporary refresh failure preserves labelled earlier facts", async ({ page }) => {
  const f = await workDisputeOverviewFixture(page);
  await page.goto(root);
  await expect(page.locator(".wd-record")).toHaveCount(4);
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh payment disputes" }).click();
  await expect(
    page.getByText("Records below are from the previous successful load.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".wd-record")).toHaveCount(4);
  expect(f.writes).toHaveLength(0);
});
test("refresh denial clears protected records and management destination", async ({
  page,
}) => {
  const f = await workDisputeOverviewFixture(page);
  f.grants = ["DISPUTE_MANAGE"];
  await page.goto(root);
  await expect(page.locator(".wd-record")).toHaveCount(4);
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh payment disputes" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispute overview access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".wd-record")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open dispute work queue" })).toHaveCount(
    0,
  );
});
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`${width}px complete accessible dispute facts`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workDisputeOverviewFixture(page);
    await page.goto(root);
    await expect(page.locator(".wd-record")).toHaveCount(4);
    await page.locator(".wd-record").first().getByRole("button").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const scan = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      scan.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
    expect(f.writes).toHaveLength(0);
  });
