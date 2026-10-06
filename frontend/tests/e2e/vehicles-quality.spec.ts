import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { parseListings } from "@/lib/api/vehicle-schemas";

const id = (n: number) => `f6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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
  const state = {
    status: 200,
    empty: false,
    delay: 0,
    offline: false,
    requests: [] as URL[],
  };
  await page.route("**/api/v1/public/vehicles/images/*", (route) =>
    route.fulfill({
      path: path.resolve("public/images/allied-autotech/showroom-editorial.webp"),
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/public/vehicles?*", async (route) => {
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
          items: state.empty
            ? []
            : more
              ? [listing(4)]
              : [listing(1), listing(2), listing(3)],
          ...(!more && !state.empty ? { nextCursor: id(3) } : {}),
        },
        meta: { requestId: "vehicle-qa" },
      },
    });
  });
  await page.goto("/vehicles");
  await page.getByRole("searchbox", { name: "Search vehicles" }).fill("QA");
  await expect(
    page.getByRole("status").filter({ hasText: "3 vehicles on this page" }),
  ).toBeVisible();
  return state;
}

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
  await page.getByLabel("Make (exact name)").fill("Toyota");
  await page.getByLabel("Model (exact name)").fill("Camry");
  await page.getByLabel("Year", { exact: true }).fill("2023");
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
  await page.getByLabel("Transmission", { exact: true }).selectOption("AUTOMATIC");
  await page.getByLabel("Fuel type").selectOption("PETROL");
  await page.getByLabel("Featured listings").selectOption("false");
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
    year: "2023",
    minPriceKobo: "500000001",
    maxPriceKobo: "600000099",
    bodyType: "SEDAN",
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    featured: "false",
    limit: "12",
  });
  await page.reload();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Minimum price (NGN)")).toHaveValue("5000000.01");
  await expect(page.getByLabel("Featured listings")).toHaveValue("false");
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

test("mobile drawer retains drafts, traps focus, clears and restores trigger focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await fixture(page);
  const trigger = page.getByRole("button", { name: /^Filters/ });
  await trigger.click();
  await page.getByLabel("Make (exact name)").fill("Toyota");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel("Make (exact name)")).toHaveValue("Toyota");
  const apply = page.getByRole("button", { name: "Apply filters" });
  await apply.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close filters" })).toBeFocused();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByLabel("Make (exact name)")).toHaveValue("");
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
    page.getByRole("heading", { name: "No vehicles are listed yet" }),
  ).toBeVisible();
  state.status = 503;
  await page.getByLabel("Sort by").selectOption("year_desc");
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-error.png") });
  state.status = 429;
  const limited = page.waitForResponse(
    (response) =>
      response.url().includes("/public/vehicles?") && response.status() === 429,
  );
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await limited;
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  state.status = 200;
  state.empty = false;
  state.offline = true;
  const disconnected = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("/public/vehicles?"),
  );
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await disconnected;
  await expect(page.getByRole("button", { name: "Retry vehicles" })).toBeVisible();
  state.offline = false;
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
});

for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
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
    await page.getByLabel("Make (exact name)").fill("A".repeat(80));
    await page.getByLabel("Model (exact name)").fill("B".repeat(80));
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
    await page.locator(".lifestyle-section").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicles-quality-${width}-lifestyle.png`),
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
  await expect(page.getByLabel("Make (exact name)")).toHaveValue("Toyota");
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Maximum price (NGN)")).toHaveValue("");
});

test.describe("touch filter drawer", () => {
  test.use({ viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  test("actions remain reachable with a short viewport", async ({ page }) => {
    await fixture(page);
    await page.getByRole("button", { name: /^Filters/ }).tap();
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeInViewport();
    await page.getByLabel("Featured listings").scrollIntoViewIfNeeded();
    await page.getByLabel("Featured listings").selectOption("true");
    await page.getByRole("button", { name: "Apply filters" }).tap();
    await expect(
      page.getByRole("button", { name: "Remove Featured only" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test("native concept dimensions and complete section captures", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await fixture(page);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("heading", { name: "Find the car that fits your life." }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-introduction.png"),
  });
  await page.locator("#inventory").screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-inventory.png"),
  });
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page
    .getByRole("dialog")
    .screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-native-panel.png") });
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.locator(".lifestyle-section").screenshot({
    path: path.join(os.tmpdir(), "vehicles-quality-native-lifestyle.png"),
  });
  await page
    .locator(".vehicle-contact")
    .screenshot({ path: path.join(os.tmpdir(), "vehicles-quality-native-contact.png") });
});
