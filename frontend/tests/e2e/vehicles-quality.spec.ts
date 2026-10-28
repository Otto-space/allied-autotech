import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { parseListings } from "@/lib/api/vehicle-schemas";

const id = (n: number) => `f6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cursor = `${"A".repeat(120)}_${"a".repeat(64)}`;
const listing = (n: number): ReturnType<typeof parseListings>["items"][number] => ({
  id: id(n),
  title:
    n === 1
      ? "Toyota Camry - isolated QA example"
      : `Honda Accord - isolated QA example ${n}`,
  slug: `qa-${n}`,
  priceKobo: "4500000000",
  currency: "NGN",
  description: null,
  branch: {
    id: id(10),
    code: "QA",
    name: "Port Harcourt QA branch",
    city: "Port Harcourt",
    state: "Rivers",
  },
  vehicle: {
    id: id(20 + n),
    make: n === 1 ? "Toyota" : "Honda",
    model: n === 1 ? "Camry" : "Accord",
    trim: null,
    year: 2023,
    mileageKm: 18000,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    condition: "USED",
    bodyType: "SEDAN",
    color: null,
    images: [
      {
        id: id(30 + n),
        url: `/api/v1/public/vehicles/images/${id(30 + n)}`,
        altText: null,
        isPrimary: true,
      },
    ],
    conditionReports: [],
  },
});
async function fixture(page: Page) {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: {
        success: false,
        error: { code: "UNAUTHORIZED" },
        meta: { requestId: "anonymous-ui-fixture" },
      },
    }),
  );
  const state = {
    status: 200,
    empty: false,
    emptyTail: false,
    delay: 0,
    offline: false,
    requests: [] as URL[],
    facetRequests: [] as URL[],
    facetError: false,
    items: [listing(1), listing(2), listing(3)],
  };
  await page.route("**/api/v1/public/vehicles/images/*", (route) =>
    route.fulfill({
      path: path.resolve("public/images/allied-autotech/showroom-editorial.webp"),
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/public/vehicles/facets?*", async (route) => {
    const url = new URL(route.request().url());
    state.facetRequests.push(url);
    if (state.facetError)
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    const field = url.searchParams.get("field"),
      make = url.searchParams.get("make");
    const names =
      field === "make"
        ? url.searchParams.has("search")
          ? ["Honda", "Toyota"]
          : url.searchParams.has("cursor")
            ? ["Toyota"]
            : ["Honda"]
        : make?.toLowerCase() === "toyota"
          ? ["Camry", "Corolla"]
          : ["Accord"];
    const items = names
      .filter((name) =>
        name
          .toLowerCase()
          .startsWith(url.searchParams.get("search")?.toLowerCase() ?? ""),
      )
      .map((label) => ({ label, value: label.toLowerCase() }));
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated vehicle options",
        meta: { requestId: "vehicle-options-qa" },
        data: {
          items,
          ...(field === "make" &&
          !url.searchParams.has("cursor") &&
          !url.searchParams.has("search")
            ? { nextCursor: cursor }
            : {}),
        },
      },
    });
  });
  await page.route("**/api/v1/public/vehicles/discovery?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("limit") !== "1")
      state.requests.push(new URL(route.request().url()));
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.offline) return route.abort("internetdisconnected");
    if (state.status !== 200)
      return route.fulfill({
        status: state.status,
        headers: state.status === 429 ? { "Retry-After": "1" } : {},
        json: {
          success: false,
          error: {
            code: state.status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE",
            message: "Vehicle listings are temporarily unavailable.",
          },
          meta: { requestId: "vehicle-qa" },
        },
      });
    const more = new URL(route.request().url()).searchParams.has("cursor");
    await route.fulfill({
      json: {
        success: true,
        message: "Isolated vehicle QA response",
        data: {
          items:
            state.empty || (more && state.emptyTail)
              ? []
              : more
                ? [listing(4)]
                : state.items,
          totalMatches: state.empty ? 0 : 4,
          ...(!more && !state.empty ? { nextCursor: cursor } : {}),
        },
        meta: { requestId: "vehicle-qa" },
      },
    });
  });
  await page.goto("/vehicles");
  await page.getByRole("searchbox", { name: "Search vehicles" }).fill("QA");
  await expect(page).toHaveURL(/search=QA/);
  await expect.poll(() => state.requests.at(-1)?.searchParams.get("search")).toBe("QA");
  await expect(
    page.getByRole("status").filter({ hasText: "3 vehicles on this page" }),
  ).toBeVisible();
  return state;
}

test("totals describe all matches while the current page count changes", async ({
  page,
}) => {
  await fixture(page);
  await expect(
    page.getByRole("status").filter({ hasText: "4 matching vehicles" }),
  ).toContainText("3 vehicles on this page");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "4 matching vehicles" }),
  ).toContainText("1 vehicle on this page");
});

test("make suggestions page and search globally; model suggestions follow the selected make", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.locator('#filter-make-options option[value="Honda"]')).toHaveCount(1);
  await page.getByRole("button", { name: "More make options" }).click();
  await expect(page.locator('#filter-make-options option[value="Toyota"]')).toHaveCount(
    1,
  );
  await expect
    .poll(() => state.facetRequests.some((url) => url.searchParams.has("cursor")))
    .toBe(true);
  await page.getByLabel("Make").fill("Toy");
  await expect(page.locator('#filter-make-options option[value="Toyota"]')).toHaveCount(
    1,
  );
  await expect
    .poll(() =>
      state.facetRequests
        .filter((url) => url.searchParams.get("field") === "make")
        .at(-1)
        ?.searchParams.get("search"),
    )
    .toBe("Toy");
  await page.getByLabel("Make").fill("Toyota");
  await expect(page.locator('#filter-model-options option[value="Camry"]')).toHaveCount(
    1,
  );
  await page.getByLabel("Model").fill("Cam");
  await expect(page.locator("#filter-model-options option")).toHaveCount(1);
  await page.getByLabel("Make").fill("Honda");
  await expect(page.getByLabel("Model")).toHaveValue("");
  await expect(page.locator('#filter-model-options option[value="Accord"]')).toHaveCount(
    1,
  );
});

test("failed option reads retain typed values and support retry", async ({ page }) => {
  const state = await fixture(page);
  state.facetError = true;
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Make").fill("Toyota");
  await expect(
    page.getByRole("button", { name: "Retry make suggestions" }),
  ).toBeVisible();
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  state.facetError = false;
  await page.getByRole("button", { name: "Retry make suggestions" }).click();
  await expect(page.locator('#filter-make-options option[value="Toyota"]')).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect.poll(() => state.requests.at(-1)?.searchParams.get("make")).toBe("Toyota");
});
test("an emptied later page keeps its total and returns to the first page without clearing filters", async ({
  page,
}) => {
  const state = await fixture(page);
  state.emptyTail = true;
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No vehicles on this page" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "4 matching vehicles" }),
  ).toContainText("0 vehicles on this page");
  await page.getByRole("button", { name: "Start from first page" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
  await expect(page).toHaveURL(/search=QA/);
  await expect(page).not.toHaveURL(/cursor=/);
});

test("debounced search keeps focus, URL, chips and browser history", async ({ page }) => {
  const state = await fixture(page);
  state.requests = [];
  const search = page.getByRole("searchbox", { name: "Search vehicles" });
  await search.fill("Toyota");
  await expect(page).toHaveURL(/search=Toyota/);
  await expect(search).toBeFocused();
  await expect.poll(() => state.requests.length).toBe(1);
  await expect(page.getByRole("button", { name: "Remove Search: Toyota" })).toBeVisible();
  await page.goBack();
  await expect(search).toHaveValue("QA");
  await page.goForward();
  await expect(search).toHaveValue("Toyota");
  await page.reload();
  await expect(search).toHaveValue("Toyota");
  await page.getByRole("button", { name: "Remove Search: Toyota" }).click();
  await expect(search).toHaveValue("");
  await expect(page).not.toHaveURL(/search=/);
});

test("advanced filters validate, send exact public parameters and survive reload", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Make").fill("Toyota");
  await page.getByLabel("Model").fill("Camry");
  await page.getByLabel("Year from", { exact: true }).fill("2023");
  await page.getByLabel("Year to", { exact: true }).fill("2023");
  await page.getByLabel("Minimum price (NGN)").fill("5000000.01");
  await page.getByLabel("Maximum price (NGN)").fill("4000000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByLabel("Maximum price (NGN)")).toBeFocused();
  await expect(page.getByLabel("Maximum price (NGN)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#filter-maxPriceKobo-error")).toContainText(
    "Maximum price must be",
  );
  await page.getByLabel("Maximum price (NGN)").fill("6000000.99");
  await page.getByLabel("Body type").selectOption("SEDAN");
  await page.getByText("Advanced: driving and equipment", { exact: true }).click();
  await page.getByLabel("Transmission", { exact: true }).selectOption("AUTOMATIC");
  await page.getByLabel("Fuel type").selectOption("PETROL");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get("maxPriceKobo"))
    .toBe("600000099");
  expect(Object.fromEntries(state.requests.at(-1)!.searchParams)).toEqual({
    search: "QA",
    make: "Toyota",
    model: "Camry",
    minYear: "2023",
    maxYear: "2023",
    minPriceKobo: "500000001",
    maxPriceKobo: "600000099",
    bodyType: "SEDAN",
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    limit: "12",
  });
  await page.reload();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Minimum price (NGN)")).toHaveValue("5000000.01");
  await expect(page.getByLabel("Featured listings")).toHaveCount(0);
});

test("cursor navigation restores Previous after reload and filters reset pagination", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  expect(state.requests.at(-1)!.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Sort by").selectOption("price_asc");
  await expect(page).not.toHaveURL(/cursor=|_trail=/);
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
});

test("mobile drawer cancels unapplied edits, traps focus, clears and restores trigger focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await fixture(page);
  const trigger = page.getByRole("button", { name: /^Filters/ });
  await trigger.click();
  await page.getByLabel("Make").fill("Toyota");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel("Make")).toHaveValue("");
  const apply = page.getByRole("button", { name: "Apply filters" });
  await apply.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close filters" })).toBeFocused();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByLabel("Make")).toHaveValue("");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(apply).toBeInViewport();
  await apply.click();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("loading, no matches, error, rate limit and network recovery remain usable", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delay = 1200;
  await page.getByLabel("Sort by").selectOption("price_asc");
  await expect(page.locator(".vehicle-results")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".vehicle-skeleton").first()).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-loading.png") });
  await expect(page.getByRole("searchbox", { name: "Search vehicles" })).toBeVisible();
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
  state.delay = 0;
  state.empty = true;
  await page.getByLabel("Sort by").selectOption("price_desc");
  await expect(page.getByRole("heading", { name: "No matching vehicles" })).toBeVisible();
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-no-matches.png"),
  });
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No vehicles are published yet" }),
  ).toBeVisible();
  state.status = 503;
  await page.getByRole("searchbox", { name: "Search vehicles" }).fill("test failure");
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-error.png") });
  state.status = 429;
  const limited = page.waitForResponse(
    (response) =>
      response.url().includes("/public/vehicles/discovery?") && response.status() === 429,
  );
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await limited;
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  state.status = 200;
  state.empty = false;
  state.offline = true;
  const disconnected = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("/public/vehicles/discovery?"),
  );
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await disconnected;
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  state.offline = false;
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`Vehicles layout, controls and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await fixture(page);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Vehicles"),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".vehicle-card").first().getByRole("link")).toHaveAttribute(
      "href",
      `/vehicles/${id(1)}`,
    );
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicles-quality-${width}-viewport.png`),
    });
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByLabel("Make").fill("A".repeat(80));
    await page.getByLabel("Model").fill("B".repeat(80));
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicles-quality-${width}-filters.png`),
    });
    expect(
      (
        await new AxeBuilder({ page })
          .include("#main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(page.getByRole("button", { name: /Remove Make:/ })).toBeVisible();
    await expect(page.locator(".lifestyle-section")).toHaveCount(0);
    await page.locator(".vehicle-buying-guide").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicles-quality-${width}-guidance.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicles-quality-${width}-full.png`),
      fullPage: true,
    });
    expect(
      (
        await new AxeBuilder({ page })
          .include("#main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("Back cancels an uncommitted search even when the previous search value is unchanged", async ({
  page,
}) => {
  await fixture(page);
  await page.getByLabel("Sort by").selectOption("price_asc");
  const search = page.getByRole("searchbox", { name: "Search vehicles" });
  await search.fill("Uncommitted text");
  await page.goBack();
  await expect(search).toHaveValue("QA");
  await page.waitForTimeout(600);
  await expect(page).not.toHaveURL(/Uncommitted|sort=/);
});

test("invalid deep links recover without sending unsupported filters", async ({
  page,
}) => {
  await page.goto("/vehicles?year=1000&maxPriceKobo=wrong&make=Toyota");
  await expect(page.getByText(/Some filters in this link were invalid/)).toBeVisible();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Make")).toHaveValue("Toyota");
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Maximum price (NGN)")).toHaveValue("");
});

test.describe("touch filter drawer", () => {
  test.use({ viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  test("actions remain reachable with a short viewport", async ({ page }) => {
    await fixture(page);
    await page.getByRole("button", { name: /^Filters/ }).tap();
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeInViewport();
    await page.getByText("Advanced: driving and equipment", { exact: true }).click();
    await page.getByLabel("Mileage to (km)").fill("50000");
    await page.getByRole("button", { name: "Apply filters" }).tap();
    await expect(
      page.getByRole("button", { name: "Remove Mileage to (km): 50000" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test("native concept dimensions and complete section captures", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await fixture(page);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("heading", { name: "Explore vehicle listings" }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-introduction.png"),
  });
  await page.locator("#inventory").screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-inventory.png"),
  });
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // A viewport capture preserves the native non-modal dialog dimensions.
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-panel.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.locator(".vehicle-buying-guide").screenshot({
    path: path.join(os.tmpdir(), "vehicles-oct-native-guide.png"),
  });
  await page
    .locator(".vehicle-contact")
    .screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-native-contact.png") });
});

test("body shortcuts preserve search and sort, reset cursors and follow history", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByLabel("Sort by").selectOption("price_asc");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/cursor=/);
  const shortcuts = page.getByRole("group", { name: "Body type", exact: true });
  await shortcuts.getByRole("button", { name: "SUV", exact: true }).click();
  await expect(page).toHaveURL(/bodyType=SUV/);
  await expect(page).not.toHaveURL(/cursor=|_trail=/);
  await expect
    .poll(() => state.requests.at(-1)?.searchParams.get("bodyType"))
    .toBe("SUV");
  expect(state.requests.at(-1)?.searchParams.get("search")).toBe("QA");
  expect(state.requests.at(-1)?.searchParams.get("sort")).toBe("price_asc");
  await expect(
    shortcuts.getByRole("button", { name: "SUV", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await shortcuts.getByRole("button", { name: "Sedan", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/bodyType=SEDAN/);
  await page.goBack();
  await expect(
    shortcuts.getByRole("button", { name: "SUV", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Body type", { exact: true }).selectOption("COUPE");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    shortcuts.getByRole("button", { name: "Coupe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await shortcuts.getByRole("button", { name: "All types", exact: true }).click();
  await expect(page).not.toHaveURL(/bodyType=/);
  await expect(page).toHaveURL(/search=QA/);
  await expect(page).toHaveURL(/sort=price_asc/);
});

test("cards preserve zero values, missing specifications, report truth and long text at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await fixture(page);
  const first = listing(1);
  first.title = "VeryLongVehicleName".repeat(12);
  first.vehicle.trim = "ExtendedTrim".repeat(12);
  first.vehicle.mileageKm = 0;
  first.priceKobo = "0";
  first.vehicle.images = [];
  first.vehicle.conditionReports = [
    {
      id: id(50),
      summary: "Published test report",
      inspectedAt: "2026-09-01T10:00:00Z",
      odometerKm: 0,
      conditionScore: 80,
    },
  ];
  const second = listing(2);
  second.vehicle.mileageKm = null;
  second.vehicle.transmission = null;
  second.vehicle.fuelType = null;
  second.vehicle.images[0].url = `/api/v1/public/vehicles/images/${id(99)}`;
  second.branch.city = "LongCity".repeat(20);
  state.items = [first, second];
  await page.route(`**/api/v1/public/vehicles/images/${id(99)}`, (route) =>
    route.fulfill({ status: 404, body: "Not found" }),
  );
  await page.getByLabel("Sort by").selectOption("year_desc");
  const cards = page.locator(".vehicle-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("0 km");
  await expect(cards.nth(0).locator("strong")).toHaveText("₦0.00");
  await expect(cards.nth(0)).toContainText("Condition report available");
  await expect(cards.nth(1)).not.toContainText("Condition report available");
  await expect(cards.nth(1).getByText("Not listed", { exact: true })).toHaveCount(3);
  await cards.nth(1).scrollIntoViewIfNeeded();
  await expect(cards.nth(1).getByText("Image unavailable")).toBeVisible();
  await expect(cards.nth(0).getByText("Image unavailable")).toBeAttached();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicles-oct-edge-cards.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "A closer look before your next move." }),
  ).toBeVisible();
  await expect(page.locator(".vehicle-buying-guide")).toContainText(
    "not a confirmed appointment",
  );
  await expect(
    page.locator(".vehicle-buying-guide").getByRole("link", { name: "Ask our team" }),
  ).toHaveAttribute("href", "/contact");
});

for (const width of [1440, 390]) {
  test(`origin, powertrain and range filters at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await fixture(page);
    const field = (name: string) => page.getByLabel(name, { exact: true });
    const apply = () => page.getByRole("button", { name: "Apply filters" }).click();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("checkbox", { name: "Foreign used", exact: true }).check();
    await page.getByRole("checkbox", { name: "Brand new", exact: true }).check();
    await page.getByText("Advanced: assembly location", { exact: true }).click();
    await field("Final assembly country").fill("South Korea");
    await page.getByText("Advanced: driving and equipment", { exact: true }).click();
    await page.getByRole("checkbox", { name: /Plug-in hybrid/ }).check();
    await page.getByRole("checkbox", { name: /^Hybrid/ }).check();
    await field("Year from").fill("2024");
    await field("Year to").fill("2018");
    await apply();
    await expect(
      page.getByText("Maximum must be at least the minimum.", { exact: true }),
    ).toBeVisible();
    await expect(field("Year to")).toBeFocused();
    await field("Year from").fill("2018");
    await field("Year to").fill("2024");
    await field("Mileage to (km)").fill("75000");
    await page.screenshot({
      path: testInfo.outputPath(`vehicle-filters-${width}.png`),
      fullPage: false,
    });
    await apply();
    await expect
      .poll(() => state.requests.at(-1)?.searchParams.get("manufactureCountryCode"))
      .toBe("KR");
    for (const [key, value] of [
      ["conditions", "NEW,FOREIGN_USED"],
      ["powertrains", "HEV,PHEV"],
      ["minYear", "2018"],
      ["maxYear", "2024"],
      ["maxMileageKm", "75000"],
    ])
      expect(state.requests.at(-1)?.searchParams.get(key)).toBe(value);
    await field("Sort by").selectOption("mileage_asc");
    await expect
      .poll(() => state.requests.at(-1)?.searchParams.get("sort"))
      .toBe("mileage_asc");
    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await page.goForward();
    await expect(page).toHaveURL(/sort=mileage_asc/);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await field("Final assembly region").selectOption("EUROPE");
    await expect(field("Final assembly country")).toHaveValue("");
    await field("Final assembly country").fill("Imaginary country");
    await apply();
    await expect(
      page.getByText("Choose a country from the suggestions or clear the field.", {
        exact: true,
      }),
    ).toBeVisible();
    await field("Final assembly country").fill("Germany");
    expect(
      (await new AxeBuilder({ page }).include("#vehicle-filter-panel").analyze())
        .violations,
    ).toEqual([]);
    await apply();
    await expect
      .poll(() => state.requests.at(-1)?.searchParams.get("manufactureCountryCode"))
      .toBe("DE");
    expect(
      await page
        .locator("body")
        .evaluate((node) => node.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Remove Condition: Brand new", exact: true })
      .click();
    await expect
      .poll(() => state.requests.at(-1)?.searchParams.get("conditions"))
      .toBe("FOREIGN_USED");
    await expect(
      page.getByRole("button", { name: "Remove Condition: Foreign used", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
