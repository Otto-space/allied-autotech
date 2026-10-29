import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";
import { demoId } from "../fixtures/discovery-demo.mjs";
import { workProductsFixture, productCategories } from "../fixtures/work-products";
import { verifyConsole } from "../fixtures/preview-console";

// Rendering/interaction fixtures only. PostgreSQL integration tests establish
// actual search, validation, routing, persistence and permission behaviour.
let server: Server;
let mode: "populated" | "empty" | "error" | "no-fitment" = "populated";
let posted: Record<string, unknown>[] = [];
let account: "guest" | "customer" = "guest";
const success = (data: unknown) => ({
  success: true,
  data,
  message: "Isolated UI fixture",
  meta: { requestId: "shop-r2-ui" },
});
test.beforeAll(async () => {
  await mkdir(path.join(os.tmpdir(), "allied-shop-vehicles-r2"), { recursive: true });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        success(
          discoveryResponse(new URL(req.url ?? "/", "http://127.0.0.1:5021"), mode),
        ),
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(5021, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(async ({ page }) => {
  mode = "populated";
  posted = [];
  account = "guest";
  page.setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    // Initial hosted SSR may include genuine public imagery. Allow only its GET;
    // account data and every mutation remain inside the isolated fixture.
    if (
      req.method() === "GET" &&
      /^\/api\/v1\/public\/(?:vehicles\/images|media\/images)\/[a-f0-9-]{36}$/.test(
        url.pathname,
      )
    )
      return route.continue();
    if (url.pathname.endsWith("/auth/session"))
      return account === "customer"
        ? route.fulfill({
            json: success({
              id: demoId(700),
              mfaRequired: false,
              mfaVerifiedAt: null,
              expiresAt: "2027-01-01T00:00:00Z",
              idleExpiresAt: "2027-01-01T00:00:00Z",
              user: {
                id: demoId(701),
                role: "CUSTOMER",
                email: "synthetic@example.test",
              },
            }),
          })
        : route.fulfill({
            status: 401,
            json: { success: false, error: { code: "UNAUTHORIZED" } },
          });
    if (req.method() === "POST") {
      expect(url.pathname).toBe("/api/v1/public/support/enquiries");
      posted.push(req.postDataJSON());
      return route.fulfill({
        status: 201,
        json: success({
          id: demoId(900),
          status: "OPEN",
          createdAt: "2026-10-25T11:00:00.000Z",
        }),
      });
    }
    if (mode === "error")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    const data = discoveryResponse(url, mode);
    return route.fulfill(
      data
        ? { json: success(data) }
        : { status: 404, json: { success: false, error: { code: "NOT_FOUND" } } },
    );
  });
});
async function contactDetails(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("Synthetic Test Customer");
  await page.getByLabel("Email address", { exact: true }).fill("synthetic@example.test");
  await expect(page.locator("output#support-branch")).toBeVisible();
}
async function healthy(page: Page, name: string, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator("main h1")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: path.join(
      os.tmpdir(),
      "allied-shop-vehicles-r2",
      `${name}-${width}-viewport.png`,
    ),
  });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-shop-vehicles-r2", `${name}-${width}.png`),
    fullPage: true,
  });
}
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`Shop and Vehicles render and operate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "warning") {
        warnings.push(message.text());
        return;
      }
      if (
        ["error", "warning"].includes(message.type()) &&
        !(
          message.location().url.includes("/auth/session") &&
          message.text().includes("401")
        ) &&
        !(
          message.type() === "warning" &&
          /^The resource http:\/\/127\.0\.0\.1:\d+\/_next\/static\/css\/[^ ]+\.css was preloaded using link preload but not used within a few seconds/.test(
            message.text(),
          )
        )
      )
        errors.push(message.text());
    });
    await page.goto("/parts");
    await expect(
      page.getByRole("heading", {
        name: "Find the right parts",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Search by part name or number", exact: true }),
    ).toBeChecked();
    const modeBounds = await page
      .getByRole("radio", { name: "Search by part name or number", exact: true })
      .boundingBox();
    expect(modeBounds?.height).toBeLessThanOrEqual(24);
    expect(modeBounds?.width).toBeLessThanOrEqual(24);
    // Hosted SSR correctly contains real empty data. Trigger a client search to
    // exercise isolated populated rendering without changing production data.
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("DEMO");
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .press("Enter");
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByLabel("Product family", { exact: true }).selectOption("ENGINE_OIL");
    await expect(page.getByLabel("Viscosity grade", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Part condition", { exact: true })).not.toBeVisible();
    await page.getByLabel("Viscosity grade", { exact: true }).selectOption("5W-30");
    await page.getByLabel("Pack volume", { exact: true }).selectOption("1000");
    await page
      .getByRole("group", { name: "Budget (NGN)", exact: true })
      .getByLabel("Minimum", { exact: true })
      .fill("10000");
    await page
      .getByRole("group", { name: "Budget (NGN)", exact: true })
      .getByLabel("Maximum", { exact: true })
      .fill("50000");
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/family=ENGINE_OIL/);
    await expect(page.getByRole("button", { name: /Remove .*5W-30/ })).toBeVisible();
    const footerHref = await page
      .locator('.product-contact a[href^="/contact?"]')
      .getAttribute("href");
    expect(footerHref).toContain("part_minPriceKobo=1000000");
    expect(footerHref).toContain("part_maxPriceKobo=5000000");
    const whatsapp = new URL(
      (await page
        .locator('.product-contact a[href^="https://wa.me/"]')
        .getAttribute("href"))!,
    );
    expect(whatsapp.searchParams.get("text")).toMatch(/Maximum budget:.*50,000/);
    await healthy(page, "shop", width);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page
      .getByLabel("Product family", { exact: true })
      .selectOption("REPLACEMENT_PART");
    await expect(page.getByLabel("Viscosity grade", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).not.toHaveURL(/oilViscosityGrade|packVolumeMl/);
    await page.goto("/vehicles");
    // Populated local SSR opens the filters; empty hosted SSR leaves them closed.
    const controls = page.locator(".catalogue-controls");
    if ((await controls.getAttribute("open")) === null)
      await page.getByText("Search and vehicle preferences", { exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Search vehicles", exact: true })
      .fill("Toyota Corolla");
    await page
      .getByRole("searchbox", { name: "Search vehicles", exact: true })
      .press("Enter");
    await page.evaluate(() =>
      history.pushState(
        null,
        "",
        "/vehicles?search=Toyota+Corolla&conditions=FOREIGN_USED&maxPriceKobo=1500000000",
      ),
    );
    await expect(page.locator(".vehicle-card")).toHaveCount(1);
    await healthy(page, "vehicles", width);
    await verifyConsole(page, errors, warnings);
  });
}
test("oil preferences retain both budgets through review and the submission contract", async ({
  page,
}) => {
  await page.goto(
    "/contact?parts=1&part_search=engine+oil&part_family=ENGINE_OIL&part_oilViscosityGrade=5W-30&part_packVolumeMl=1000&part_minPriceKobo=1000000&part_maxPriceKobo=5000000#enquiry",
  );
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("PRODUCT");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Product enquiry: engine oil",
  );
  const message = page.locator("#support-opening");
  await expect(message).toHaveValue(/Minimum budget:.*10,000/);
  await expect(message).toHaveValue(/Maximum budget:.*50,000/);
  await contactDetails(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send this enquiry?", exact: true });
  await expect(dialog).toContainText("5W-30");
  await expect(dialog).toContainText("50,000");
  await expect(
    dialog.getByRole("button", { name: "Go back", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ type: "PRODUCT", branchId: demoId(1) });
  expect(posted[0].message).toMatch(/Minimum budget:.*10,000/);
  expect(posted[0].message).toMatch(/Maximum budget:.*50,000/);
});
test("Vehicle requirements preserve Corolla, condition and budget through review and submission", async ({
  page,
}) => {
  await page.goto(
    "/contact?vehicle=1&vehicle_search=Toyota+Corolla&vehicle_conditions=FOREIGN_USED&vehicle_maxPriceKobo=1500000000#enquiry",
  );
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("VEHICLE");
  await expect(page.getByRole("radio", { name: /requirements/i })).toBeChecked();
  await expect(page.locator("#support-opening")).toHaveValue(/Foreign used/);
  await expect(page.locator("#support-opening")).toHaveValue(/15,000,000/);
  await contactDetails(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Toyota Corolla");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeVisible();
  expect(posted[0]).toMatchObject({
    type: "VEHICLE",
    vehicleEnquiryIntent: "REQUIREMENTS",
    branchId: demoId(1),
  });
  expect(posted[0]).not.toHaveProperty("vehicleListingId");
});

test("a verified public listing stays a listing enquiry with its reference and preferences", async ({
  page,
}) => {
  await page.goto(
    `/contact?vehicle=1&vehicle_listingId=${demoId(200)}&vehicle_maxPriceKobo=1500000000#enquiry`,
  );
  await expect(
    page.getByRole("radio", { name: "Ask about a listed vehicle", exact: true }),
  ).toBeChecked();
  await expect(page.locator("#support-opening")).toHaveValue(/illustrative listing 1/);
  await page.getByLabel("Your name", { exact: true }).fill("Synthetic Listing Customer");
  await page.getByLabel("Email address", { exact: true }).fill("listing@example.test");
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("15,000,000");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeVisible();
  expect(posted[0]).toMatchObject({
    type: "VEHICLE",
    vehicleEnquiryIntent: "LISTING",
    vehicleListingId: demoId(200),
  });
});
test("both draft choices preserve separate edited drafts across reload, resume and equivalent URLs", async ({
  page,
}) => {
  await page.goto("/contact?parts=1&part_search=engine+oil#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Edited oil draft");
  await page.locator("#support-opening").fill("Keep this exact oil message separately.");
  await page.goto("/contact?vehicle=1&vehicle_search=Toyota+Corolla#enquiry");
  await expect(
    page.getByRole("heading", { name: "You have an unsent enquiry", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep current draft", exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await page.reload();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await expect(
    page.getByRole("button", { name: "Keep current draft", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Start pending enquiry", exact: true }).click();
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("VEHICLE");
  await page.getByLabel("Subject", { exact: true }).fill("Edited Corolla draft");
  await page.getByRole("button", { name: /Resume Product enquiry: engine oil/ }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await expect(page.locator("#support-opening")).toHaveValue(
    "Keep this exact oil message separately.",
  );
  await page
    .getByRole("button", { name: /Resume Vehicle enquiry: Toyota Corolla/ })
    .click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited Corolla draft",
  );
  await page.goto("/contact?vehicle_search=Toyota+Corolla&vehicle=1#enquiry");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited Corolla draft",
  );
  expect(posted).toHaveLength(0);
});
test("starting the different enquiry keeps the current draft, and unavailable listings never become requirements", async ({
  page,
}) => {
  await page.goto("/contact?parts=1&part_search=brake+pads#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Preserved brake draft");
  await page.goto("/contact?vehicle=1&vehicle_search=Honda#enquiry");
  await page.getByRole("button", { name: "Start this enquiry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Resume Product enquiry: brake pads/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Resume Product enquiry: brake pads/ }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Preserved brake draft",
  );
  await page.goto("/contact?vehicle=1&vehicle_listingId=invalid#enquiry");
  await page.getByRole("button", { name: "Start this enquiry", exact: true }).click();
  await expect(page.getByText(/This listing could not be verified/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review enquiry", exact: true }),
  ).not.toBeVisible();
});

test("budget errors retain the draft, focus the invalid field and return keyboard focus on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/parts");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const budget = page.getByRole("group", { name: "Budget (NGN)", exact: true });
  await budget.getByLabel("Minimum", { exact: true }).fill("50000");
  await budget.getByLabel("Maximum", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    budget.getByText("Must not be below the minimum price.", { exact: true }),
  ).toBeVisible();
  await expect(budget.getByLabel("Maximum", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await expect(page).not.toHaveURL(/PriceKobo/);
});
test("empty, no-match and API error states stay distinct and retry recovers", async ({
  page,
}) => {
  mode = "empty";
  await page.goto("/parts");
  // Hosted SSR reads the real public catalogue. A client query must trigger the
  // intercepted empty fixture before asserting a synthetic global-empty state.
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("SyntheticEmptyCatalogue");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "No products are published yet", exact: true }),
  ).toBeVisible();
  mode = "populated";
  // A newly populated catalogue is a separate dataset, so reload its global
  // availability check before asserting a filtered no-match response.
  await page.reload();
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("NoSyntheticMatch");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "No matching products", exact: true }),
  ).toBeVisible();
  mode = "error";
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("DifferentSyntheticQuery");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Products could not be loaded.", exact: true }),
  ).toBeVisible();
  mode = "populated";
  await page.getByRole("button", { name: "Retry products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching products", exact: true }),
  ).toBeVisible();
});

test("a superseded pending search shows loading and cannot replace the newer result", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/public/catalog/products/discovery?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("search") === "SyntheticSlow")
      await gate;
    await route.fallback().catch(() => {});
  });
  try {
    await page.goto("/parts");
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("SyntheticSlow");
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .press("Enter");
    await expect(page.locator(".product-results")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Loading products…", { exact: true })).toBeVisible();
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("DEMO");
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .press("Enter");
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
    release();
    await expect(
      page.getByRole("searchbox", { name: "Search products", exact: true }),
    ).toHaveValue("DEMO");
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
  } finally {
    release();
  }
});

test("a category-only zero result is distinguished from global emptiness and a constrained no-match", async ({
  page,
}) => {
  await page.route("**/api/v1/public/catalog/products/discovery?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("categoryId") === demoId(10))
      return route.fulfill({ json: success({ items: [], totalMatches: 0 }) });
    return route.fallback();
  });
  await page.goto("/parts");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("DEMO");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(page.locator(".shop-product-card")).toHaveCount(12);
  await page.evaluate(
    (id) => history.pushState(null, "", `/parts?categoryId=${id}`),
    demoId(10),
  );
  await expect(
    page.getByRole("heading", { name: "No products in this category", exact: true }),
  ).toBeVisible();
});
test("explicit Newest overrides the query default and survives history and reload", async ({
  page,
}) => {
  await page.goto("/parts");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("DEMO");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("best_match");
  await page.getByLabel("Sort by", { exact: true }).selectOption("newest");
  await expect(page).toHaveURL(/sort=newest/);
  await page.getByLabel("Sort by", { exact: true }).selectOption("price_asc");
  await page.goBack();
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("newest");
  await page.goForward();
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("price_asc");
  await page.reload();
  await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("price_asc");
});
test("identity changes do not copy another principal's enquiry fields", async ({
  page,
}) => {
  await page.goto("/contact?parts=1&part_search=engine+oil#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Guest-only edited subject");
  await page.getByLabel("Your name", { exact: true }).fill("Guest-only synthetic name");
  account = "customer";
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Product enquiry: engine oil",
  );
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
  expect(posted).toHaveLength(0);
});
test("unavailable draft storage protects the mounted edited form when the context changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Synthetic storage failure", "QuotaExceededError");
    };
  });
  await page.goto("/contact?parts=1&part_search=engine+oil#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Unsaved oil message");
  await expect(page.getByText(/Browser draft storage is unavailable/)).toBeVisible();
  await page.evaluate(() =>
    history.pushState(null, "", "/contact?vehicle=1&vehicle_search=Toyota#enquiry"),
  );
  await expect(
    page.getByRole("button", { name: "Start this enquiry", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep current draft", exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Unsaved oil message",
  );
  expect(posted).toHaveLength(0);
});
test("admin records oil grade and explicit volume through review while shared product types remain editable", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page, "SUPER_ADMIN");
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic labelled engine oil");
  await page.getByLabel("URL name", { exact: true }).fill("synthetic-labelled-oil");
  await page.getByLabel("SKU", { exact: true }).fill("SYN-OIL-R2");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(productCategories[1].id);
  await page
    .getByLabel("Product type (optional)", { exact: true })
    .fill("EXISTING_SHARED_TYPE");
  await page
    .getByLabel("Product family (optional)", { exact: true })
    .selectOption("ENGINE_OIL");
  await page
    .getByLabel("Recorded viscosity grade (optional)", { exact: true })
    .fill("5W30");
  await page.getByLabel("Pack volume in ml (optional)", { exact: true }).fill("1000");
  await expect(
    page.getByLabel("Condition (optional)", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Selling price (NGN)", { exact: true }).fill("25000");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("5W-30");
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({
    family: "ENGINE_OIL",
    oilViscosityGrade: "5W-30",
    packVolumeMl: 1000,
    condition: null,
    classification: null,
  });
});
