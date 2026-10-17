import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  creationValues,
  fillPromotionCreation,
  promotionCreateFixture,
  promotionCreationStorageKey,
} from "../fixtures/promotion-create";
import { bookingId } from "../fixtures/work-bookings";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function open(page: Page) {
  await page.goto("/admin/promotions/new", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Promotion settings", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await button(page, "Review promotion").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reviews all exact facts before one confirmed creation`, async ({
    page,
  }) => {
    const { state } = await promotionCreateFixture(page, role);
    await open(page);
    await expect(page).toHaveTitle(/Create promotion/);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await fillPromotionCreation(page);
    await review(page);
    expect(state.writes).toHaveLength(0);
    const facts = page.getByRole("dialog").locator(".totals");
    await expect(facts).toContainText("12.34%");
    await expect(facts).toContainText("99,999,999,999,999.99");
    await expect(facts).toContainText("37.123");
    await expect(facts).toContainText("Disabled");
    await button(page, "Go back").click();
    await expect(button(page, "Review promotion")).toBeFocused();
    await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue(
      creationValues().name,
    );
    await review(page);
    await button(page, "Create promotion").evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(
      page.getByRole("heading", { name: "Promotion created", exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].key).toMatch(/^promotion-v1\./);
    expect(state.writes[0].csrf.length).toBeGreaterThan(32);
    expect(state.writes[0].body).toMatchObject({
      code: "CARE12",
      isActive: false,
      percentageBasisPoints: 1234,
      maximumDiscountAmountKobo: "9999999999999999",
      startsAt: "2026-10-17T10:00:37.123+01:00",
    });
    await page.reload();
    await expect(
      page.getByRole("link", { name: "View created promotion" }),
    ).toHaveAttribute("href", `/admin/promotions/${bookingId(6100)}`);
    expect(state.writes).toHaveLength(1);
    await button(page, "Create another promotion").click();
    await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue("");
  });
test("cross-field validation and conditional discount clearing preserve a precise fixed offer", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  await open(page);
  await fillPromotionCreation(page);
  await page.getByLabel("Per-customer limit (optional)", { exact: true }).fill("21");
  await button(page, "Review promotion").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Per-customer limit (optional)", { exact: true }).fill("2");
  await page.getByLabel("Discount percentage", { exact: true }).fill("999");
  await button(page, "Review promotion").click();
  await expect(page.getByLabel("Discount percentage", { exact: true })).toBeFocused();
  await page.getByLabel("Discount type", { exact: true }).selectOption("FIXED_AMOUNT");
  await page.getByLabel("Fixed discount (NGN)", { exact: true }).fill("2500.01");
  await page.getByLabel("Redemption code (optional)", { exact: true }).fill("");
  await review(page);
  await expect(page.getByRole("dialog")).toContainText(
    "None; not redeemable by customers",
  );
  await button(page, "Create promotion").click();
  await expect(
    page.getByRole("heading", { name: "Promotion created", exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toMatchObject({
    fixedAmountKobo: "250001",
    percentageBasisPoints: null,
    code: null,
  });
});
test("a lost response survives reload and a read-only receipt check finds the committed record", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  state.mode = "lost";
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  await button(page, "Create promotion").click();
  await expect(button(page, "Retry same request")).toBeVisible();
  await button(page, "Close & review record").click();
  await page.reload();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.mode = "normal";
  await button(page, "Check saved promotion").click();
  await expect(
    page.getByRole("heading", { name: "Promotion created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await button(page, "Create another promotion").click();
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue("");
});
test("an absent receipt keeps creation locked and retries only the identical original request", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  state.mode = "error";
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  await button(page, "Create promotion").click();
  await button(page, "Close & review record").click();
  await page.reload();
  await button(page, "Check saved promotion").click();
  await expect(page.getByText(/No committed receipt is visible yet/)).toBeVisible();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.mode = "normal";
  await button(page, "Review original request").click();
  await expect(page.getByRole("dialog")).toContainText("Workshop essentials");
  await button(page, "Create promotion").click();
  await expect(
    page.getByRole("heading", { name: "Promotion created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test("a rejected retry cannot clear uncertainty from the original attempt", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  state.mode = "lost";
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  await button(page, "Create promotion").click();
  await expect(button(page, "Retry same request")).toBeVisible();
  state.mode = "reject";
  await button(page, "Retry same request").click();
  await expect(button(page, "Create promotion")).toBeDisabled();
  await button(page, "Go back").click();
  await page.reload();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].key).toBe(state.writes[0].key);
});
for (const mode of ["malformed", "mismatch", "408", "429"])
  test(`${mode} creation stays unconfirmed and recoverable`, async ({ page }) => {
    const { state } = await promotionCreateFixture(page);
    state.mode = mode;
    await open(page);
    await fillPromotionCreation(page);
    await review(page);
    await button(page, "Create promotion").click();
    await expect(button(page, "Retry same request")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Promotion created", exact: true }),
    ).toHaveCount(0);
    await button(page, "Close & review record").click();
    await page.reload();
    await expect(button(page, "Review promotion")).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });
test("a definite first rejection unlocks the preserved draft only after closing review", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  state.mode = "reject";
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  await button(page, "Create promotion").click();
  await expect(button(page, "Create promotion")).toBeDisabled();
  await button(page, "Go back").click();
  await expect(button(page, "Review promotion")).toBeEnabled();
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue(
    creationValues().name,
  );
  expect(state.writes).toHaveLength(1);
});
test("live role verification blocks a stale administrator before submission", async ({
  page,
}) => {
  const { state, base } = await promotionCreateFixture(page);
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  base.role = "STAFF";
  await button(page, "Create promotion").click();
  await expect(button(page, "Retry same request")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("corrupt and expired references never unlock a fresh creation", async ({ page }) => {
  const { state } = await promotionCreateFixture(page);
  await page.addInitScript(
    ({ key, owner, values }) =>
      sessionStorage.setItem(
        key,
        JSON.stringify({
          kind: "pending",
          owner,
          role: "ADMIN",
          values,
          key: `promotion-v1.${Date.now() - 86_401_000}.${crypto.randomUUID()}`,
        }),
      ),
    { key: promotionCreationStorageKey, owner: bookingId(302), values: creationValues() },
  );
  await open(page);
  await expect(button(page, "Review original request")).toBeDisabled();
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "broken"),
    promotionCreationStorageKey,
  );
  await page.goto("/admin/promotions");
  await page.goto("/admin/promotions/new");
  await expect(button(page, "Review promotion")).toBeDisabled();
});
test("receipt response binding and session invalidation preserve a locked redacted record", async ({
  page,
}) => {
  const { state } = await promotionCreateFixture(page);
  state.mode = "lost";
  await open(page);
  await fillPromotionCreation(page);
  await review(page);
  await button(page, "Create promotion").click();
  await button(page, "Close & review record").click();
  state.mode = "receiptMismatch";
  await button(page, "Check saved promotion").click();
  await expect(page.getByText(/saved promotion could not be confirmed/)).toBeVisible();
  await expect(button(page, "Review promotion")).toBeDisabled();
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(
    page.getByText("Your session changed. Verify your account to continue."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      promotionCreationStorageKey,
    ),
  ).toBe("pending");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("unavailable recovery storage prevents a new submission", async ({ page }) => {
  const { state } = await promotionCreateFixture(page);
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("aat:promotion-create:")) throw new DOMException("Unavailable");
      return get.call(this, key);
    };
  });
  await open(page);
  await expect(button(page, "Review promotion")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("responsive form and review remain accessible at all required widths", async ({
  page,
}) => {
  await promotionCreateFixture(page);
  await open(page);
  const captures = [];
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(button(page, "Review promotion")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const path = `C:/Users/PC/.codex/work-promotion-create-${width}.png`;
    await page.screenshot({ path, fullPage: true });
    captures.push(path);
  }
  await page.setViewportSize({ width: 430, height: 932 });
  await fillPromotionCreation(page);
  await review(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "C:/Users/PC/.codex/work-promotion-create-review.png",
    fullPage: true,
  });
  await button(page, "Go back").click();
});
