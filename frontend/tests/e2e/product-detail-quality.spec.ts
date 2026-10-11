import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { product, id, branch } from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_PRODUCT_DETAIL_TESTS !== "true",
  "Requires isolated product SSR fixture",
);
const port = Number(process.env.PRODUCT_DETAIL_FIXTURE_PORT ?? 5021);
const routePath = `/parts/${product.id}`;
const record = {
  ...product,
  name: "Premium oil filter",
  brand: "Denso",
  manufacturerPartNumber: "15601-37010",
  sku: "OF-001",
  priceKobo: "2510000",
  compareAtPriceKobo: "2800000",
  category: { ...product.category, name: "Filters" },
  description:
    "A replacement oil filter for the listed vehicle applications. Confirm the part number before ordering.",
  images: [20, 21, 22].map((n) => ({
    id: id(n),
    url: `/api/v1/public/catalog/products/images/${id(n)}`,
    altText: `QA product photo ${n - 19}`,
    isPrimary: n === 20,
  })),
  compatibilities: [
    {
      id: id(30),
      make: "Toyota",
      model: "Camry",
      yearFrom: 2020,
      yearTo: 2025,
      notes: "Confirm the part number before ordering.",
    },
  ],
  availability: [{ branch: { ...branch, name: "Port Harcourt" }, inStock: true }],
};
const success = (data: unknown) => ({
  success: true,
  message: "QA response",
  data,
  meta: { requestId: "product-detail-qa" },
});
let server: Server;
let mode = "normal";
let delay = 0;
let calls: string[] = [];
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    calls.push(url.pathname + url.search);
    const respond = () => {
      let data: unknown;
      let status = 200;
      if (url.pathname === "/api/v1/public/catalog/products") {
        if (mode === "relatedDown") status = 503;
        else
          data = {
            items:
              mode === "empty"
                ? []
                : [record, { ...record, id: id(40), name: "Replacement air filter" }],
          };
      } else if (
        url.pathname === `/api/v1/public/catalog/products/${product.id}` &&
        !["missing", "down"].includes(mode)
      ) {
        const item = structuredClone(record);
        if (mode === "empty") {
          item.images = [];
          item.compatibilities = [];
          item.availability = [];
        }
        if (mode === "out") item.availability[0].inStock = false;
        if (mode === "wrong") item.id = id(99);
        if (mode === "long") {
          item.name = "LongProductName".repeat(24);
          item.description = "LongDescription".repeat(100);
          item.availability[0].branch.name = "LongBranchName".repeat(30);
          item.priceKobo = "999999999999999999";
          item.compatibilities[0].make = "LongMake".repeat(30);
        }
        data = item;
      } else status = mode === "down" ? 503 : 404;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          status === 200
            ? success(data)
            : { success: false, error: { code: "NOT_FOUND" }, meta: { requestId: "qa" } },
        ),
      );
    };
    if (delay && url.pathname === "/api/v1/public/catalog/products")
      setTimeout(respond, delay);
    else respond();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(() => {
  mode = "normal";
  delay = 0;
  calls = [];
});
async function setup(page: Page, role = "CUSTOMER", photos = true) {
  const writes: { path: string; body: unknown; csrf?: string }[] = [];
  const state = {
    status: 200,
    slow: 0,
    offline: false,
    wrong: false,
    role,
    sessionStatus: role === "ANONYMOUS" ? 401 : 200,
    sessionDelay: 0,
  };
  await page.route("**/api/v1/auth/session", async (r) => {
    if (state.sessionDelay)
      await new Promise((resolve) => setTimeout(resolve, state.sessionDelay));
    return r.fulfill({
      status: state.sessionStatus,
      json:
        state.sessionStatus !== 200
          ? { success: false, error: { code: "UNAUTHORIZED" }, meta: { requestId: "qa" } }
          : success({
              id: id(60),
              user: { id: id(61), email: "product-qa@example.test", role: state.role },
              mfaRequired: false,
              mfaVerifiedAt: null,
              expiresAt: "2099-01-01T00:00:00Z",
              idleExpiresAt: "2099-01-01T00:00:00Z",
            }),
    });
  });
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({ json: success({ csrfToken: "s".repeat(64) }) }),
  );
  await page.route("**/api/v1/public/catalog/products/images/*", (r) =>
    photos
      ? r.fulfill({
          path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
          contentType: "image/webp",
        })
      : r.fulfill({ status: 404, body: "Unavailable" }),
  );
  await page.route("**/api/v1/customers/**", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: success({ items: [] }) });
    const url = new URL(r.request().url()).pathname;
    const body = r.request().postDataJSON();
    writes.push({ path: url, body, csrf: r.request().headers()["x-csrf-token"] });
    if (state.slow) await new Promise((resolve) => setTimeout(resolve, state.slow));
    if (state.offline) return r.abort("internetdisconnected");
    const receipt = url.includes("/cart/")
      ? {
          subtotalKobo: String(BigInt(record.priceKobo) * BigInt(body.quantity)),
          items: [
            {
              id: id(70),
              quantity: body.quantity,
              unitPriceKobo: record.priceKobo,
              lineSubtotalKobo: String(BigInt(record.priceKobo) * BigInt(body.quantity)),
              product: record,
            },
          ],
        }
      : { product: record };
    return r.fulfill({
      status: state.status,
      json:
        state.status === 200
          ? success(state.wrong ? {} : receipt)
          : {
              success: false,
              error: {
                code:
                  state.status === 429
                    ? "RATE_LIMITED"
                    : state.status === 401
                      ? "SESSION_EXPIRED"
                      : state.status === 403
                        ? "FORBIDDEN"
                        : state.status === 409
                          ? "CONFLICT"
                          : "VALIDATION_FAILED",
                fields: { "body.quantity": ["invalid"] },
              },
              meta: { requestId: "qa" },
            },
    });
  });
  return { writes, state };
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`responsive ${width}`, async ({ page }) => {
    await setup(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(routePath);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", { name: record.name, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText(record.name);
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveCSS(
      "border-top-width",
      "1px",
    );
    await expect(page.locator(".pd-related-item")).toHaveCount(1);
    expect(
      calls.some((value) => value.includes(`categoryId=${record.category.id}`)),
    ).toBe(true);
    await axe(page);
    await page.screenshot({
      path: path.join(os.tmpdir(), `product-detail-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `product-detail-${width}-full.png`),
      fullPage: true,
    });
    if ([390, 1536].includes(width)) {
      for (const [name, selector] of [
        ["purchase", ".pd-purchase"],
        ["details", ".pd-details-grid"],
        ["ordering", ".pd-ordering"],
        ["related", ".pd-related"],
      ]) {
        const section = page.locator(selector);
        const height = (await section.boundingBox())!.height;
        await page.setViewportSize({
          width,
          height: Math.max(1024, Math.ceil(height) + 300),
        });
        await section.evaluate((element) =>
          window.scrollTo({
            top: element.getBoundingClientRect().top + window.scrollY - 150,
            behavior: "instant",
          }),
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await section.screenshot({
          path: path.join(os.tmpdir(), `product-detail-${width}-${name}.png`),
        });
      }
    }
    expect(errors).toEqual([]);
  });
test("gallery arrows, thumbnails, modal keyboard and focus restoration", async ({
  page,
}) => {
  await setup(page);
  await page.goto(routePath);
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page.getByText("Photo 2 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View photos", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(bounds.x - (viewport.width - bounds.width) / 2)).toBeLessThan(2);
  expect(Math.abs(bounds.y - (viewport.height - bounds.height) / 2)).toBeLessThan(2);
  await page.keyboard.press("End");
  await expect(dialog.getByText("Photo 3 of 3", { exact: true })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(dialog.getByText("Photo 1 of 3", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close photos" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /Show photo 3/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close photos" })).toBeFocused();
  await axe(page);
  await page.screenshot({ path: path.join(os.tmpdir(), "product-detail-modal.png") });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View photos", exact: true }),
  ).toBeFocused();
});
test("quantity validation, confirmed receipts, duplicate guard and favourites", async ({
  page,
}) => {
  const { writes, state } = await setup(page);
  await page.goto(routePath);
  const quantity = page.getByLabel("Quantity", { exact: true });
  const submit = page.getByRole("button", { name: "Save quantity to cart" });
  for (const value of ["0", "1.5", "1001", ""]) {
    await quantity.fill(value);
    await submit.click();
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
  }
  expect(writes).toHaveLength(0);
  await quantity.fill("3");
  state.slow = 500;
  await submit.dblclick();
  await expect(page.getByRole("dialog", { name: "Cart updated" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close cart summary" })).toBeFocused();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ quantity: 3 });
  expect(writes[0].csrf).toBeTruthy();
  await page.getByRole("button", { name: "Continue shopping" }).click();
  await page.getByRole("button", { name: "Save to favourites", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product saved", exact: true }),
  ).toBeFocused();
  expect(writes[1].body).toEqual({});
  await expect(page.locator(".pd-feedback a")).toHaveAttribute(
    "href",
    "/dashboard/saved",
  );
  await expect(
    page.getByRole("button", { name: "Saved to favourites", exact: true }),
  ).toBeDisabled();
  await axe(page);
  await page.screenshot({ path: path.join(os.tmpdir(), "product-detail-success.png") });
});
for (const role of ["ANONYMOUS", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} receives account guidance without shopping controls`, async ({
    page,
  }) => {
    const { writes } = await setup(page, role);
    await page.goto(routePath);
    await expect(page.locator(".pd-access")).toContainText(
      role === "ANONYMOUS"
        ? "A customer account is required"
        : "Shopping actions are available to customer accounts",
    );
    await expect(page.getByRole("button", { name: "Save quantity to cart" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Save to favourites", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveCount(0);
    await expect(
      page.locator(".pd-actions").getByRole("link", { name: "View cart", exact: true }),
    ).toHaveCount(0);
    if (role === "ANONYMOUS")
      await expect(
        page.locator(".pd-access").getByRole("link", { name: "Sign in to continue" }),
      ).toHaveAttribute("href", `/login?next=${encodeURIComponent(routePath)}`);
    else
      await expect(
        page.locator(".pd-access").getByRole("link", { name: "Go to dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
    await expect(
      page.locator(".pd-access").getByRole("link", { name: "Ask our team" }),
    ).toHaveAttribute("href", "/contact#enquiry");
    expect(writes).toEqual([]);
    await axe(page);
    await page
      .locator(".pd-purchase")
      .screenshot({ path: path.join(os.tmpdir(), `product-detail-access-${role}.png`) });
  });
}
test("checking and failed account reads hide mutations until retry succeeds", async ({
  page,
}) => {
  const { state, writes } = await setup(page);
  state.sessionDelay = 900;
  state.sessionStatus = 503;
  await page.goto(routePath);
  await expect(page.locator(".pd-access")).toContainText("Checking your account");
  await expect(page.getByRole("button", { name: "Save quantity to cart" })).toHaveCount(
    0,
  );
  const retry = page.getByRole("button", { name: "Retry account check" });
  await expect(retry).toBeVisible();
  await axe(page);
  state.sessionStatus = 200;
  state.sessionDelay = 0;
  await retry.click();
  await expect(page.getByRole("button", { name: "Save quantity to cart" })).toBeEnabled();
  expect(writes).toEqual([]);
});
test("fresh mutation preflight refuses a changed role and session events refresh access", async ({
  page,
}) => {
  const { state, writes } = await setup(page);
  await page.goto(routePath);
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
  state.role = "ADMIN";
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.locator(".pd-access")).toContainText(
    "Shopping actions are available to customer accounts",
  );
  expect(writes).toEqual([]);
  state.role = "CUSTOMER";
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
});
test("product navigation, part identifiers, single mobile price and delivery guidance", async ({
  page,
}) => {
  await setup(page);
  await page.goto(routePath);
  await expect(page.locator(".pd-identifiers")).toContainText("15601-37010");
  const nav = page.getByRole("navigation", { name: "Product sections" });
  await nav.getByRole("link", { name: "Compatibility", exact: true }).click();
  await expect(page).toHaveURL(/#product-compatibility$/);
  await expect(
    page.getByRole("heading", { name: "Vehicle compatibility" }),
  ).toBeInViewport();
  await nav.getByRole("link", { name: "Delivery", exact: true }).click();
  await expect(page).toHaveURL(/#product-delivery$/);
  const collection = page.locator(".pd-ordering-faq summary").first();
  await collection.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pd-ordering-faq details").first()).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".pd-ordering-faq")).toContainText("beside Kilimanjaro");
  await page.locator(".pd-ordering-faq summary").nth(1).click();
  await expect(
    page.getByText(/Checkout shows the currently available delivery areas/),
  ).toBeVisible();
  await axe(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator(".pd-mobile-price")).toBeVisible();
  await expect(page.locator(".pd-mobile-price del")).toContainText("28,000");
  await expect(page.locator(".pd-purchase > .pd-price-row")).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
});
test("failure states retain quantity and never claim success", async ({ page }) => {
  const { state } = await setup(page);
  await page.goto(routePath);
  await page.getByLabel("Quantity", { exact: true }).fill("4");
  for (const status of [409, 422, 429, 403, 500]) {
    state.status = status;
    await page.getByRole("button", { name: "Save quantity to cart" }).click();
    await expect(page.locator(".pd-feedback[role=alert]")).toBeVisible();
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("4");
    await expect(page.locator("#quantity-error")).toHaveText(
      "Check this field and enter a valid value.",
    );
    await expect(page.getByLabel("Quantity", { exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: "Cart updated" })).toHaveCount(0);
  }
  state.status = 200;
  state.wrong = true;
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.getByRole("heading", { name: "Update not confirmed" })).toBeFocused();
  state.wrong = false;
  state.offline = true;
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.getByRole("heading", { name: "Update not confirmed" })).toBeVisible();
});
test("account change discards pending result and quantity", async ({ page }) => {
  const { state, writes } = await setup(page);
  state.slow = 1400;
  await page.goto(routePath);
  await page.getByLabel("Quantity", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect.poll(() => writes.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  await page.waitForTimeout(1600);
  await expect(page.getByRole("heading", { name: "Cart updated" })).toHaveCount(0);
  await axe(page);
});
test("missing media, compatibility, stock and related empty states", async ({ page }) => {
  mode = "empty";
  await setup(page);
  await page.goto(routePath);
  await expect(page.getByText("Photos not available", { exact: true })).toBeVisible();
  await expect(page.getByText(/Compatibility has not been listed/)).toBeVisible();
  await expect(page.getByText(/Availability has not been listed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save quantity to cart" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save to favourites", exact: true }),
  ).toBeEnabled();
  await axe(page);
  mode = "out";
  await page.reload();
  await expect(page.getByText(/Currently unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save quantity to cart" }),
  ).toBeDisabled();
});
test("long records, failed image and reduced motion remain usable", async ({ page }) => {
  mode = "long";
  await setup(page, "CUSTOMER", false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(routePath);
  await expect(
    page.getByText("This photo is unavailable", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
  await axe(page);
  await page.screenshot({
    path: path.join(os.tmpdir(), "product-detail-long.png"),
    fullPage: true,
  });
});
test("SSR errors, retry, missing identity and related failure", async ({ page }) => {
  await setup(page);
  mode = "down";
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: "Product details are temporarily unavailable" }),
  ).toBeVisible();
  mode = "normal";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: record.name, exact: true }),
  ).toBeVisible();
  mode = "missing";
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: "This product is unavailable" }),
  ).toBeVisible();
  mode = "wrong";
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: "Product details are temporarily unavailable" }),
  ).toBeVisible();
  mode = "relatedDown";
  await page.goto(routePath);
  await expect(
    page.getByText(/Other products are temporarily unavailable/),
  ).toBeVisible();
});
test("structured product/breadcrumb data and related loading", async ({
  page,
  request,
}) => {
  await setup(page);
  delay = 1200;
  await page.goto(routePath, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: record.name, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pd-related-item")).toHaveCount(1);
  const json = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
  );
  expect(json["@graph"][0]["@type"]).toBe("BreadcrumbList");
  expect(json["@graph"][1].offers.price).toBe("25100.00");
  await page.goto(routePath + "?preview=1");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  mode = "missing";
  expect(
    (await request.get(routePath, { headers: { "user-agent": "Twitterbot" } })).status(),
  ).toBe(404);
  mode = "wrong";
  expect(
    (await request.get(routePath, { headers: { "user-agent": "Twitterbot" } })).status(),
  ).toBe(500);
});
test("mobile touch gallery, short viewport and quantity keyboard", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 640 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await setup(page);
    await page.goto(routePath);
    const surface = page.locator(".pd-gallery > div").first();
    await surface.evaluate((element) => {
      const start = new Touch({
        identifier: 1,
        target: element,
        clientX: 300,
        clientY: 350,
      });
      const end = new Touch({
        identifier: 1,
        target: element,
        clientX: 100,
        clientY: 350,
      });
      element.dispatchEvent(
        new TouchEvent("touchstart", { bubbles: true, touches: [start] }),
      );
      element.dispatchEvent(
        new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }),
      );
    });
    await expect(page.getByText("Photo 2 of 3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View photos", exact: true }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close photos", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "View photos", exact: true }),
    ).toBeFocused();
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Close cart summary", exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    await axe(page);
  } finally {
    await context.close();
  }
});
