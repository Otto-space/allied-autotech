import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { Product } from "@/lib/api/commerce-schemas";

const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const category = (n: number) => ({
  id: id(100 + n),
  name:
    n === 1
      ? "Filters"
      : n === 2
        ? "Oils and fluids"
        : "External engine components and emission control systems with a deliberately long category name",
  slug: `qa-category-${n}`,
  description: null,
});
const product = (n: number): Product => ({
  id: id(n),
  name:
    n === 1
      ? "Engine oil — isolated QA example"
      : `Replacement filter — isolated QA example ${n}`,
  slug: `qa-product-${n}`,
  sku: `QA-${n}`,
  brand: "QA brand",
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "2850050",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: category(1),
  images: [
    {
      id: id(200 + n),
      url: `/api/v1/public/vehicles/images/${id(200 + n)}`,
      altText: "Isolated QA product image",
      isPrimary: true,
    },
  ],
  compatibilities: [],
  availability: [
    { branch: { id: id(300), code: "QA", name: "Isolated QA branch" }, inStock: n !== 2 },
  ],
});
const success = (data: unknown) => ({
  success: true,
  message: "Isolated Shop QA",
  data,
  meta: { requestId: "shop-qa" },
});
async function fixture(page: Page) {
  const state = {
    status: 200,
    empty: false,
    delay: 0,
    offline: false,
    categoryFailure: false,
    requests: [] as URL[],
  };
  await page.route("**/api/v1/public/vehicles/images/*", (route) =>
    route.fulfill({
      path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/public/catalog/categories/*", (route) =>
    route.fulfill({ json: success(category(3)) }),
  );
  await page.route("**/api/v1/public/catalog/categories?*", (route) => {
    if (state.categoryFailure)
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    const more = new URL(route.request().url()).searchParams.has("cursor");
    return route.fulfill({
      json: success({
        items: more ? [category(3)] : [category(1), category(2)],
        ...(!more ? { nextCursor: id(102) } : {}),
      }),
    });
  });
  await page.route("**/api/v1/public/catalog/products?*", async (route) => {
    state.requests.push(new URL(route.request().url()));
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.offline) return route.abort("internetdisconnected");
    if (state.status !== 200)
      return route.fulfill({
        status: state.status,
        headers: state.status === 429 ? { "Retry-After": "1" } : {},
        json: {
          success: false,
          error: { code: state.status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE" },
        },
      });
    const more = new URL(route.request().url()).searchParams.has("cursor");
    return route.fulfill({
      json: success({
        items: state.empty
          ? []
          : more
            ? [product(4)]
            : [product(1), product(2), product(3)],
        ...(!more && !state.empty ? { nextCursor: id(3) } : {}),
      }),
    });
  });
  await page.goto("/parts");
  await page.getByRole("searchbox", { name: "Search products" }).fill("QA");
  await expect(
    page.getByRole("status").filter({ hasText: "3 products on this page" }),
  ).toBeVisible();
  return state;
}

test("search debounces, keeps focus and survives URL history and reload", async ({
  page,
}) => {
  const state = await fixture(page);
  state.requests = [];
  const search = page.getByRole("searchbox", { name: "Search products" });
  await search.fill("Engine oil");
  await expect(page).toHaveURL(/search=Engine\+oil/);
  await expect(search).toBeFocused();
  await expect.poll(() => state.requests.length).toBe(1);
  await page.goBack();
  await expect(search).toHaveValue("QA");
  await page.goForward();
  await expect(search).toHaveValue("Engine oil");
  await page.reload();
  await expect(search).toHaveValue("Engine oil");
  await page.getByRole("button", { name: "Remove Search: Engine oil" }).click();
  await expect(search).toHaveValue("");
  await expect(page).not.toHaveURL(/search=/);
});

test("advanced fields validate and send only the supported contract", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Brand (exact name)").fill("QA brand");
  await page.getByLabel("Vehicle make (exact name)").fill("Toyota");
  await page.getByLabel("Vehicle model (exact name)").fill("Camry");
  await page.getByLabel("Year", { exact: true }).fill("2101");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByLabel("Year", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Year", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Year", { exact: true }).fill("2023");
  await page.getByLabel("Featured products").selectOption("false");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get("featured"))
    .toBe("false");
  expect(Object.fromEntries(state.requests.at(-1)!.searchParams)).toEqual({
    search: "QA",
    brand: "QA brand",
    make: "Toyota",
    model: "Camry",
    year: "2023",
    featured: "false",
    limit: "12",
  });
  await page.reload();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Brand (exact name)")).toHaveValue("QA brand");
  await page
    .getByRole("dialog", { name: "Filter products" })
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).not.toHaveURL(/brand=|search=|featured=/);
});

test("category keyboard search, retained selection, load-more failure and retry", async ({
  page,
}) => {
  const state = await fixture(page);
  const trigger = page.locator(".product-category-trigger");
  await trigger.click();
  const search = page.getByRole("combobox", { name: "Search loaded categories" });
  await expect(search).toBeFocused();
  await search.fill("Filters");
  await search.press("Enter");
  await expect(trigger).toContainText("Filters");
  await expect(trigger).toBeFocused();
  await trigger.click();
  state.categoryFailure = true;
  await page.getByRole("button", { name: "Load more categories" }).click();
  await expect(page.getByRole("button", { name: "Retry categories" })).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Filters", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  state.categoryFailure = false;
  await page.getByRole("button", { name: "Retry categories" }).click();
  await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
  await expect(page.getByRole("option", { name: "Filters", exact: true })).toBeVisible();
  await search.fill("nonexistent");
  await expect(
    page.getByText("No matching categories in the loaded list."),
  ).toBeVisible();
  await search.fill("External");
  await search.press("Enter");
  await expect(trigger).toContainText("External engine");
  await page.reload();
  await expect(trigger).toContainText("External engine");
  await expect(page.locator(".product-active-filters")).not.toContainText(id(103));
});

test("pagination preserves filters, restores Previous after reload and resets on sort", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/_trail=start/);
  await expect(page.locator(".product-pagination")).toContainText("Page 2");
  await expect.poll(() => state.requests.at(-1)?.searchParams.get("cursor")).toBe(id(3));
  expect(state.requests.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Sort by").selectOption("price_asc");
  await expect(page).not.toHaveURL(/cursor=|_trail=/);
  await expect(page).toHaveURL(/sort=price_asc/);
});

test("loading, empty, server, rate-limit and network errors remain recoverable", async ({
  page,
}) => {
  const state = await fixture(page);
  const search = page.getByRole("searchbox", { name: "Search products" });
  state.delay = 900;
  await search.fill("slow");
  await expect(page.locator(".product-skeleton").first()).toBeVisible();
  await expect(page.locator(".shop-product-card")).toHaveCount(3);
  state.delay = 0;
  state.empty = true;
  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No matching products" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No products are listed yet" }),
  ).toBeVisible();
  state.empty = false;
  for (const status of [503, 429, 0]) {
    state.status = status || 200;
    state.offline = status === 0;
    await search.fill(`error-${status}`);
    await expect(page.getByRole("button", { name: "Retry products" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No matching products" }),
    ).not.toBeVisible();
    state.status = 200;
    state.offline = false;
    await page.getByRole("button", { name: "Retry products" }).click();
    await expect(page.locator(".shop-product-card")).toHaveCount(3);
  }
});

for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`Shop visual, keyboard and accessibility gate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText("Shop");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `shop-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `shop-quality-${width}-full.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: /^Filters/ }).click();
    const panel = page.getByRole("dialog", { name: "Filter products" });
    await page.getByLabel("Brand (exact name)").fill("Retained draft");
    await page.screenshot({
      path: path.join(os.tmpdir(), `shop-quality-${width}-filters.png`),
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width < 768) {
      await page.getByRole("button", { name: "Apply filters" }).focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Close filters" })).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByLabel("Brand (exact name)")).toHaveValue("Retained draft");
    await page.getByRole("button", { name: "Close filters" }).click();
    await page.locator(".product-category-trigger").click();
    await expect(
      page.getByRole("combobox", { name: "Search loaded categories" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Load more categories" }).click();
    await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
    await expect(
      page.getByText("Search loaded categories", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("combobox", { name: "Search loaded categories" }),
    ).toBeInViewport();
    const popup = await page.locator(".product-category-popup").boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(0);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(width);
    expect(popup!.y).toBeGreaterThanOrEqual(0);
    expect(popup!.y + popup!.height).toBeLessThanOrEqual(960);
    await page.screenshot({
      path: path.join(os.tmpdir(), `shop-quality-${width}-category.png`),
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator(".product-category-trigger")).toBeFocused();
    expect(errors).toEqual([]);
  });

test("invalid shared filters are explained and raw cursors can return to the first page", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(`/parts?year=2101&featured=yes&categoryId=invalid&cursor=${id(3)}`);
  await expect(page.getByText(/Some filters in this link were invalid/)).toBeVisible();
  await expect(page.locator(".product-category-trigger")).toContainText("All categories");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=|year=|featured=|categoryId=/);
});

test("empty categories and initial category errors keep search and recovery available", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/public/catalog/categories?*", (route) =>
    route.fulfill({ json: success({ items: [] }) }),
  );
  await page.reload();
  await page.locator(".product-category-trigger").click();
  await expect(page.getByText("No categories are listed yet.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.route("**/api/v1/public/catalog/categories?*", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
    }),
  );
  await page.reload();
  await page.locator(".product-category-trigger").click();
  await expect(
    page.getByRole("button", { name: "Retry categories", exact: true }),
  ).toBeVisible();
  await page.route("**/api/v1/public/catalog/categories?*", (route) =>
    route.fulfill({ json: success({ items: [category(1)] }) }),
  );
  await page.getByRole("button", { name: "Retry categories", exact: true }).click();
  await expect(page.getByRole("option", { name: "Filters", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "Search products" }).fill("Recovered");
  await expect(page.locator(".shop-product-card")).toHaveCount(3);
});

test("native concept size and focused section evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await fixture(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(os.tmpdir(), "shop-quality-native-introduction.png"),
  });
  for (const [name, selector] of [
    ["inventory", ".product-inventory"],
    ["guidance", ".product-guidance"],
    ["contact", ".product-contact"],
  ]) {
    await page
      .locator(selector)
      .screenshot({ path: path.join(os.tmpdir(), `shop-quality-native-${name}.png`) });
  }
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page
    .locator(".product-filter-panel")
    .screenshot({ path: path.join(os.tmpdir(), "shop-quality-native-filters.png") });
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.locator(".product-category-trigger").click();
  await page.getByRole("button", { name: "Load more categories" }).click();
  await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
  await page
    .locator(".product-category-popup")
    .screenshot({ path: path.join(os.tmpdir(), "shop-quality-native-category.png") });
});

test("touch drawer fits a short mobile viewport", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 500 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await fixture(page);
  await page.getByRole("button", { name: /^Filters/ }).tap();
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeInViewport();
  await page.getByRole("button", { name: "Apply filters" }).tap();
  await expect(page).toHaveURL(/year=2020/);
  await context.close();
});

test("clear cancels an uncommitted search while only category is selected", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "Remove Search: QA" }).click();
  await page.locator(".product-category-trigger").click();
  await page.getByRole("combobox", { name: "Search loaded categories" }).fill("Filters");
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox", { name: "Search products" }).fill("pending search");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("");
  // Wait beyond the debounce interval to prove a cancelled timer cannot resurrect it.
  await page.waitForTimeout(650);
  await expect(page).not.toHaveURL(/search=|categoryId=/);
});

test("large category list keeps its search visible during keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await fixture(page);
  await page.route("**/api/v1/public/catalog/categories?*", (route) =>
    route.fulfill({
      json: success({
        items: Array.from({ length: 100 }, (_, index) => ({
          ...category(index + 1),
          name: `Category ${String(index + 1).padStart(3, "0")} with readable longer text`,
        })),
      }),
    }),
  );
  await page.reload();
  await page.locator(".product-category-trigger").click();
  const search = page.getByRole("combobox", { name: "Search loaded categories" });
  await page
    .getByRole("option", { name: "Category 100 with readable longer text", exact: true })
    .waitFor();
  await search.press("End");
  await expect(search).toBeInViewport();
  await expect(
    page.getByText("Search loaded categories", { exact: true }),
  ).toBeInViewport();
  await search.press("Enter");
  await expect(page.locator(".product-category-trigger")).toContainText("Category 100");
  await page.locator(".product-category-trigger").click();
  await search.press("Tab");
  await expect(page.getByRole("dialog", { name: "Choose a category" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
});

test("unavailable selected category shows a readable fallback and can recover", async ({
  page,
}) => {
  await fixture(page);
  let missing = true;
  await page.route("**/api/v1/public/catalog/categories/*", (route) =>
    missing
      ? route.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        })
      : route.fulfill({ json: success(category(3)) }),
  );
  await page.goto(`/parts?categoryId=${id(103)}`);
  await expect(page.locator(".product-category-trigger")).toContainText(
    "Category unavailable",
  );
  await expect(page.locator(".product-active-filters")).not.toContainText(id(103));
  await page.locator(".product-category-trigger").click();
  missing = false;
  await page
    .getByRole("button", { name: "Retry selected category", exact: true })
    .click();
  await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".product-category-trigger")).toContainText(
    "External engine",
  );
});
