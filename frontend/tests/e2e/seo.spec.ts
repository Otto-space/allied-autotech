import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

// Dedicated loopback fixture: the standalone app must use BACKEND_ORIGIN=http://127.0.0.1:5011.
test.skip(
  process.env.RUN_SEO_SERVER_TESTS !== "true",
  "Requires the isolated SEO server fixture configuration",
);
const id = (n: number) => `a9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const origin = "https://allied.example";
const branch = {
  id: id(10),
  code: "TEST",
  name: "Test branch",
  city: "Port Harcourt",
  state: "Rivers",
};
const product = {
  id: id(1),
  name: "Synthetic part",
  slug: "synthetic-part",
  sku: "TEST-SEO",
  brand: null,
  manufacturerPartNumber: null,
  description: "Published part description for isolated verification.",
  priceKobo: "9007199254740993",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: { id: id(11), name: "Test category", slug: "test", description: null },
  images: [],
  compatibilities: [],
  availability: [{ branch, inStock: true }],
};
const service = {
  id: id(2),
  name: "Synthetic service",
  slug: "synthetic-service",
  description: "Published service description for isolated verification.",
  shortDescription: null,
  pricingType: "QUOTE_REQUIRED",
  priceKobo: null,
  currency: "NGN",
  durationMinutes: null,
  version: 0,
};
const listing = {
  id: id(3),
  title: "Synthetic vehicle",
  slug: "synthetic-vehicle",
  description: "Published vehicle description for isolated verification.",
  priceKobo: "5000000000",
  currency: "NGN",
  branch,
  vehicle: {
    id: id(12),
    make: "Test",
    model: "Model",
    trim: null,
    year: 2020,
    mileageKm: 100,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    condition: "USED",
    bodyType: "SEDAN",
    color: null,
    images: [],
    conditionReports: [],
  },
};
const publicReview = {
  id: id(4),
  targetType: "BUSINESS",
  rating: 4,
  title: "Published test review",
  comment: "Published feedback <script>window.__reviewInjection = true</script>",
  createdAt: "2026-09-17T10:00:00Z",
  product: null,
  service: null,
  customer: { firstName: "PRIVATE CUSTOMER" },
  moderationNote: "PRIVATE MODERATION",
  status: "APPROVED",
};
let server: Server | undefined;
let mode = "normal";
const calls: { path: string; headers: IncomingHttpHeaders }[] = [];
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1:5011");
    calls.push({ path: url.pathname + url.search, headers: req.headers });
    let data: unknown;
    let status = 200;
    const sources = [
      { api: "/api/v1/public/catalog/products", record: product },
      { api: "/api/v1/public/services", record: service },
      { api: "/api/v1/public/vehicles", record: listing },
      { api: "/api/v1/public/support/reviews", record: publicReview },
    ];
    const source = sources.find(
      (item) => url.pathname === item.api || url.pathname.startsWith(`${item.api}/`),
    );
    if (
      mode === "outage" ||
      (mode === "partsDown" && url.pathname.includes("catalog/products")) ||
      (mode === "reviewsDown" && url.pathname.includes("support/reviews"))
    )
      status = 503;
    else if (source && url.pathname === source.api) {
      data = {
        items: [{ ...source.record, internalNote: "PRIVATE INTERNAL FIELD" }],
        ...(url.searchParams.has("cursor") ? {} : { nextCursor: id(20) }),
      };
      if (url.searchParams.has("cursor"))
        data = {
          items: [{ ...source.record, id: id(Number(source.record.id.slice(-2)) + 30) }],
        };
      if (mode === "cycle") data = { items: [], nextCursor: id(20) };
      if (mode === "empty") data = { items: [] };
      if (mode === "malformed") data = { items: [{ id: "invalid" }] };
    } else if (source && url.pathname === `${source.api}/${source.record.id}`) {
      data = mode === "wrongIdentity" ? { ...source.record, id: id(90) } : source.record;
    } else status = 404;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        status === 200
          ? {
              success: true,
              message: "Retrieved",
              data,
              meta: { requestId: "seo-fixture" },
            }
          : {
              success: false,
              message: "PRIVATE FIXTURE DETAIL",
              error: { code: status === 404 ? "NOT_FOUND" : "UNAVAILABLE" },
            },
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(5011, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server!.closeAllConnections();
      server!.close(() => resolve());
    });
});
test.beforeEach(() => {
  mode = "normal";
  calls.length = 0;
});

for (const route of [
  "/",
  "/services",
  "/parts",
  "/vehicles",
  "/contact",
  "/help",
  "/reviews",
]) {
  test(`public canonical and social metadata for ${route}`, async ({ request }) => {
    const response = await request.get(route, {
      headers: { "X-Forwarded-Host": "attacker.invalid" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`rel="canonical" href="${origin}${route}"`);
    expect(html).toContain(`property="og:url" content="${origin}${route}"`);
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain("attacker.invalid");
    expect(response.headers()["x-robots-tag"]).toBeUndefined();
  });
}
test("query URLs retain a clean canonical and are not indexed", async ({ request }) => {
  const response = await request.get("/parts?search=test&cursor=anything");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
  const html = await response.text();
  expect(html).toContain(`rel="canonical" href="${origin}/parts"`);
  expect(html).toMatch(/name="robots" content="noindex, follow"/);
});
for (const route of [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/mfa",
  "/dashboard",
  "/admin",
  "/staff/accept-invitation",
  "/payments/complete",
]) {
  test(`private and account route excludes indexing: ${route}`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers()["cache-control"]).toContain("no-store");
    const html = await response.text();
    expect(html).not.toContain('rel="canonical"');
  });
}
for (const [route, title, description] of [
  [`/parts/${id(1)}`, product.name, product.description],
  [`/services/${id(2)}`, service.name, service.description],
  [`/vehicles/${id(3)}`, listing.title, listing.description],
]) {
  test(`public detail exists without JavaScript: ${route}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByText(description, { exact: true })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${origin}${route}`,
      );
      await expect(page).toHaveTitle(new RegExp(title));
      expect(
        calls.filter((call) => call.path.endsWith(route.split("/").at(-1)!)),
      ).toHaveLength(1);
    } finally {
      await context.close();
    }
  });
}
test("SSR requests do not forward browser credentials", async ({ request }) => {
  await request.get(`/parts/${id(1)}`, {
    headers: {
      Cookie: "synthetic_session=test-only",
      Authorization: "Bearer synthetic-test-only",
    },
  });
  expect(calls).toHaveLength(1);
  expect(calls[0].headers.cookie).toBeUndefined();
  expect(calls[0].headers.authorization).toBeUndefined();
});
for (const route of ["/parts/not-a-uuid", `/services/${id(80)}`, `/vehicles/${id(81)}`]) {
  test(`missing detail returns crawler 404 and noindex: ${route}`, async ({
    request,
  }) => {
    const response = await request.get(route, {
      headers: { "User-Agent": "Twitterbot" },
    });
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain("find that page");
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).not.toContain('rel="canonical"');
  });
}
for (const failure of ["outage", "wrongIdentity"]) {
  test(`failed detail remains unavailable, not a published record: ${failure}`, async ({
    request,
  }) => {
    mode = failure;
    const response = await request.get(`/parts/${id(1)}`, {
      headers: { "User-Agent": "Twitterbot" },
    });
    expect(response.status()).toBe(500);
    const html = await response.text();
    expect(html).not.toContain(product.description);
    expect(html).not.toContain("PRIVATE FIXTURE DETAIL");
    expect(html).toContain("noindex");
  });
}
test("robots and complete sitemap use configured origin and published IDs", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).toContain(`${origin}/parts/${id(31)}`);
  expect(xml).toContain(`${origin}/services/${id(32)}`);
  expect(xml).toContain(`${origin}/vehicles/${id(33)}`);
  expect(xml).not.toContain("lastmod");
  expect(xml).not.toContain("dashboard");
  expect(calls).toHaveLength(6);
});
test("a broken sitemap scan reports temporary failure without partial URLs", async ({
  request,
}) => {
  mode = "cycle";
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(503);
  expect(response.headers()["retry-after"]).toBe("60");
  expect(await response.text()).toBe("Sitemap temporarily unavailable.");
});
test("business schema contains supplied facts and a CSP nonce", async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Retrieved",
        data: { items: [] },
        meta: { requestId: "seo-fixture" },
      },
    }),
  );
  await page.goto("/");
  const schema = page.locator('script[type="application/ld+json"]');
  const value = JSON.parse((await schema.textContent())!);
  expect(value).toMatchObject({
    "@type": "AutoRepair",
    telephone: "+2348136075567",
    url: `${origin}/`,
  });
  expect(value).not.toHaveProperty("aggregateRating");
  expect(await schema.evaluate((node) => (node as HTMLScriptElement).nonce)).not.toBe("");
});
for (const width of [320, 1280]) {
  test(`server-rendered part remains accessible and navigable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Retrieved",
          data: { items: [] },
          meta: { requestId: "seo-fixture" },
        },
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (entry.type() === "error") errors.push(entry.text());
    });
    await page.goto(`/parts/${id(1)}`);
    await expect(page).toHaveURL(`/parts/${id(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-seo-part-${width}.png`),
    });
    await page.getByRole("link", { name: /Ask about compatibility/ }).click();
    await expect(page).toHaveURL("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("vehicle");
    expect(errors).toEqual([]);
  });
}
test("public review content reloads after another tab changes the session", async ({
  page,
}) => {
  await page.route("**/api/v1/public/support/reviews?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Retrieved",
        data: { items: [] },
        meta: { requestId: "session-reload" },
      },
    }),
  );
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: publicReview.title })).toBeVisible();
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(
    page.getByText("No published reviews match this page and filters."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh reviews" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: publicReview.title })).toHaveCount(0);
});
test("one failed homepage preview does not erase the other published sections", async ({
  browser,
}) => {
  mode = "partsDown";
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/`);
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: service.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: listing.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
    await expect(page.getByText(/No parts are published yet/)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

const publicCollections = [
  {
    route: "/services",
    api: "/public/services",
    row: service,
    title: service.name,
    label: "Service type",
    value: "FIXED",
    button: undefined,
  },
  {
    route: "/parts",
    api: "/public/catalog/products",
    row: product,
    title: product.name,
    label: "Search parts",
    value: "filter",
    button: "Search parts",
  },
  {
    route: "/vehicles",
    api: "/public/vehicles",
    row: listing,
    title: listing.title,
    label: "Search vehicles",
    value: "filter",
    button: "Find vehicles",
  },
  {
    route: "/reviews",
    api: "/public/support/reviews",
    row: publicReview,
    title: publicReview.title,
    label: "Review type",
    value: "PRODUCT",
    button: undefined,
  },
];
for (const collection of publicCollections) {
  test(`empty and malformed SSR results stay distinct: ${collection.route}`, async ({
    request,
  }) => {
    mode = "empty";
    const empty = await request.get(collection.route, {
      headers: { "User-Agent": "Twitterbot" },
    });
    const emptyHtml = await empty.text();
    expect(emptyHtml).not.toContain("temporarily unavailable");
    expect(emptyHtml).toContain(
      collection.route === "/reviews"
        ? "No published reviews match"
        : collection.route === "/services"
          ? "Services are not listed yet"
          : collection.route === "/parts"
            ? "No parts are listed yet"
            : "No vehicles are listed yet",
    );
    mode = "malformed";
    const malformed = await request.get(collection.route, {
      headers: { "User-Agent": "Twitterbot" },
    });
    const html = await malformed.text();
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });
  test(`public collection is readable without JavaScript: ${collection.route}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const response = await page.goto(
        `${process.env.PLAYWRIGHT_BASE_URL}${collection.route}`,
      );
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: collection.title, exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Enable JavaScript to filter/)).toBeVisible();
      const html = await page.content();
      expect(html).not.toContain("PRIVATE INTERNAL FIELD");
      expect(html).not.toContain("PRIVATE CUSTOMER");
      expect(html).not.toContain("PRIVATE MODERATION");
      expect(
        calls.filter((call) => call.path.startsWith(`/api/v1${collection.api}?`)),
      ).toHaveLength(1);
    } finally {
      await context.close();
    }
  });
  test(`seeded collection filters, pages and resets without a duplicate initial read: ${collection.route}`, async ({
    page,
  }) => {
    const reads: URL[] = [];
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      let data: unknown = { items: [] };
      if (url.pathname === `/api/v1${collection.api}`) {
        reads.push(url);
        const title = url.searchParams.has("cursor")
          ? "Second page result"
          : "Updated first page";
        data = {
          items: [{ ...collection.row, name: title, title }],
          ...(url.searchParams.has("cursor") ? {} : { nextCursor: id(20) }),
        };
      }
      return route.fulfill({
        json: {
          success: true,
          message: "Retrieved",
          data,
          meta: { requestId: "public-seed" },
        },
      });
    });
    await page.goto(collection.route);
    await expect(
      page.getByRole("heading", { name: collection.title, exact: true }),
    ).toBeVisible();
    if (collection.button) {
      await page.getByLabel(collection.label, { exact: true }).fill(collection.value);
      expect(reads).toHaveLength(0);
      await page.getByRole("button", { name: collection.button, exact: true }).click();
    } else {
      expect(reads).toHaveLength(0);
      await page
        .getByLabel(collection.label, { exact: true })
        .selectOption(collection.value);
    }
    await expect(
      page.getByRole("heading", { name: "Updated first page", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: collection.title, exact: true }),
    ).toHaveCount(0);
    expect(
      reads[0].searchParams.get(
        collection.button
          ? "search"
          : collection.route === "/reviews"
            ? "targetType"
            : "pricingType",
      ),
    ).toBe(collection.value);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Second page result", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Updated first page", exact: true }),
    ).toBeVisible();
    if (collection.button)
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    else await page.getByLabel(collection.label, { exact: true }).selectOption("");
    await expect.poll(() => reads.length).toBe(4);
    expect(reads.at(-1)?.searchParams.has("cursor")).toBe(false);
    expect(
      reads
        .at(-1)
        ?.searchParams.has(
          collection.button
            ? "search"
            : collection.route === "/reviews"
              ? "targetType"
              : "pricingType",
        ),
    ).toBe(false);
  });
  test(`unavailable public collection is not an empty catalogue: ${collection.route}`, async ({
    request,
  }) => {
    mode = "outage";
    const response = await request.get(collection.route, {
      headers: { "User-Agent": "Twitterbot" },
    });
    const html = await response.text();
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain("PRIVATE FIXTURE DETAIL");
    expect(html).not.toContain("No published reviews match");
    expect(html).not.toContain("No parts are listed yet");
    expect(html).not.toContain("No vehicles are listed yet");
    expect(html).not.toContain("Services are not listed yet");
  });
}
test("homepage previews are server rendered and omit API-only fields", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/`);
    for (const name of [service.name, product.name, listing.title])
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    expect(await page.content()).not.toContain("PRIVATE INTERNAL FIELD");
    await expect(page.getByRole("heading", { name: publicReview.title })).toBeVisible();
    expect(await page.content()).not.toContain("PRIVATE CUSTOMER");
    expect(await page.content()).not.toContain("PRIVATE MODERATION");
    expect(calls).toHaveLength(4);
  } finally {
    await context.close();
  }
});
test("failed review refresh hides withdrawn content and recovers through explicit refresh", async ({
  page,
}) => {
  let unavailable = true;
  await page.route("**/api/v1/public/support/reviews?*", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          json: {
            success: false,
            message: "PRIVATE",
            error: { code: "DATABASE_UNAVAILABLE" },
          },
        })
      : route.fulfill({
          json: {
            success: true,
            message: "Retrieved",
            data: { items: [] },
            meta: { requestId: "recovery" },
          },
        }),
  );
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: publicReview.title })).toBeVisible();
  expect(await page.evaluate(() => "__reviewInjection" in window)).toBe(false);
  await page.getByRole("button", { name: "Refresh reviews" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: publicReview.title })).toHaveCount(0);
  await expect(
    page.getByText("No published reviews match this page and filters."),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  unavailable = false;
  await page.getByRole("button", { name: "Refresh reviews" }).click();
  await expect(
    page.getByText("No published reviews match this page and filters."),
  ).toBeVisible();
});
for (const width of [320, 1280]) {
  test(`server-rendered discovery and review layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Retrieved",
          data: { items: [] },
          meta: { requestId: "public-seed" },
        },
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (entry.type() === "error") errors.push(entry.text());
    });
    for (const collection of publicCollections) {
      await page.goto(collection.route);
      await expect(page).toHaveURL(collection.route);
      await expect(
        page.getByRole("heading", { name: collection.title, exact: true }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (collection.route === "/reviews" && width === 320) {
        const nextButton = page.getByRole("button", { name: "Next", exact: true });
        await nextButton.focus();
        await nextButton.scrollIntoViewIfNeeded();
        const next = await nextButton.boundingBox();
        const help = await page.getByRole("button", { name: "Quick help" }).boundingBox();
        expect(next).not.toBeNull();
        expect(help).not.toBeNull();
        expect(next!.y + next!.height).toBeLessThanOrEqual(help!.y);
      }
      await page.screenshot({
        path: path.join(
          os.tmpdir(),
          `allied-discovery-${collection.route.slice(1)}-${width}.png`,
        ),
      });
    }
    expect(errors).toEqual([]);
  });
}

test("homepage feedback hydrates without another read or anonymous solicitation", async ({
  page,
}) => {
  let clientReads = 0;
  await page.route("**/api/v1/public/support/reviews?*", (route) => {
    clientReads += 1;
    return route.fulfill({
      json: {
        success: true,
        message: "Retrieved",
        data: { items: [publicReview] },
        meta: { requestId: "home-review" },
      },
    });
  });
  await page.goto("/");
  const section = page.getByRole("region", { name: "Customer feedback", exact: true });
  await expect(section.getByRole("heading", { name: publicReview.title })).toBeVisible();
  await expect(section.getByRole("link", { name: "View all reviews" })).toHaveAttribute(
    "href",
    "/reviews",
  );
  await expect(
    section.getByRole("button", { name: "Refresh customer feedback" }),
  ).toBeEnabled();
  expect(clientReads).toBe(0);
  expect(
    calls.filter((call) => call.path === "/api/v1/public/support/reviews?limit=3"),
  ).toHaveLength(1);
  expect(await page.evaluate(() => "__reviewInjection" in window)).toBe(false);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await section.getByRole("button", { name: "Refresh customer feedback" }).click();
  await expect.poll(() => clientReads).toBe(1);
});

test("homepage feedback distinguishes empty, failed refresh and recovery", async ({
  page,
}) => {
  mode = "empty";
  let unavailable = false;
  await page.route("**/api/v1/public/support/reviews?*", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        })
      : route.fulfill({
          json: {
            success: true,
            message: "Retrieved",
            data: { items: [publicReview] },
            meta: { requestId: "home-review" },
          },
        }),
  );
  await page.goto("/");
  const section = page.getByRole("region", { name: "Customer feedback", exact: true });
  await expect(
    section.getByText("No customer reviews have been published yet."),
  ).toBeVisible();
  await section.getByRole("button", { name: "Refresh customer feedback" }).click();
  await expect(section.getByRole("heading", { name: publicReview.title })).toBeVisible();
  unavailable = true;
  await section.getByRole("button", { name: "Refresh customer feedback" }).click();
  await expect(section.getByRole("alert")).toBeVisible();
  await expect(section.getByRole("heading", { name: publicReview.title })).toHaveCount(0);
  await expect(
    section.getByText("No customer reviews have been published yet."),
  ).toHaveCount(0);
  unavailable = false;
  await section.getByRole("button", { name: "Retry customer feedback" }).click();
  await expect(section.getByRole("heading", { name: publicReview.title })).toBeVisible();
});

test("homepage review outage preserves other content and offers honest recovery", async ({
  page,
}) => {
  mode = "reviewsDown";
  await page.route("**/api/v1/public/support/reviews?*", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
    }),
  );
  await page.goto("/");
  const section = page.getByRole("region", { name: "Customer feedback", exact: true });
  await expect(section.getByRole("alert")).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Retry customer feedback" }),
  ).toBeEnabled();
  for (const name of [service.name, product.name, listing.title])
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
});
