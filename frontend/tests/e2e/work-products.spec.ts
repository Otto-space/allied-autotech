import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workProductsFixture,
  bookingId,
  productCategories,
} from "../fixtures/work-products";
const path = "/admin/products";
const review = (page: Page) =>
  page.getByRole("button", { name: "Review changes", exact: true });
const confirm = (page: Page) =>
  page.getByRole("button", { name: "Confirm save", exact: true });
async function fillCreate(page: Page) {
  await expect(page.getByLabel("Name", { exact: true })).toBeEnabled();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic oil filter");
  await page.getByLabel("URL name", { exact: true }).fill("synthetic-oil-filter");
  await page.getByLabel("SKU", { exact: true }).fill("qa-new-1");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(productCategories[0].id);
  await page.getByLabel("Condition (optional)", { exact: true }).selectOption("NEW");
  await page
    .getByLabel("Classification (optional)", { exact: true })
    .selectOption("AFTERMARKET");
  await page.getByLabel("Product type (optional)", { exact: true }).fill("OIL_FILTER");
  await page.getByLabel("Brand (optional)", { exact: true }).fill("Quality Parts");
  await page.getByLabel("Manufacturer part number (optional)").fill("OEM-123");
  await page.getByLabel("Description (optional)").fill("Product description.");
  await page.getByLabel("Selling price (NGN)", { exact: true }).fill("12345.67");
  await page.getByLabel("Comparison price (NGN, optional)").fill("13000");
  await page.getByLabel("Featured", { exact: true }).check();
}
test("catalogue pagination, URL filters, advanced fields and history survive reload", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(path);
  await expect(page.getByText("3 products on this page")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).last().click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Search products").fill("  QA-PART-0  ");
  await page.getByLabel("Visibility", { exact: true }).selectOption("true");
  await page.getByLabel("Featured", { exact: true }).selectOption("true");
  await page.getByLabel("Sort", { exact: true }).selectOption("price_desc");
  await page.getByText("More filters", { exact: true }).click();
  await page.getByLabel("Brand", { exact: true }).fill("Quality Parts");
  await page.getByLabel("Vehicle make", { exact: true }).fill("Toyota");
  await page.getByLabel("Vehicle model", { exact: true }).fill("Camry");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 product on this page")).toBeVisible();
  expect(Object.fromEntries(state.reads.at(-1)!.searchParams)).toEqual({
    limit: "25",
    search: "QA-PART-0",
    isActive: "true",
    featured: "true",
    sort: "price_desc",
    brand: "Quality Parts",
    make: "Toyota",
    model: "Camry",
    year: "2020",
  });
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("Vehicle model", { exact: true })).toHaveValue("Camry");
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
});
test("creation validates, reviews all eleven facts, cancels without writing and saves once", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?view=create`);
  await expect(review(page)).toBeEnabled();
  await review(page).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await fillCreate(page);
  await review(page).click();
  const dialog = page.getByRole("dialog");
  for (const text of [
    "Synthetic oil filter",
    "synthetic-oil-filter",
    "QA-NEW-1",
    "Braking",
    "Quality Parts",
    "OEM-123",
    "Product description.",
    "12,345.67",
    "13,000.00",
    "Featured",
    "Active",
  ])
    await expect(dialog).toContainText(text);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await expect(review(page)).toBeFocused();
  await review(page).click();
  await confirm(page).click();
  await expect(page.getByText("Product saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "POST",
    body: {
      sku: "QA-NEW-1",
      condition: "NEW",
      classification: "AFTERMARKET",
      productType: "OIL_FILTER",
      priceKobo: "1234567",
      compareAtPriceKobo: "1300000",
      featured: true,
      isActive: true,
    },
  });
  expect(state.writes[0].body).not.toHaveProperty("expectedUpdatedAt");
  expect(state.writes[0].csrf).toBeTruthy();
});
test("direct editing outside page one retains exact large money and submits the observed timestamp", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=${bookingId(1004)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Oil filter");
  await page.reload();
  await expect(page.getByLabel("Selling price (NGN)", { exact: true })).toHaveValue(
    "99999999999999.99",
  );
  await page.getByLabel("Active", { exact: true }).uncheck();
  await review(page).click();
  await confirm(page).click();
  await expect(page.getByText("Product saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes[0].body).toMatchObject({
    priceKobo: "9999999999999999",
    expectedUpdatedAt: "2026-10-13T08:00:00.000Z",
    isActive: false,
  });
});
test("a changed snapshot makes no write and requires explicit draft replacement", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=${bookingId(1000)}`);
  await page.getByLabel("Name", { exact: true }).fill("My product draft");
  await review(page).click();
  state.records[0].updatedAt = "2026-10-13T08:00:01.000Z";
  state.records[0].name = "Another administrator's product";
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("My product draft");
  await page
    .getByRole("button", { name: "Load latest product and replace this draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Another administrator's product",
  );
});
for (const outcome of ["uncertain", "uncommitted", "contradictory"])
  test(`${outcome} edit stays locked through reload and recovers by reading without replay`, async ({
    page,
  }) => {
    const { state } = await workProductsFixture(page);
    await page.goto(`${path}?edit=${bookingId(1000)}`);
    await page.getByLabel("Name", { exact: true }).fill("Reviewed new name");
    await review(page).click();
    state.outcome = outcome;
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await page.reload();
    await expect(review(page)).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Discard draft and reload saved product",
        exact: true,
      })
      .click();
    await expect(review(page)).toBeEnabled();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      outcome === "uncommitted" ? "Ceramic brake pads" : "Reviewed new name",
    );
    expect(state.writes).toHaveLength(1);
  });
test("uncertain creation survives reload and requires explicit manual reconciliation", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?view=create`);
  await fillCreate(page);
  await review(page).click();
  state.outcome = "uncertain";
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await page.reload();
  await expect(review(page)).toBeDisabled();
  await page.getByRole("button", { name: "Back to products", exact: true }).click();
  await expect(page.getByText("Synthetic oil filter", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(review(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "I checked the products; start a blank draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(review(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});
test("category paging preserves the selected name in the full review", async ({
  page,
}) => {
  await workProductsFixture(page);
  await page.goto(`${path}?view=create`);
  await fillCreate(page);
  await page
    .getByRole("navigation", { name: "Product category choices pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(productCategories[2].id);
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page
    .getByRole("navigation", { name: "Product category choices pages" })
    .getByRole("button", { name: "Previous" })
    .click();
  await review(page).click();
  await expect(page.getByRole("dialog")).toContainText("Filters (inactive)");
});
test("category availability failure retains draft and offers working choice recovery", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  state.categoriesMode = "error";
  await page.goto(`${path}?edit=${bookingId(1000)}`);
  await expect(
    page.getByText("Categories could not be loaded.", { exact: false }),
  ).toBeVisible();
  await expect(review(page)).toBeDisabled();
  state.categoriesMode = "normal";
  await page.getByRole("button", { name: "Retry categories" }).click();
  await expect(review(page)).toBeEnabled();
});

test("a category selected beyond the first choice page restores with the correct review name", async ({
  page,
}) => {
  await workProductsFixture(page);
  await page.goto(`${path}?view=create`);
  await fillCreate(page);
  await page
    .getByRole("navigation", { name: "Product category choices pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(productCategories[2].id);
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.reload();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    productCategories[2].id,
  );
  await expect(review(page)).toBeEnabled();
  await review(page).click();
  await expect(page.getByRole("dialog")).toContainText("Filters (inactive)");
});

test("a malformed refresh preserves the existing draft but blocks review until a valid read", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=${bookingId(1000)}`);
  await page.getByLabel("Name", { exact: true }).fill("Preserved product draft");
  state.detailMode = "malformed";
  await page.getByRole("button", { name: "Refresh product", exact: true }).click();
  await expect(review(page)).toBeDisabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Preserved product draft",
  );
  expect(state.writes).toHaveLength(0);
  state.detailMode = "normal";
  await page.getByRole("button", { name: "Refresh product", exact: true }).click();
  await expect(review(page)).toBeEnabled();
});
test("temporary product refresh failure preserves the draft and blocks writes", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=${bookingId(1000)}`);
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  state.detailMode = "error";
  await page.getByRole("button", { name: "Refresh product", exact: true }).click();
  await expect(review(page)).toBeDisabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  state.detailMode = "normal";
  await page.getByRole("button", { name: "Refresh product", exact: true }).click();
  await expect(review(page)).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["denied", "missing", "mismatch"])
  test(`${mode} direct response removes private fields and cannot save`, async ({
    page,
  }) => {
    const { state } = await workProductsFixture(page);
    await page.goto(`${path}?edit=${bookingId(1000)}`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Ceramic brake pads",
    );
    state.detailMode = mode;
    await page.getByRole("button", { name: "Refresh product", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });
test("invalid queries do not read records and can be cleared", async ({ page }) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=not-a-uuid&isActive=bad`);
  await expect(page.getByText(/filters are invalid/i)).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page.getByText("3 products on this page")).toBeVisible();
});
test("empty, failed and stale catalogue reads have distinct recovery", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  state.mode = "empty";
  await page.goto(path);
  await expect(page.getByText("No products found", { exact: true })).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "Refresh products", exact: true }).click();
  await expect(page.getByText("3 products on this page")).toBeVisible();
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/information may be out of date/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View & edit", exact: true }).first(),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry products" })).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry products" }).click();
  await expect(page.getByText("3 products on this page")).toBeVisible();
});
test("server business rejection keeps the draft without claiming success", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?edit=${bookingId(1000)}`);
  await page.getByLabel("Active", { exact: true }).uncheck();
  await review(page).click();
  state.outcome = "reserved";
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Active", { exact: true })).not.toBeChecked();
  await expect(page.getByText("Product saved.", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("staff is denied without catalogue reads", async ({ page }) => {
  const { state } = await workProductsFixture(page, "STAFF");
  await page.goto(path);
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  expect(state.reads).toHaveLength(0);
});
for (const width of [320, 390, 768, 1467])
  test(`catalogue and complete editor are accessible without overflow at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await workProductsFixture(page);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Products", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("3 products on this page")).toBeVisible();
    for (const view of ["list", "editor", "review"]) {
      if (view === "editor") {
        await page
          .getByRole("button", { name: "View & edit", exact: true })
          .first()
          .click();
        await expect(review(page)).toBeEnabled();
      }
      if (view === "review") await review(page).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

for (const width of [375, 430, 1440])
  test(`maximum-length product details and review fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { state } = await workProductsFixture(page);
    state.records[0].name = "P".repeat(180);
    state.records[0].sku = "S".repeat(80);
    state.records[0].description = "D".repeat(10000);
    await page.goto(path);
    await expect(page.getByText(state.records[0].name, { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "View & edit", exact: true }).first().click();
    await expect(review(page)).toBeEnabled();
    await review(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return (
          r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
        );
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(review(page)).toBeFocused();
    expect(state.writes).toHaveLength(0);
  });
