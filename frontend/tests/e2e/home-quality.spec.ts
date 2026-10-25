import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import path from "node:path";
import os from "node:os";
import AxeBuilder from "@axe-core/playwright";
import {
  id,
  product,
  listing,
  service,
  quoteService,
} from "../fixtures/public-account-actions";

test.skip(process.env.RUN_HOME_TESTS !== "true", "Requires isolated Home SSR fixture");
const port = Number(process.env.HOME_FIXTURE_PORT ?? 5021);
const success = (data: unknown) => ({
  success: true,
  data,
  message: "Isolated Home fixture",
  meta: { requestId: "home-qa" },
});
let mode = "normal";
let server: Server;
let serverReads: string[] = [];
const media = {
  id: id(71),
  url: `/api/v1/public/media/images/${id(71)}`,
  altText: "Synthetic catalogue photograph",
  isPrimary: true,
};
function records(endpoint: string) {
  if (mode === "empty") return { items: [] };
  const long = mode === "long" ? "LongCatalogueName".repeat(15) : undefined;
  if (endpoint === "/public/catalog/products")
    return {
      items: [
        {
          ...product,
          name: long ?? "Engine air filter",
          priceKobo: "1250050",
          images: [
            { ...media, url: `/api/v1/public/catalog/products/images/${media.id}` },
          ],
        },
        {
          ...product,
          id: id(101),
          name: "Brake pad set",
          priceKobo: "2800000",
          availability: [{ ...product.availability[0], inStock: false }],
        },
        { ...product, id: id(102), name: "Engine oil", priceKobo: "4600000" },
        { ...product, id: id(103), name: "Spark plug", priceKobo: "0" },
      ],
    };
  if (endpoint === "/public/vehicles")
    return {
      items: [
        {
          ...listing,
          title: long ?? "Toyota Corolla",
          vehicle: {
            ...listing.vehicle,
            mileageKm: 0,
            images: [{ ...media, url: `/api/v1/public/vehicles/images/${media.id}` }],
          },
        },
        {
          ...listing,
          id: id(104),
          title: "Toyota Highlander",
          vehicle: {
            ...listing.vehicle,
            mileageKm: null,
            transmission: null,
            fuelType: null,
          },
        },
      ],
    };
  if (endpoint === "/public/services")
    return {
      items: [
        {
          ...service,
          name: long ?? "Vehicle diagnostics",
          priceKobo: "2510050",
          image: { ...media, width: 1600, height: 1000 },
        },
        { ...service, id: id(105), name: "Brake inspection", priceKobo: "0" },
        { ...quoteService, name: "Engine assessment" },
      ],
    };
  if (endpoint === "/public/support/reviews")
    return {
      items:
        mode === "reviews"
          ? [1, 2, 3].map((n) => ({
              id: id(110 + n),
              targetType: "BUSINESS",
              rating: n + 2,
              title: `Customer feedback ${n}`,
              comment: "Synthetic review content for layout verification only.",
              createdAt: "2026-10-01T10:00:00Z",
              product: null,
              service: null,
            }))
          : [],
    };
  return { items: [] };
}
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const endpoint = new URL(req.url ?? "/", `http://127.0.0.1:${port}`).pathname.replace(
      /^\/api\/v1/,
      "",
    );
    serverReads.push(req.url ?? "/");
    res.writeHead(mode === "down" ? 503 : 200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        mode === "down"
          ? { success: false, error: { code: "INTERNAL_ERROR" } }
          : success(records(endpoint)),
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
});
test.beforeEach(() => {
  mode = "normal";
  serverReads = [];
});
async function fixture(page: Page) {
  const state = {
    reads: [] as string[],
    failImage: false,
    delayReviews: false,
    delayCatalogue: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
    state.reads.push(endpoint);
    if (endpoint === "/auth/session")
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (endpoint.includes("/images/"))
      return state.failImage
        ? route.fulfill({ status: 404, body: "" })
        : route.fulfill({
            path: path.resolve("public/images/allied-autotech/showroom-editorial.webp"),
            contentType: "image/webp",
          });
    if (state.delayReviews && endpoint === "/public/support/reviews")
      await new Promise((resolve) => setTimeout(resolve, 800));
    if (!endpoint.startsWith("/public/") || req.method() !== "GET")
      throw new Error(`Unexpected Home request: ${req.method()} ${endpoint}`);
    if (mode === "down")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "INTERNAL_ERROR" } },
      });
    if (state.delayCatalogue && endpoint === "/public/catalog/products")
      await new Promise((resolve) => setTimeout(resolve, 1000));
    return route.fulfill({ json: success(records(endpoint)) });
  });
  return state;
}
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("main h1")).toContainText("Built on trust");
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`Home layouts and real-contract previews at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await fixture(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: width < 700 ? 900 : 1024 });
    await ready(page);
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator(".home-product-card")).toHaveCount(4);
    await expect(page.locator(".home-vehicle-card")).toHaveCount(2);
    await page.locator(".home-vehicle-card").first().scrollIntoViewIfNeeded();
    await expect(page.locator(".home-vehicle-card").first().locator("img")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".home-vehicle-card")
          .first()
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(page.locator(".home-product-card").first()).toContainText("₦12,500.50");
    await expect(page.locator(".home-product-card").nth(1)).toContainText(
      "Currently out of stock",
    );
    await expect(page.locator(".home-product-card").last()).toContainText("₦0.00");
    await expect(page.locator(".home-vehicle-card").first()).toContainText("0 km");
    await expect(
      page.locator(".home-vehicle-card").nth(1).locator(".home-vehicle-specs li"),
    ).toHaveCount(0);
    for (const selector of [
      ".home-services",
      ".partner-layout",
      ".home-vehicles",
      ".home-shop",
      ".services-journey",
      ".home-faq",
    ]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await noOverflow(page);
    }
    await page
      .locator(".home-vehicles")
      .screenshot({ path: path.join(os.tmpdir(), `home-oct-${width}-vehicles.png`) });
    await page
      .locator(".home-services")
      .screenshot({ path: path.join(os.tmpdir(), `home-oct-${width}-services.png`) });
    await page
      .locator(".home-shop")
      .screenshot({ path: path.join(os.tmpdir(), `home-oct-${width}-shop.png`) });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(os.tmpdir(), `home-oct-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `home-oct-${width}-full.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(
      state.reads.filter((p) => p.startsWith("/public/") && !p.includes("/images/")),
    ).toEqual([]);
    for (const seed of [
      "/public/catalog/products?limit=4",
      "/public/vehicles?limit=2",
      "/public/services?limit=3",
      "/public/support/reviews?limit=3",
    ])
      expect(serverReads.filter((read) => read === `/api/v1${seed}`)).toHaveLength(1);
  });
}
test("carousel, keyboard, FAQ and navigation perform their advertised actions", async ({
  page,
}) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect(page.getByRole("button", { name: "Pause slideshow" })).toHaveCount(0);
  await page.getByRole("button", { name: "Next slide", exact: true }).click();
  await expect(page.locator("main h1")).toContainText("Find the car");
  await page.getByRole("button", { name: "Next slide", exact: true }).press("ArrowRight");
  await expect(page.locator("main h1")).toContainText("Built for every");
  await page.getByRole("button", { name: "Show slide 4: Visit the Shop" }).click();
  await expect(page.locator(".hero-copy .button").first()).toHaveAttribute(
    "href",
    "/parts",
  );
  await page.getByRole("button", { name: "Next slide", exact: true }).click();
  await expect(page.locator("main h1")).toContainText("Built on trust");
  await page
    .locator("main")
    .getByText("Where is Allied AutoTech?", { exact: true })
    .click();
  await expect(page.locator("details[open]")).toContainText("beside Kilimanjaro");
  await expect(page.locator("details[open] a")).toHaveAttribute(
    "href",
    /google.com\/maps\/dir/,
  );
  await page
    .locator(".home-product-card")
    .first()
    .getByRole("link", { name: "View product: Engine air filter" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/parts/${product.id}`));
});
test("empty collections retain useful contact and browsing paths", async ({ page }) => {
  mode = "empty";
  await fixture(page);
  await ready(page);
  await expect(page.locator(".partner-links a")).toHaveCount(3);
  await expect(page.locator(".home-feedback")).toBeVisible();
  await expect(page.getByRole("link", { name: "View all reviews" })).toHaveAttribute(
    "href",
    "/reviews",
  );
  await expect(
    page.getByText("No customer reviews have been published yet."),
  ).toBeVisible();
  await expect(
    page.locator(".home-product-card, .home-vehicle-card, .review-card"),
  ).toHaveCount(0);
});
test("four independent seed failures recover through their actual public APIs", async ({
  page,
}) => {
  mode = "down";
  const state = await fixture(page);
  await ready(page);
  await expect
    .poll(
      () =>
        state.reads.filter((p) => p.startsWith("/public/") && !p.includes("/images/"))
          .length,
    )
    .toBe(4);
  await expect(
    page.getByRole("button", { name: "Retry services", exact: true }),
  ).toBeVisible();
  mode = "normal";
  state.delayCatalogue = true;
  for (const name of [
    "Retry services",
    "Retry vehicles",
    "Retry products",
    "Retry customer feedback",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    if (name === "Retry products") {
      await expect(page.getByText("Loading products…", { exact: true })).toBeVisible();
      await expect(page.locator(".home-shop .home-preview-loading")).toHaveCount(4);
    }
  }
  await expect(page.locator(".home-product-card")).toHaveCount(4);
  await expect(page.locator(".home-vehicle-card")).toHaveCount(2);
  await expect(page.locator(".service-discovery__item")).toHaveCount(3);
  expect(
    state.reads.filter((p) => p.startsWith("/public/") && !p.includes("/images/")),
  ).toHaveLength(8);
});
test("published reviews refresh with a busy state and retain their real ratings", async ({
  page,
}) => {
  mode = "reviews";
  const state = await fixture(page);
  await ready(page);
  await expect(page.locator(".home-feedback .review-card")).toHaveCount(3);
  await expect(
    page.locator(
      '.home-reviews-slide[data-active="true"] [aria-label="3 out of 5 stars"]',
    ),
  ).toBeVisible();
  state.delayReviews = true;
  await page.getByRole("button", { name: "Refresh customer feedback" }).click();
  await expect(
    page.getByRole("button", { name: "Refresh customer feedback" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Refresh customer feedback" }),
  ).toBeEnabled();
  await page
    .locator(".home-feedback")
    .screenshot({ path: path.join(os.tmpdir(), "home-oct-reviews.png") });
});
test("broken media and long API content remain usable at 320px", async ({ page }) => {
  mode = "long";
  const state = await fixture(page);
  state.failImage = true;
  await page.setViewportSize({ width: 320, height: 900 });
  await ready(page);
  await page.locator(".home-vehicles").scrollIntoViewIfNeeded();
  await expect(
    page.locator(".home-vehicle-card").first().getByText("Image unavailable"),
  ).toBeVisible();
  await noOverflow(page);
  await page.locator(".home-services").scrollIntoViewIfNeeded();
  await noOverflow(page);
});
test("Home passes the scoped automated accessibility check", async ({ page }) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const report = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});

test("mobile menu, touch carousel and paused autoplay remain usable", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.getByRole("button", { name: "Pause slideshow", exact: true }).click();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(7200);
  await expect(page.locator("main h1")).toContainText("Built on trust");
  const hero = page.locator(".home-hero");
  await hero.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 300,
    clientY: 400,
  });
  await hero.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 90,
    clientY: 410,
  });
  await expect(page.locator("main h1")).toContainText("Find the car");
  await page.getByRole("button", { name: "Play slideshow", exact: true }).click();
  await page.mouse.move(1, 1);
  await expect(page.locator("main h1")).toContainText("Built for every", {
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
});
