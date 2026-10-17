import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workPromotionsFixture, bookingId } from "../fixtures/work-promotions";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const table = (page: Page) =>
  page.getByRole("table", { name: "Promotions", exact: true });
async function open(page: Page) {
  await page.goto("/admin/promotions", { waitUntil: "domcontentloaded" });
  await expect(table(page)).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} sees complete configuration facts without invented eligibility`, async ({
    page,
  }) => {
    const { state } = await workPromotionsFixture(page, role);
    await open(page);
    await expect(page).toHaveTitle(/Promotions/);
    await expect(
      page.getByRole("link", { name: "Create promotion", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No redemption code", { exact: true })).toBeVisible();
    await expect(page.locator(".wp-table time").first()).toContainText("37.100");
    await expect(page.locator(".wp-table time").first()).toContainText("Lagos time");
    expect(await page.locator(".wp-configuration").allTextContents()).toEqual([
      "Enabled",
      "Disabled",
      "Disabled",
    ]);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });
test("customer cannot fetch administrator promotion records", async ({ page }) => {
  const { state } = await workPromotionsFixture(page, "CUSTOMER");
  await page.goto("/admin/promotions");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(state.reads).toHaveLength(0);
});
test("search, configuration, type and paging persist through reload and history", async ({
  page,
}) => {
  await workPromotionsFixture(page);
  await open(page);
  await button(page, "Next").click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".wp-table tbody tr")).toHaveCount(2);
  await button(page, "Previous").click();
  await page.getByLabel("Search promotion name or code").fill("PARTS2500");
  await page.getByLabel("Configuration filter").selectOption("false");
  await page.getByLabel("Discount type", { exact: true }).selectOption("FIXED_AMOUNT");
  await button(page, "Apply filters").click();
  await expect(page).toHaveURL(
    /search=PARTS2500&isActive=false&discountType=FIXED_AMOUNT/,
  );
  await expect(page.locator(".wp-table tbody tr")).toHaveCount(1);
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search promotion name or code")).toHaveValue("PARTS2500");
  await expect(page.getByLabel("Discount type", { exact: true })).toHaveValue(
    "FIXED_AMOUNT",
  );
  await button(page, "Clear filters").first().click();
  await expect(page.locator(".wp-table tbody tr")).toHaveCount(3);
  await page.goBack();
  await expect(page.locator(".wp-table tbody tr")).toHaveCount(1);
});
test("literal percent/underscore searches retain exact fractional discounts", async ({
  page,
}) => {
  const { state } = await workPromotionsFixture(page);
  await open(page);
  await page.getByLabel("Search promotion name or code").fill("%_");
  await button(page, "Apply filters").click();
  await expect(page.locator(".wp-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".wp-discount")).toHaveText("12.34%");
  expect(state.reads.at(-1)?.searchParams.get("search")).toBe("%_");
});
for (const query of ["isActive=yes", "discountType=OTHER", "search=a&search=b"])
  test(`invalid filter ${query} blocks API reads`, async ({ page }) => {
    const { state } = await workPromotionsFixture(page);
    await page.goto(`/admin/promotions?${query}`);
    await expect(
      page.getByRole("heading", { name: "Promotion filters unavailable" }),
    ).toBeVisible();
    expect(state.reads).toHaveLength(0);
    await button(page, "Clear filters").click();
    await expect(table(page)).toBeVisible();
  });
for (const mode of ["empty", "error", "denied", "malformed", "duplicate", "mismatch"])
  test(`${mode} produces honest records and retry`, async ({ page }) => {
    const { state } = await workPromotionsFixture(page);
    state.mode = mode;
    await page.goto(`/admin/promotions${mode === "mismatch" ? "?isActive=true" : ""}`);
    if (mode === "empty")
      await expect(
        page.getByRole("heading", { name: "No promotions yet", exact: true }),
      ).toBeVisible();
    else {
      await expect(button(page, "Retry promotions")).toBeVisible();
      await expect(table(page)).toHaveCount(0);
      state.mode = "normal";
      await button(page, "Retry promotions").click();
      await expect(table(page)).toBeVisible();
    }
  });
test("temporary refresh failures retain blocked prior facts while denial clears them", async ({
  page,
}) => {
  const { state } = await workPromotionsFixture(page);
  await open(page);
  state.mode = "error";
  await button(page, "Refresh promotions").click();
  await expect(page.getByText(/Previously loaded promotions/)).toBeVisible();
  await expect(table(page)).toBeVisible();
  await expect(button(page, "Next")).toBeDisabled();
  state.mode = "denied";
  await button(page, "Retry promotions").click();
  await expect(table(page)).toHaveCount(0);
});
test("named promotion link opens the recorded promotion and browser back restores filters", async ({
  page,
}) => {
  const { state } = await workPromotionsFixture(page);
  await page.goto("/admin/promotions?search=CARE10");
  await page
    .getByRole("link", { name: "Manage Workshop essentials", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/promotions/${bookingId(6000)}$`));
  await expect(
    page.getByRole("heading", { name: "Workshop essentials", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Search promotion name or code")).toHaveValue("CARE10");
  expect(state.writes).toHaveLength(0);
});
test("loading stays distinct from an empty result", async ({ page }) => {
  const { state } = await workPromotionsFixture(page);
  state.mode = "hold";
  await page.goto("/admin/promotions");
  await expect(page.getByText("Checking promotions…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No promotions yet", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => typeof state.held).toBe("function");
  state.mode = "normal";
  state.held?.();
  await expect(table(page)).toBeVisible();
});
test("long names, codes, exact large amounts and mobile filters stay accessible", async ({
  page,
}) => {
  const { state } = await workPromotionsFixture(page);
  state.records[0].name = "Long promotion name ".repeat(8);
  state.records[0].code = "CODE".repeat(20);
  state.records[1].fixedAmountKobo = "9999999999999999";
  await open(page);
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      width < 768 &&
      (await button(page, "Filters").getAttribute("aria-expanded")) === "false"
    )
      await button(page, "Filters").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("link", { name: "Manage " + state.records[0].name, exact: true }),
  ).toBeVisible();
});
