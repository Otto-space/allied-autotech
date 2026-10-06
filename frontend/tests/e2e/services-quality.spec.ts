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
  data,
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
  await page.route("**/api/v1/public/services?*", async (route) => {
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
      json: success({ items, ...(!more && items.length ? { nextCursor: id(3) } : {}) }),
    });
  });
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
  await expect(page.getByText("2 services on this page", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page).not.toHaveURL(/pricingType=|cursor=/);
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

for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
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
    await page.route("**/api/v1/public/services?*", (route) =>
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
