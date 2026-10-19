import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  promotionDetailFixture,
  promotionDetailId,
  promotionEditStorageKey,
} from "../fixtures/promotion-detail";
const path = `/admin/promotions/${promotionDetailId}`,
  button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const nameField = (p: Page) => p.getByLabel("Promotion name", { exact: true });
async function open(p: Page) {
  await p.goto(path, { waitUntil: "domcontentloaded" });
  await expect(
    p.getByRole("heading", { name: "Offer configuration", exact: true }),
  ).toBeVisible();
}
async function review(p: Page) {
  await button(p, "Review promotion").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads the named direct record and all factual configuration`, async ({
    page,
  }) => {
    const { state } = await promotionDetailFixture(page, role);
    await open(page);
    await expect(page).toHaveTitle(/Promotion details/);
    await expect(
      page.getByRole("heading", { level: 1, name: state.record.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
      state.record.name,
    );
    await expect(page.locator(".pd-schedule")).toContainText("37.100");
    await expect(page.locator(".pd-metadata")).toContainText(promotionDetailId);
    await expect(page.locator(".pd-overview")).toContainText("10.00%");
    await expect(page.locator(".pd-configuration")).toHaveText("Enabled");
    await expect(page.locator(".pc-guidance")).toContainText(
      "Redemption counts and remaining uses are not available",
    );
    expect(state.reads).toEqual([`/api/v1/admin/promotions/${promotionDetailId}`]);
    expect(state.writes).toHaveLength(0);
    await button(page, "Edit settings").click();
    await expect(
      page.getByRole("heading", { name: "Edit promotion", exact: true }),
    ).toBeFocused();
    await page.getByRole("link", { name: "Back to promotions", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/promotions$/);
  });
test("staff cannot fetch or edit administrator promotion detail", async ({ page }) => {
  const { state } = await promotionDetailFixture(page, "STAFF");
  await page.goto(path);
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  expect(state.reads).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
});
test("customer is redirected without a promotion read", async ({ page }) => {
  const { state } = await promotionDetailFixture(page, "CUSTOMER");
  await page.goto(path);
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(state.reads).toHaveLength(0);
});
test("invalid identifiers stop before any promotion request", async ({ page }) => {
  const { state } = await promotionDetailFixture(page);
  await page.goto("/admin/promotions/not-a-uuid");
  expect(state.reads).toHaveLength(0);
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveCount(0);
});
for (const mode of ["error", "denied", "missing", "malformed", "mismatch"])
  test(`${mode} reads show no unverified facts or editor`, async ({ page }) => {
    const { state } = await promotionDetailFixture(page);
    state.mode = mode;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Promotion unavailable", exact: true }),
    ).toBeVisible();
    await expect(nameField(page)).toHaveCount(0);
    await expect(button(page, "Edit settings")).toBeDisabled();
    expect(state.writes).toHaveLength(0);
    state.mode = "normal";
    await button(page, "Retry promotion").click();
    await expect(nameField(page)).toBeVisible();
  });
test("review/cancel and one versioned edit preserve exact values and Lagos milliseconds", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  await open(page);
  await nameField(page).fill("Reviewed workshop offer");
  await page.getByLabel("Discount type", { exact: true }).selectOption("FIXED_AMOUNT");
  await page.getByLabel("Fixed discount (NGN)", { exact: true }).fill("2500.01");
  await page.getByLabel("Redemption code (optional)", { exact: true }).fill("");
  await page.getByLabel("Discount cap (NGN, optional)", { exact: true }).fill("0");
  await page.getByLabel("Total usage limit (optional)", { exact: true }).fill("");
  await page.getByLabel("Per-customer limit (optional)", { exact: true }).fill("");
  await review(page);
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toContainText(
    "None; not redeemable by customers",
  );
  await page.keyboard.press("Escape");
  await expect(button(page, "Review promotion")).toBeFocused();
  await expect(nameField(page)).toHaveValue("Reviewed workshop offer");
  await review(page);
  await button(page, "Confirm change").evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(
    page.getByText("Promotion changes confirmed.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].method).toBe("PATCH");
  expect(state.writes[0].csrf.length).toBeGreaterThan(32);
  expect(state.writes[0].body).toMatchObject({
    expectedVersion: 0,
    code: null,
    discountType: "FIXED_AMOUNT",
    fixedAmountKobo: "250001",
    percentageBasisPoints: null,
    maximumDiscountAmountKobo: "0",
    usageLimit: null,
    perCustomerLimit: null,
    startsAt: "2026-10-17T09:00:37.100Z",
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Reviewed workshop offer", exact: true }),
  ).toBeVisible();
  await expect(button(page, "Review promotion")).toBeEnabled();
  expect(state.reads).toHaveLength(2); // direct page + fresh write preflight; response updates the overview.
});
test("a changed preflight blocks PATCH and preserves the draft until explicit reload", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  await open(page);
  await nameField(page).fill("Preserved local draft");
  await review(page);
  state.record = { ...state.record, name: "Changed remotely", version: 1 };
  await button(page, "Confirm change").click();
  await expect(button(page, "Confirm change")).toBeDisabled();
  await button(page, "Go back").click();
  expect(state.writes).toHaveLength(0);
  await expect(nameField(page)).toHaveValue("Preserved local draft");
  await button(page, "Reload promotion editor").click();
  await expect(nameField(page)).toHaveValue("Changed remotely");
  await expect(button(page, "Review promotion")).toBeEnabled();
});
test("a stale PATCH rejection preserves the draft and reloads fresh current settings", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  state.writeMode = "stale";
  await open(page);
  await nameField(page).fill("Preserved draft");
  await review(page);
  await button(page, "Confirm change").click();
  await button(page, "Go back").click();
  await expect(nameField(page)).toHaveValue("Preserved draft");
  await expect(button(page, "Review promotion")).toBeDisabled();
  await button(page, "Reload promotion editor").click();
  await expect(nameField(page)).toHaveValue("Changed by another administrator");
  expect(state.writes).toHaveLength(1);
});
for (const mode of ["lost", "error", "malformed", "mismatch", "wrongId", "408", "429"])
  test(`${mode} update stays locked through reload and explicit recovery never PATCHes`, async ({
    page,
  }) => {
    const { state } = await promotionDetailFixture(page);
    state.writeMode = mode;
    await open(page);
    await nameField(page).fill("Uncertain change");
    await review(page);
    await button(page, "Confirm change").click();
    await expect(button(page, "Confirm change")).toBeDisabled();
    await button(page, "Close & review record").click();
    await page.reload();
    await expect(button(page, "Review promotion")).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    await button(page, "Load current settings").click();
    await expect(button(page, "Review promotion")).toBeEnabled();
    await expect(page.getByText(/previous save outcome is not proven/)).toBeVisible();
    expect(state.writes).toHaveLength(1);
    await expect(nameField(page)).toHaveValue(state.record.name);
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), promotionEditStorageKey),
    ).toBeNull();
  });
test("a definite first rejection releases only its pending marker", async ({ page }) => {
  const { state } = await promotionDetailFixture(page);
  state.writeMode = "reject";
  await open(page);
  await nameField(page).fill("Rejected draft");
  await review(page);
  await button(page, "Confirm change").click();
  await button(page, "Go back").click();
  await expect(button(page, "Review promotion")).toBeEnabled();
  await expect(nameField(page)).toHaveValue("Rejected draft");
  expect(state.writes).toHaveLength(1);
});
test("live role changes block the update and remove private facts after denial", async ({
  page,
}) => {
  const { state, base } = await promotionDetailFixture(page);
  await open(page);
  await review(page);
  base.role = "STAFF";
  state.mode = "denied";
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Promotion unavailable", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(
    page.getByRole("heading", { level: 1, name: state.record.name, exact: true }),
  ).toHaveCount(0);
});
test("temporary refresh retains a disabled draft; denied refresh removes it", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  await open(page);
  await nameField(page).fill("Retained refresh draft");
  state.mode = "error";
  await button(page, "Refresh promotion").click();
  await expect(page.getByText(/Previously loaded settings/)).toBeVisible();
  await expect(nameField(page)).toHaveValue("Retained refresh draft");
  await expect(button(page, "Review promotion")).toBeDisabled();
  state.mode = "normal";
  await button(page, "Refresh promotion").click();
  await expect(button(page, "Review promotion")).toBeEnabled();
  await expect(nameField(page)).toHaveValue("Retained refresh draft");
  state.mode = "denied";
  await button(page, "Refresh promotion").click();
  await expect(nameField(page)).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("late refresh data cannot replace a newer confirmed write", async ({ page }) => {
  const { state } = await promotionDetailFixture(page);
  await open(page);
  await nameField(page).fill("Confirmed newer version");
  await review(page);
  state.mode = "hold";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => !!state.held).toBe(true);
  state.mode = "normal";
  await button(page, "Confirm change").click();
  await expect(
    page.getByText("Promotion changes confirmed.", { exact: true }),
  ).toBeVisible();
  state.held?.();
  await expect(button(page, "Review promotion")).toBeEnabled();
  await expect(
    page.getByRole("heading", { level: 1, name: "Confirmed newer version", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("busy confirmation cannot be escaped or submitted twice", async ({ page }) => {
  const { state } = await promotionDetailFixture(page);
  state.writeMode = "hold";
  await open(page);
  await review(page);
  await button(page, "Confirm change").click();
  await expect.poll(() => !!state.held).toBe(true);
  await expect(button(page, "Submitting…")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toHaveLength(1);
  state.writeMode = "normal";
  state.held?.();
  await expect(
    page.getByText("Promotion changes confirmed.", { exact: true }),
  ).toBeVisible();
});
test("corrupt and unavailable pending storage fail closed", async ({ page }) => {
  const { state } = await promotionDetailFixture(page);
  await page.addInitScript(
    (key) => sessionStorage.setItem(key, "broken"),
    promotionEditStorageKey,
  );
  await open(page);
  await expect(button(page, "Review promotion")).toBeDisabled();
  await page.evaluate(() => {
    Storage.prototype.removeItem = function () {
      throw new DOMException("Unavailable");
    };
  });
  await button(page, "Load current settings").click();
  await expect(page.getByText(/could not be loaded safely/)).toBeVisible();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("session invalidation closes review and discards private form values", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  await open(page);
  await nameField(page).fill("Unsaved private draft");
  await review(page);
  await page.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage("changed");
    c.close();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(nameField(page)).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("long names, full codes and exact extreme amounts remain readable without overflow", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  state.record = {
    ...state.record,
    name: "Promotion " + "X".repeat(150),
    code: "C".repeat(80),
    description: "Long saved description ".repeat(80),
    maximumDiscountAmountKobo: "9999999999999999",
  };
  await open(page);
  for (const width of [320, 430, 1440]) {
    await page.setViewportSize({ width, height: 1050 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: state.record.name, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".pd-facts")).toContainText(state.record.code!);
    await expect(page.locator(".pd-facts")).toContainText("99,999,999,999,999.99");
  }
});
test("an older recovery read cannot release a newer pending version", async ({
  page,
}) => {
  const { state } = await promotionDetailFixture(page);
  await page.addInitScript(
    (key) => sessionStorage.setItem(key, '{"version":9}'),
    promotionEditStorageKey,
  );
  await open(page);
  await button(page, "Load current settings").click();
  await expect(page.getByText(/could not be loaded safely/)).toBeVisible();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("responsive overview, grouped form and review pass required widths and accessibility", async ({
  page,
}) => {
  await promotionDetailFixture(page);
  await open(page);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1050 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `C:/Users/PC/.codex/work-promotion-detail-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 430, height: 932 });
  await review(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "C:/Users/PC/.codex/work-promotion-detail-review.png",
    fullPage: false,
  });
  await button(page, "Go back").click();
});
