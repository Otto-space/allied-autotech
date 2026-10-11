import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { Product } from "@/lib/api/commerce-schemas";

const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cursor = "A".repeat(120) + "_" + "a".repeat(64);
const categoryOption = (n: number) => ({
  value: category(n).id,
  label: category(n).name,
});
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
      url: `/api/v1/public/catalog/products/images/${id(200 + n)}`,
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
    emptyTail: false,
    delay: 0,
    offline: false,
    categoryFailure: false,
    optionFailure: false,
    optionRequests: [] as URL[],
    requests: [] as URL[],
    items: [product(1), product(2), product(3)],
  };
  await page.route("**/api/v1/public/catalog/products/images/*", (route) =>
    route.fulfill({
      path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/public/catalog/categories/*", (route) =>
    route.fulfill({ json: success(category(3)) }),
  );
  await page.route("**/api/v1/public/catalog/facets?*", (route) => {
    const url = new URL(route.request().url());
    state.optionRequests.push(url);
    const field = url.searchParams.get("field");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const more = url.searchParams.has("cursor");
    if (field === "category" ? state.categoryFailure : state.optionFailure)
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    if (field !== "category") {
      const names =
        field === "brand"
          ? ["QA brand", "Other brand"]
          : field === "make"
            ? ["Honda", "Toyota"]
            : url.searchParams.get("make") === "Toyota"
              ? ["Camry", "Corolla"]
              : ["Accord"];
      const matching = names.filter((name) => name.toLowerCase().startsWith(search));
      return route.fulfill({
        json: success({
          items: (search
            ? matching
            : more
              ? matching.slice(1)
              : matching.slice(0, 1)
          ).map((label) => ({ value: label.toLowerCase(), label })),
          ...(!search && !more && matching.length > 1 ? { nextCursor: cursor } : {}),
        }),
      });
    }
    const options = search
      ? [1, 2, 3].filter((n) => category(n).name.toLowerCase().startsWith(search))
      : more
        ? [3]
        : [1, 2];
    return route.fulfill({
      json: success({
        items: options.map(categoryOption),
        ...(!more && !search ? { nextCursor: cursor } : {}),
      }),
    });
  });
  await page.route("**/api/v1/public/catalog/products/discovery?*", async (route) => {
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
        items:
          state.empty || (more && state.emptyTail)
            ? []
            : more
              ? [product(4)]
              : state.items,
        totalMatches: state.empty ? 0 : 4,
        ...(!more && !state.empty ? { nextCursor: cursor } : {}),
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

test("server totals, price range and stock filters survive reload and reject reversed prices", async ({
  page,
}) => {
  const state = await fixture(page);
  await expect(page.locator(".product-inventory-heading")).toContainText(
    "4 matching products · 3 products on this page",
  );
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Minimum price (NGN)").fill("100");
  await page.getByLabel("Maximum price (NGN)").fill("99");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByLabel("Maximum price (NGN)")).toBeFocused();
  await page.getByLabel("Minimum price (NGN)").fill("0");
  await page.getByLabel("Maximum price (NGN)").fill("100.25");
  await page.getByLabel("Availability", { exact: true }).selectOption("in_stock");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get("maxPriceKobo"))
    .toBe("10025");
  expect(state.requests.at(-1)?.searchParams.get("minPriceKobo")).toBe("0");
  expect(state.requests.at(-1)?.searchParams.get("availability")).toBe("in_stock");
  await page.reload();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Maximum price (NGN)")).toHaveValue("100.25");
  await expect(page.getByLabel("Availability", { exact: true })).toHaveValue("in_stock");
  await page.getByRole("button", { name: "Close filters" }).click();
  // Browser routes do not intercept the production server's reload seed.
  // Sorting initiates a client read while retaining the restored filters.
  await page.getByLabel("Sort by").selectOption("name");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".product-inventory-heading")).toContainText(
    "4 matching products · 1 product on this page",
  );
});

test("global category search finds an unloaded category and name options page, scope and retry", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.locator(".product-category-trigger").click();
  await page.getByRole("combobox", { name: "Search categories" }).fill("External");
  await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
  expect(
    state.optionRequests.some(
      (url) =>
        url.searchParams.get("field") === "category" &&
        url.searchParams.get("search") === "External",
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.locator("#product-filter-brand-options option")).toHaveAttribute(
    "value",
    "QA brand",
  );
  await page.getByRole("button", { name: "More brand options" }).click();
  await expect(page.locator("#product-filter-brand-options option")).toHaveAttribute(
    "value",
    "Other brand",
  );
  await page.getByLabel("Vehicle make (exact name)").fill("Toyota");
  await expect(page.locator("#product-filter-model-options option")).toHaveAttribute(
    "value",
    "Camry",
  );
  await page.getByLabel("Vehicle model (exact name)").fill("Camry");
  await page.getByLabel("Vehicle make (exact name)").fill("Honda");
  await expect(page.getByLabel("Vehicle model (exact name)")).toHaveValue("");
  await expect(page.locator("#product-filter-model-options option")).toHaveAttribute(
    "value",
    "Accord",
  );
  state.optionFailure = true;
  await page.getByLabel("Brand (exact name)").fill("QA");
  await expect(
    page.getByRole("button", { name: "Retry brand suggestions" }),
  ).toBeVisible();
  await expect(page.getByLabel("Brand (exact name)")).toHaveValue("QA");
  state.optionFailure = false;
  await page.getByRole("button", { name: "Retry brand suggestions" }).click();
  await expect(page.locator("#product-filter-brand-options option")).toHaveAttribute(
    "value",
    "QA brand",
  );
});

test("an emptied later page returns to the first page without losing filters", async ({
  page,
}) => {
  const state = await fixture(page);
  state.emptyTail = true;
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No products on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to first page" }).click();
  await expect(page).toHaveURL(/search=QA/);
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.locator(".shop-product-card")).toHaveCount(3);
});

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
  const search = page.getByRole("combobox", { name: "Search categories" });
  await expect(search).toBeFocused();
  await search.fill("Filters");
  await expect(page.getByRole("option", { name: "Filters", exact: true })).toBeVisible();
  await search.press("Enter");
  await expect(trigger).toContainText("Filters");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("button", { name: "Load more categories" })).toBeVisible();
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
  await expect(page.getByText("No matching categories.")).toBeVisible();
  await search.fill("External");
  await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
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
  await expect.poll(() => state.requests.at(-1)?.searchParams.get("cursor")).toBe(cursor);
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

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
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
    await expect(page.getByRole("combobox", { name: "Search categories" })).toBeFocused();
    await page.getByRole("button", { name: "Load more categories" }).click();
    await expect(page.getByRole("option", { name: /External engine/ })).toBeVisible();
    await expect(page.getByText("Search categories", { exact: true })).toBeInViewport();
    await expect(
      page.getByRole("combobox", { name: "Search categories" }),
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
  await page.route("**/api/v1/public/catalog/facets?*", (route) =>
    route.fulfill({ json: success({ items: [] }) }),
  );
  await page.reload();
  await page.locator(".product-category-trigger").click();
  await expect(page.getByText("No categories are listed yet.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.route("**/api/v1/public/catalog/facets?*", (route) =>
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
  await page.route("**/api/v1/public/catalog/facets?*", (route) =>
    route.fulfill({ json: success({ items: [categoryOption(1)] }) }),
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
  await page.getByRole("combobox", { name: "Search categories" }).fill("Filters");
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox", { name: "Search products" }).fill("pending search");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("");
  // Wait beyond the debounce interval to prove a cancelled timer cannot resurrect it.
  await page.waitForTimeout(650);
  await expect(page).not.toHaveURL(/search=|categoryId=/);
});

test("shared filter URLs take precedence over stale general form drafts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'aat:form-draft:v1:["guest","/parts","product-filters:1"]',
      JSON.stringify({ "product-search:0": "Stale saved search" }),
    );
    sessionStorage.setItem(
      'aat:form-draft:v1:["guest","/parts","product-filters:2"]',
      JSON.stringify({
        "product-filter-brand:0": "Stale brand",
        "product-filter-year:0": "1999",
      }),
    );
  });
  await fixture(page);
  await page.goto("/parts?search=Shared&brand=Current&year=2024");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue(
    "Shared",
  );
  await expect(page.getByLabel("Brand (exact name)")).toHaveValue("Current");
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue("2024");
  await page.waitForTimeout(650);
  await expect(page).toHaveURL(/search=Shared&brand=Current&year=2024/);
  await page
    .getByRole("dialog", { name: "Filter products" })
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Brand (exact name)")).toHaveValue("");
});

test("large category list keeps its search visible during keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await fixture(page);
  await page.route("**/api/v1/public/catalog/facets?*", (route) => {
    const token = new URL(route.request().url()).searchParams.get("cursor") ?? "";
    const pageNumber = token ? Number(token.slice(-1)) : 0;
    return route.fulfill({
      json: success({
        items: Array.from({ length: 20 }, (_, index) => ({
          value: category(pageNumber * 20 + index + 1).id,
          label: `Category ${String(pageNumber * 20 + index + 1).padStart(3, "0")} with readable longer text`,
        })),
        ...(pageNumber < 4
          ? { nextCursor: "b".repeat(100) + String(pageNumber + 1) }
          : {}),
      }),
    });
  });
  await page.route("**/api/v1/public/catalog/categories/*", (route) =>
    route.fulfill({
      json: success({ ...category(100), name: "Category 100 with readable longer text" }),
    }),
  );
  await page.reload();
  await page.locator(".product-category-trigger").click();
  const search = page.getByRole("combobox", { name: "Search categories" });
  for (let i = 1; i <= 4; i++) {
    await expect(
      page.getByRole("option", {
        name: `Category ${String(i * 20).padStart(3, "0")} with readable longer text`,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Load more categories" }).click();
  }

  await page
    .getByRole("option", { name: "Category 100 with readable longer text", exact: true })
    .waitFor();
  await search.press("End");
  await expect(search).toBeInViewport();
  await expect(page.getByText("Search categories", { exact: true })).toBeInViewport();
  await search.press("Enter");
  await expect(page.locator(".product-category-trigger")).toContainText("Category 100");
  await page.locator(".product-category-trigger").click();
  await search.press("Tab");
  await expect(page.getByRole("dialog", { name: "Choose a category" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
});

test("category shortcuts preserve search and sort, clear only category and follow history", async ({
  page,
}) => {
  const state = await fixture(page);
  const shortcuts = page.getByRole("group", { name: "Category shortcuts" });
  await page.getByLabel("Sort by").selectOption("price_asc");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/cursor=/);
  await shortcuts
    .getByRole("button", { name: "Category: Oils and fluids", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`categoryId=${id(102)}`));
  await expect(page).not.toHaveURL(/cursor=|_trail=/);
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get("categoryId"))
    .toBe(id(102));
  expect(state.requests.at(-1)?.searchParams.get("search")).toBe("QA");
  expect(state.requests.at(-1)?.searchParams.get("sort")).toBe("price_asc");
  await shortcuts.getByRole("button", { name: "Category: Filters", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`categoryId=${id(101)}`));
  await page.goBack();
  await expect(
    shortcuts.getByRole("button", { name: "Category: Oils and fluids", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await shortcuts.getByRole("button", { name: "All product categories" }).click();
  await expect(page).not.toHaveURL(/categoryId=/);
  await expect(page).toHaveURL(/search=QA/);
  await expect(page).toHaveURL(/sort=price_asc/);
});

test("product cards distinguish real comparison prices, compatibility and missing data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 960 });
  const state = await fixture(page);
  const first = product(1),
    second = product(2),
    third = product(3),
    fourth = product(4);
  first.name = "LongProductTitle".repeat(14);
  first.manufacturerPartNumber = "LongPartNumber".repeat(9);
  first.priceKobo = "0";
  first.compareAtPriceKobo = "10000";
  first.images = [];
  first.compatibilities = [
    {
      id: id(410),
      make: "Toyota",
      model: "Camry",
      yearFrom: 2018,
      yearTo: 2024,
      notes: "Check engine variant",
    },
    {
      id: id(411),
      make: "Lexus",
      model: null,
      yearFrom: null,
      yearTo: null,
      notes: null,
    },
  ];
  second.compareAtPriceKobo = second.priceKobo;
  second.availability = [];
  second.brand = null;
  second.images[0].url = `/api/v1/public/catalog/products/images/${id(299)}`;
  third.compareAtPriceKobo = "1";
  third.compatibilities = [
    {
      id: id(412),
      make: "Honda",
      model: null,
      yearFrom: null,
      yearTo: 2020,
      notes: null,
    },
  ];
  fourth.compatibilities = [
    {
      id: id(413),
      make: "Toyota",
      model: "Corolla",
      yearFrom: 2021,
      yearTo: null,
      notes: null,
    },
  ];
  state.items = [first, second, third, fourth];
  await page.route(`**/api/v1/public/catalog/products/images/${id(299)}`, (route) =>
    route.fulfill({ status: 404, body: "Not found" }),
  );
  await page.getByLabel("Sort by").selectOption("price_desc");
  const cards = page.locator(".shop-product-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator("strong")).toHaveText("₦0.00");
  await expect(cards.nth(0).locator("s")).toHaveText("₦100.00");
  await expect(cards.nth(0)).toContainText("2018–2024 · +1 more");
  await expect(cards.nth(1).locator("s")).toHaveCount(0);
  await expect(cards.nth(2).locator("s")).toHaveCount(0);
  await expect(cards.nth(1)).toContainText("Currently unavailable");
  await expect(cards.nth(1)).toContainText("Compatibility not listed");
  await expect(cards.nth(1)).toContainText("SKU QA-2");
  await expect(cards.nth(2)).toContainText("Model not listed");
  await expect(cards.nth(2)).toContainText("Up to 2020");
  await expect(cards.nth(3)).toContainText("From 2021");
  await cards.nth(1).scrollIntoViewIfNeeded();
  await expect(cards.nth(1).getByText("Image unavailable")).toBeVisible();
  await expect(cards.nth(0).getByText("Image unavailable")).toBeAttached();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator(".product-guidance")).toContainText(
    "Your cart does not reserve stock",
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "shop-oct-card-edge-cases.png"),
    fullPage: true,
  });
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
