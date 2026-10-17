import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workServicesFixture, bookingId } from "../fixtures/work-services";

async function fillService(page: import("@playwright/test").Page) {
  await page.getByLabel("Name", { exact: true }).fill("Synthetic service");
  await page.getByLabel("URL name", { exact: true }).fill("synthetic-service");
  await page.getByLabel("Pricing", { exact: true }).last().selectOption("FIXED");
  await page
    .getByLabel("Service price (NGN) (optional)", { exact: true })
    .fill("1234.56");
  await page.getByLabel("Duration in minutes", { exact: true }).fill("45");
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeEnabled();
}
test("catalogue filters and paging survive reload and browser navigation", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await expect(page.getByText("3 services on this page")).toBeVisible();
  await expect(page.getByText("₦45,000.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("2 services on this page")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Search services").fill("  Brake  ");
  await page.getByLabel("Visibility", { exact: true }).selectOption("false");
  await page
    .getByLabel("Pricing", { exact: true })
    .first()
    .selectOption("QUOTE_REQUIRED");
  await page.getByLabel("Category", { exact: true }).selectOption(bookingId(802));
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 service on this page")).toBeVisible();
  const query = state.reads
    .filter((u) => u.pathname.endsWith("/services"))
    .at(-1)!.searchParams;
  expect(Object.fromEntries(query)).toEqual({
    limit: "25",
    search: "Brake",
    isActive: "false",
    pricingType: "QUOTE_REQUIRED",
    categoryId: bookingId(802),
  });
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 service on this page")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/services$/);
});
test("creation validates and reviews before exactly one authoritative write", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "Check the highlighted fields" }),
  ).toBeVisible();
  await fillService(page);
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("₦1,234.56");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic service");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Service saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    priceKobo: "123456",
    durationMinutes: 45,
    pricingType: "FIXED",
    categoryId: null,
    isActive: true,
  });
});
test("edits read directly and retain an unchanged inactive category", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await page
    .getByRole("row")
    .filter({ hasText: "Brake inspection" })
    .getByRole("button", { name: "View & edit" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Brake inspection");
  await expect(
    page.getByLabel("Service category (optional)", { exact: true }),
  ).toHaveValue(bookingId(802));
  await page.getByLabel("Duration in minutes").fill("75");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Service saved.", { exact: true }).first()).toBeVisible();
  expect(
    state.reads.filter((u) => u.pathname.endsWith(bookingId(902))).length,
  ).toBeGreaterThanOrEqual(2);
  expect(state.writes[0].body).toMatchObject({ expectedVersion: 1, durationMinutes: 75 });
  expect(state.writes[0].body).not.toHaveProperty("categoryId");
});
test("a changed review rejects before PATCH and keeps the draft for reconciliation", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await page
    .getByRole("row")
    .filter({ hasText: "Engine servicing" })
    .getByRole("button", { name: "View & edit" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Engine servicing");
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  state.records[1].version++;
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm save", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  await page
    .getByRole("button", { name: "Load latest service and replace this draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Engine servicing");
});
test("uncertain creation stays locked through reload and starts only an explicit blank draft", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  state.outcome = "uncertain";
  await page.goto("/admin/services");
  await fillService(page);
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close & review record" })).toBeVisible();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page
    .getByRole("button", { name: "I checked the catalogue; start a blank draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});
test("an uncommitted uncertain edit recovers from an explicit fresh read without replay", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  state.outcome = "uncommitted";
  await page.goto("/admin/services");
  const openEditor = () =>
    page
      .getByRole("row")
      .filter({ hasText: "Engine servicing" })
      .getByRole("button", { name: "View & edit" })
      .click();
  await openEditor();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Engine servicing");
  await page.getByLabel("Name", { exact: true }).fill("Unconfirmed change");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.reload();
  await openEditor();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  const reads = state.reads.length;
  await page
    .getByRole("button", { name: "Discard draft and reload saved service" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Engine servicing");
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeEnabled();
  expect(state.reads.length).toBeGreaterThan(reads);
  expect(state.writes).toHaveLength(1);
  expect(state.records[1].name).toBe("Engine servicing");
});
for (const mode of ["error", "denied", "malformed"])
  test(`catalogue ${mode} fails closed and retries`, async ({ page }) => {
    const { state } = await workServicesFixture(page);
    state.mode = mode;
    await page.goto("/admin/services");
    await expect(
      page.getByRole("heading", { name: "Services unavailable" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "View & edit" })).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("3 services on this page")).toBeVisible();
  });
test("background failure keeps the draft while blocking mutations", async ({ page }) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await fillService(page);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Services may be out of date. Refresh before making changes."),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic service");
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  state.mode = "normal";
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic service");
});
test("detail identity mismatch and category failures block editing", async ({ page }) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  state.detailMode = "mismatch";
  await page
    .getByRole("row")
    .filter({ hasText: "Engine servicing" })
    .getByRole("button", { name: "View & edit" })
    .click();
  await expect(
    page.getByText(
      "The returned service does not match your selection. Refresh before editing.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toHaveCount(0);
  state.detailMode = "normal";
  state.categoryMode = "error";
  await page.getByRole("button", { name: "Refresh service", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  state.categoryMode = "normal";
  await page.getByRole("button", { name: "Retry categories" }).last().click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeEnabled();
});
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} cannot fetch the catalogue`, async ({ page }) => {
    const { state } = await workServicesFixture(page, role);
    await page.goto("/admin/services");
    if (role === "CUSTOMER") await expect(page).toHaveURL(/\/dashboard$/);
    else
      await expect(
        page.getByText("Administrator access is required to manage these records."),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review changes", exact: true }),
    ).toHaveCount(0);
    expect(state.reads).toHaveLength(0);
  });
test("super administrator can manage images and return to catalogue", async ({
  page,
}) => {
  await workServicesFixture(page, "SUPER_ADMIN");
  await page.goto("/admin/services");
  await page
    .getByRole("row")
    .filter({ hasText: "Comprehensive diagnostics" })
    .getByRole("button", { name: "Manage image" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Image for Comprehensive diagnostics" }),
  ).toBeVisible();
  await expect(page.getByText("No service image yet.")).toBeVisible();
  await page.getByRole("button", { name: "Close image editor" }).click();
  await expect(page.getByText("3 services on this page")).toBeVisible();
});
test("image read failures block uploads and catalogue access loss hides the workspace", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services");
  await page.getByRole("button", { name: "Manage image", exact: true }).first().click();
  await expect(page.getByLabel("Choose a service image", { exact: true })).toBeEnabled();
  state.detailMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("This image may be out of date. Refresh before making changes."),
  ).toBeVisible();
  await expect(page.getByLabel("Choose a service image", { exact: true })).toBeDisabled();
  state.detailMode = "normal";
  await page.getByRole("button", { name: "Refresh image", exact: true }).click();
  await expect(page.getByLabel("Choose a service image", { exact: true })).toBeEnabled();
  state.mode = "denied";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Services unavailable" })).toBeVisible();
  await expect(page.getByLabel("Choose a service image", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Image for/ })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("invalid URLs issue no catalogue reads and can be cleared", async ({ page }) => {
  const { state } = await workServicesFixture(page);
  await page.goto("/admin/services?search=x&cursor=invalid");
  await expect(
    page.getByText(
      "Some service filters are invalid. Correct them or clear filters to continue.",
    ),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByText("3 services on this page")).toBeVisible();
});
for (const width of [320, 390, 768, 1505])
  test(`accessible complete records at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1045 });
    await workServicesFixture(page);
    await page.goto("/admin/services");
    await expect(page.getByText("3 services on this page")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review changes", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    for (const button of await page
      .getByRole("button", { name: "Manage image", exact: true })
      .all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
