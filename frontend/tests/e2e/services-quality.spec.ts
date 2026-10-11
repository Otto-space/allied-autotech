import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

const id = (n: number) => `f8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const service = (n: number) => ({
  id: id(n),
  name:
    n === 1
      ? "Vehicle diagnostics — QA example"
      : n === 2
        ? "Brake inspection — QA example"
        : n === 3
          ? "Engine repair — QA example"
          : "Second page service — QA example",
  slug: `isolated-service-${n}`,
  description: "Read the service details and discuss your vehicle with the team.",
  shortDescription: null,
  pricingType: n === 3 ? "QUOTE_REQUIRED" : "FIXED",
  priceKobo: n === 3 ? null : n === 2 ? "0" : "2500050",
  currency: "NGN",
  durationMinutes: 60,
  version: 0,
  image:
    n === 2
      ? {
          id: id(100),
          url: `/api/v1/public/media/images/${id(100)}`,
          altText: "Isolated QA service image",
          width: 1200,
          height: 800,
        }
      : null,
});
const success = (data: unknown) => ({
  success: true,
  message: "Isolated Services QA",
  data:
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray(data.items)
      ? { totalMatches: data.items.length, ...data }
      : data,
  meta: { requestId: "services-qa" },
});
async function fixture(page: Page, imageStatus = 200) {
  const state = {
    status: 200,
    empty: false,
    delay: 0,
    offline: false,
    requests: [] as URL[],
  };
  await page.route("**/api/v1/public/media/images/*", (route) =>
    imageStatus !== 200
      ? route.fulfill({ status: imageStatus })
      : route.fulfill({
          path: path.resolve("public/images/allied-autotech/workshop-editorial.webp"),
          contentType: "image/webp",
        }),
  );
  await page.route("**/api/v1/public/services/discovery?*", async (route) => {
    const url = new URL(route.request().url());
    state.requests.push(url);
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
    const more = url.searchParams.has("cursor");
    const pricing = url.searchParams.get("pricingType");
    const items = state.empty
      ? []
      : (more ? [service(4)] : [service(1), service(2), service(3)]).filter(
          (s) => !pricing || s.pricingType === pricing,
        );
    return route.fulfill({
      json: success({
        items,
        totalMatches: state.empty
          ? 0
          : pricing === "QUOTE_REQUIRED"
            ? 1
            : pricing === "FIXED"
              ? 3
              : 4,
        ...(!more && items.length ? { nextCursor: "A".repeat(180) } : {}),
      }),
    });
  });
  await page.route("**/api/v1/public/services/categories?*", (route) =>
    route.fulfill({ json: success({ items: [] }) }),
  );
  await page.goto("/services");
  await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
  await expect(page.locator(".services-row")).toHaveCount(2);
  await page.getByRole("radio", { name: "All services", exact: true }).check();
  await expect(page.locator(".services-row")).toHaveCount(3);
  return state;
}

test("pricing choices, pagination and reset preserve URL history and reload", async ({
  page,
}) => {
  const state = await fixture(page);
  state.requests = [];
  await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
  await expect(page).toHaveURL(/pricingType=FIXED/);
  await expect(page.locator(".services-row")).toHaveCount(2);
  await expect(
    page.getByText("3 matching services · 2 on this page", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Fixed price", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find your service" })).toBeFocused();
  await expect(page).toHaveURL(/cursor=.+&_trail=start/);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Fixed price", exact: true }),
  ).toBeChecked();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".services-row")).toHaveCount(2);
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove Fixed price filter" }).click();
  await expect(page).not.toHaveURL(/pricingType=|cursor=|_trail=/);
  await expect(
    page.getByRole("radio", { name: "All services", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".services-row")).toHaveCount(3);
  for (const url of state.requests)
    expect(
      [...url.searchParams.keys()].every((key) =>
        ["pricingType", "cursor", "limit"].includes(key),
      ),
    ).toBe(true);
});

test("keyboard radios, quotation labels, zero prices and real detail links", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("radio", { name: "All services", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Fixed price", exact: true }),
  ).toBeChecked();
  await expect(page.getByText("₦0.00", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".services-row")).toHaveCount(1);
  await expect(page.locator(".services-row-actions strong")).toHaveText(
    "Quotation required",
  );
  await expect(
    page.getByRole("link", { name: "View Engine repair — QA example" }),
  ).toHaveAttribute("href", `/services/${id(3)}`);
  await page.getByRole("button", { name: "Clear filter", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "All services", exact: true }),
  ).toBeChecked();
});

test("loading, empty, server, rate limit and network failures recover without false results", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delay = 700;
  await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
  await expect(page.getByText("Loading services…", { exact: true })).toBeVisible();
  await expect(page.locator(".services-skeleton")).toBeVisible();
  await expect(page.locator(".services-row")).toHaveCount(2);
  state.delay = 0;
  state.empty = true;
  await page.getByRole("radio", { name: "Quotation required", exact: true }).check();
  await expect(page.getByRole("heading", { name: "No matching services" })).toBeVisible();
  await page
    .locator(".services-state")
    .screenshot({ path: path.join(os.tmpdir(), "services-quality-empty.png") });
  await page.getByRole("button", { name: "Show all services" }).click();
  await expect(
    page.getByRole("heading", { name: "Services are not listed yet" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Service pages" })).toHaveCount(0);
  state.empty = false;
  for (const failure of [503, 429, "network"] as const) {
    state.status = typeof failure === "number" ? failure : 200;
    state.offline = failure === "network";
    await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
    await expect(
      page.getByRole("heading", { name: "Services are unavailable" }),
    ).toBeVisible();
    if (failure === 503)
      await page
        .locator(".services-state")
        .screenshot({ path: path.join(os.tmpdir(), "services-quality-error.png") });
    await expect(page.locator(".services-row")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No matching services" })).toHaveCount(
      0,
    );
    state.status = 200;
    state.offline = false;
    await page.getByRole("button", { name: "Retry services", exact: true }).click();
    await expect(page.locator(".services-row")).toHaveCount(2);
    await page.getByRole("radio", { name: "All services", exact: true }).check();
    await expect(page.locator(".services-row")).toHaveCount(3);
  }
});

test("invalid links and raw cursor recovery", async ({ page }) => {
  await fixture(page);
  await page.goto(`/services?pricingType=FREE&cursor=${id(3)}`);
  await expect(page.getByText(/Some filters in this link were invalid/)).toBeVisible();
  await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
  await page.getByRole("button", { name: "Clear filter", exact: true }).click();
  await expect(page).not.toHaveURL(/pricingType=|cursor=/);
  await page.goto(`/services?cursor=${id(3)}`);
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
});

test("failed image requests retain readable service details and links", async ({
  page,
}) => {
  const failures: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/public/media/images/"))
      failures.push(response.status());
  });
  await fixture(page, 404);
  await expect(
    page.getByRole("img", { name: "Service image unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Brake inspection — QA example" }),
  ).toBeVisible();
  expect(failures).toContain(404);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`responsive Services page and accessibility at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await fixture(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb", exact: true })
        .getByText("Services", { exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const radio of await page.locator(".services-pricing label > span").all())
      expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `services-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `services-quality-${width}-full.png`),
      fullPage: true,
    });
    const resultsTop = await page
      .locator(".services-results")
      .evaluate((node) => node.getBoundingClientRect().top + scrollY);
    await page.getByRole("radio", { name: "Fixed price", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("radio", { name: "Fixed price", exact: true }),
    ).toBeChecked();
    expect(
      await page
        .locator(".services-results")
        .evaluate((node) => node.getBoundingClientRect().top + scrollY),
    ).toBeCloseTo(resultsTop, 0);
    await page.locator(".services-catalogue").screenshot({
      path: path.join(os.tmpdir(), `services-quality-${width}-filters.png`),
    });
    expect(errors).toEqual([]);
  });
}

test("native concept size and short viewport retain usable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await fixture(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(os.tmpdir(), "services-quality-native-introduction.png"),
  });
  for (const [name, selector] of [
    ["catalogue", ".services-catalogue"],
    ["journey", ".services-journey"],
    ["principles", ".services-principles"],
    ["faq", ".services-faq"],
    ["contact", ".services-contact"],
  ])
    await page.locator(selector).screenshot({
      path: path.join(os.tmpdir(), `services-quality-native-${name}.png`),
    });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByRole("radio", { name: "Quotation required", exact: true }).check();
  await expect(page.locator(".services-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filter", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "All services", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("radio", { name: "All services", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("long service content and touch controls remain usable on a short mobile viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 500 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await fixture(page);
    await page.route("**/api/v1/public/services/discovery?*", (route) =>
      route.fulfill({
        json: success({
          items: [
            {
              ...service(1),
              name: "Service".repeat(22),
              description: "Detailed vehicle assessment. ".repeat(100),
              priceKobo: "9999999999999999",
            },
            service(2),
          ],
        }),
      }),
    );
    await page.getByRole("radio", { name: "Fixed price", exact: true }).tap();
    await expect(page.locator(".services-row")).toHaveCount(2);
    await expect(page.locator(".services-row h3").first()).toHaveText(
      "Service".repeat(22),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page
      .locator(".services-row")
      .first()
      .screenshot({ path: path.join(os.tmpdir(), "services-quality-long-content.png") });
    await page.getByRole("button", { name: "Clear filter", exact: true }).tap();
    await expect(
      page.getByRole("radio", { name: "All services", exact: true }),
    ).toBeChecked();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await context.close();
  }
});

test("listed duration, missing details and pricing stay faithful to service fields", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/public/services/discovery?*", (route) =>
    route.fulfill({
      json: success({
        items: [
          {
            ...service(1),
            durationMinutes: 1,
            shortDescription: "Short service summary",
            description: "Longer detail text",
          },
          {
            ...service(2),
            durationMinutes: null,
            shortDescription: null,
            description: null,
            image: null,
          },
          { ...service(3), durationMinutes: 90 },
        ].filter((item) => {
          const pricing = new URL(route.request().url()).searchParams.get("pricingType");
          return !pricing || item.pricingType === pricing;
        }),
      }),
    }),
  );
  await page.getByRole("radio", { name: "Fixed price", exact: true }).check();
  await expect(page.locator(".services-row")).toHaveCount(2);
  await page.getByRole("radio", { name: "All services", exact: true }).check();
  await expect(page.locator(".services-row")).toHaveCount(3);
  const rows = page.locator(".services-row");
  await expect(rows.nth(0)).toContainText("Listed duration: 1 minute");
  await expect(rows.nth(0)).toContainText("Short service summary");
  await expect(rows.nth(0)).not.toContainText("Longer detail text");
  await expect(rows.nth(1)).toContainText("Duration not listed");
  await expect(rows.nth(1)).toContainText("₦0.00");
  await expect(rows.nth(1)).toContainText(
    "View this service for booking and quotation details.",
  );
  await expect(rows.nth(1)).toContainText("Image unavailable");
  await expect(rows.nth(2)).toContainText("Listed duration: 90 minutes");
  await expect(rows.nth(2).locator(".services-row-actions strong")).toHaveText(
    "Quotation required",
  );
  await expect(rows.nth(2).locator(".services-row-price")).not.toContainText("₦");
});

test("care principles and booking FAQ are readable and keyboard operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await fixture(page);
  await expect(page.locator(".services-principles li")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Our approach to vehicle care" }),
  ).toHaveAttribute("href", "/about");
  await expect(page.locator(".services-journey li")).toHaveCount(6);
  const question = page.locator(".services-faq summary").nth(1);
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".services-faq details").nth(1)).toHaveAttribute("open", "");
  await expect(
    page.getByText(/A booking request is sent for workshop review/),
  ).toBeVisible();
  await expect(page.getByText(/not a guaranteed collection time/)).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Space");
  await expect(page.locator(".services-faq details").nth(1)).not.toHaveAttribute("open");
  await expect(question).toBeFocused();
});

test("discovery controls use server totals, category options and recover failed cursors", async ({
  page,
}) => {
  await fixture(page);
  let categoryFailure = true;
  await page.route("**/api/v1/public/services/categories?*", (route) =>
    route.fulfill(
      categoryFailure
        ? {
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          }
        : {
            json: success({
              items: [{ id: id(90), name: "Maintenance", slug: "maintenance" }],
            }),
          },
    ),
  );
  await page.route(`**/api/v1/public/services/categories/${id(90)}`, (route) =>
    route.fulfill({
      json: success({ id: id(90), name: "Maintenance", slug: "maintenance" }),
    }),
  );
  await page.route("**/api/v1/public/services/discovery?*", (route) => {
    const query = new URL(route.request().url()).searchParams;
    if (query.has("cursor"))
      return route.fulfill({
        status: 422,
        json: { success: false, error: { code: "VALIDATION_FAILED" } },
      });
    return route.fulfill({
      json: success({
        items: [service(1)],
        totalMatches: 17,
        nextCursor: "A".repeat(180),
      }),
    });
  });
  await page.getByText("Find a category", { exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Main");
  await page.getByRole("button", { name: "Find categories", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry categories", exact: true }),
  ).toBeVisible();
  categoryFailure = false;
  await page.getByRole("button", { name: "Retry categories", exact: true }).click();
  await page.getByLabel("Service category", { exact: true }).selectOption(id(90));
  await page.getByLabel("Search services", { exact: true }).fill("engine");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Sort services", { exact: true }).selectOption("newest");
  await expect(page).toHaveURL(/search=engine/);
  await expect(page).toHaveURL(/sort=newest/);
  await expect(
    page.getByText("17 matching services · 1 on this page", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Service pages", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restart service search", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart service search", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page).toHaveURL(/search=engine/);
  await expect(page).toHaveURL(/categoryId=/);
  await expect(
    page.getByText("17 matching services · 1 on this page", { exact: true }),
  ).toBeVisible();
});
