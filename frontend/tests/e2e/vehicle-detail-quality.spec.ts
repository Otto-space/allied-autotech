import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";

// Dedicated SSR fixture. Run a standalone preview with BACKEND_ORIGIN pointing here.
test.skip(
  process.env.RUN_VEHICLE_DETAIL_TESTS !== "true",
  "Requires the isolated detail SSR fixture",
);
const port = Number(process.env.VEHICLE_DETAIL_FIXTURE_PORT ?? 5021);
const id = (n: number) => `f9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const routePath = `/vehicles/${id(1)}`;
const photoPath = path.resolve("public/images/allied-autotech/showroom-editorial.webp");
const record = {
  id: id(1),
  title: "Toyota Camry — isolated QA",
  slug: "qa-camry",
  priceKobo: "1100000000",
  currency: "NGN",
  description: "Synthetic listing description for isolated page verification.",
  branch: {
    id: id(2),
    code: "QA",
    name: "Port Harcourt QA branch",
    city: "Port Harcourt",
    state: "Rivers",
  },
  vehicle: {
    id: id(3),
    make: "Toyota",
    model: "Camry",
    trim: "LE",
    year: 2021,
    mileageKm: 13000,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    condition: "USED",
    bodyType: "SEDAN",
    color: "Silver",
    engineSize: "2.5 L",
    driveType: "FWD",
    doors: 4,
    seats: 5,
    images: [4, 5, 6, 7].map((n) => ({
      id: id(n),
      url: `/api/v1/public/vehicles/images/${id(n)}`,
      altText: `QA vehicle view ${n - 3}`,
      isPrimary: n === 4,
    })),
    conditionReports: [
      {
        id: id(8),
        summary:
          "Synthetic condition report. Inspect the published details before arranging a visit.",
        inspectedAt: "2026-09-22T10:00:00Z",
        odometerKm: 13000,
        conditionScore: 82,
      },
    ],
  },
};
const success = (data: unknown) => ({
  success: true,
  message: "QA response",
  data,
  meta: { requestId: "vehicle-detail-qa" },
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
      if (url.pathname === "/api/v1/public/vehicles" && mode !== "relatedDown") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            success({
              items:
                mode === "empty"
                  ? []
                  : [
                      record,
                      { ...record, id: id(20), title: "Toyota Corolla — isolated QA" },
                    ],
            }),
          ),
        );
        return;
      }
      if (
        url.pathname === `/api/v1/public/vehicles/${id(1)}` &&
        !["down", "missing"].includes(mode)
      ) {
        const data = structuredClone(record);
        if (mode === "empty") {
          data.vehicle.images = [];
          data.vehicle.conditionReports = [];
        }
        if (mode === "wrongIdentity") data.id = id(99);
        if (mode === "long") {
          data.title = "Toyota " + "Long vehicle description ".repeat(12);
          data.branch.name = "Very long branch name ".repeat(10);
          data.priceKobo = "9999999999999999";
          data.description = "LongUnbrokenDescription".repeat(40);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(success(data)));
        return;
      }
      res.writeHead(["down", "relatedDown"].includes(mode) ? 503 : 404, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: "NOT_FOUND" },
          message: "Private diagnostic must never appear",
          meta: { requestId: "qa" },
        }),
      );
    };
    if (delay && url.pathname === "/api/v1/public/vehicles") setTimeout(respond, delay);
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
async function browserSetup(page: Page, role = "CUSTOMER", photoStatus = 200) {
  const writes: { path: string; body: unknown; csrf: string | undefined }[] = [];
  const state = { status: 200, slow: 0, offline: false };
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill({
      status: role === "ANONYMOUS" ? 401 : 200,
      json:
        role === "ANONYMOUS"
          ? { success: false, error: { code: "UNAUTHORIZED" }, meta: { requestId: "qa" } }
          : success({
              user: { id: id(50), email: "vehicle-qa@example.test", role },
              id: id(51),
              mfaRequired: false,
              mfaVerifiedAt: null,
              expiresAt: "2099-01-01T00:00:00Z",
              idleExpiresAt: "2099-01-01T00:00:00Z",
            }),
    }),
  );
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({ json: success({ csrfToken: "x".repeat(48) }) }),
  );
  await page.route("**/api/v1/public/vehicles/images/*", (r) =>
    photoStatus === 200
      ? r.fulfill({ path: photoPath, contentType: "image/webp" })
      : r.fulfill({ status: 404, body: "Unavailable" }),
  );
  await page.route("**/api/v1/customers/**", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: success({ items: [] }) });
    writes.push({
      path: new URL(r.request().url()).pathname,
      body: r.request().postDataJSON(),
      csrf: r.request().headers()["x-csrf-token"],
    });
    if (state.slow) await new Promise((resolve) => setTimeout(resolve, state.slow));
    if (state.offline) return r.abort("internetdisconnected");
    return r.fulfill({
      status: state.status,
      json:
        state.status === 200
          ? success({ id: id(60) })
          : {
              success: false,
              error: {
                code:
                  state.status === 429
                    ? "RATE_LIMITED"
                    : state.status === 403
                      ? "FORBIDDEN"
                      : state.status === 409
                        ? "CONFLICT"
                        : "VALIDATION_FAILED",
                fields: { "body.preferredStartAt": ["invalid"] },
              },
              meta: { requestId: "qa" },
            },
    });
  });
  return { writes, state };
}
async function open(page: Page) {
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: record.title, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`vehicle detail responsive and accessible at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 960 });
    await browserSetup(page);
    await open(page);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('ol [aria-current="page"]'),
    ).toHaveText(record.title);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const specs = page.locator(".vd-specs");
    await expect(specs).toContainText("Automatic");
    await expect(specs).toContainText("LE");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicle-detail-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `vehicle-detail-quality-${width}-full.png`),
      fullPage: true,
    });
    if ([390, 768, 1440, 1536].includes(width)) {
      for (const part of ["details", "inspection", "related"]) {
        const section = page.locator(".vd-" + part);
        const box = await section.boundingBox();
        await page.setViewportSize({
          width,
          height: Math.max(960, Math.ceil(box!.height) + 300),
        });
        await section.evaluate((el) =>
          window.scrollTo({
            top: el.getBoundingClientRect().top + scrollY - 150,
            behavior: "instant",
          }),
        );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        await section.screenshot({
          path: path.join(
            os.tmpdir(),
            "vehicle-detail-quality-" + width + "-" + part + ".png",
          ),
        });
      }
    }
    expect(errors).toEqual([]);
  });
}
test("gallery supports arrows, selection, modal Escape and focus restoration", async ({
  page,
}) => {
  await browserSetup(page);
  await open(page);
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page.getByText("Photo 2 of 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View photos", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close photos" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("Photo 3 of 4", { exact: true })).toBeVisible();
  await page.keyboard.press("End");
  await expect(dialog.getByText("Photo 4 of 4", { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: path.join(os.tmpdir(), "vehicle-detail-gallery.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View photos", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
test("requests send real contracts, prevent duplicates and focus confirmations", async ({
  page,
}) => {
  const { state, writes } = await browserSetup(page);
  await open(page);
  state.slow = 500;
  await page.getByRole("button", { name: "Save vehicle", exact: true }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Vehicle saved", exact: true }),
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Enquire about this vehicle", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeFocused();
  await page.locator(".vd-inspection-link").click();
  await expect(page.locator("#vd-inspection-title")).toBeFocused();
  await page.getByRole("button", { name: "Request inspection", exact: true }).click();
  await expect(
    page.getByLabel("Preferred date and time", { exact: false }),
  ).toBeFocused();
  await expect(page.locator("#inspection-time-error")).toBeVisible();
  expect(writes).toHaveLength(2);
  await page
    .getByLabel("Preferred date and time", { exact: false })
    .fill("2099-10-01T10:30");
  await page.getByLabel("Notes (optional)").fill(" Please check the interior. ");
  await page.getByRole("button", { name: "Request inspection", exact: true }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Inspection requested", exact: true }),
  ).toBeFocused();
  expect(writes).toHaveLength(3);
  expect(writes[0].body).toEqual({});
  expect(writes[1].body).toEqual({ vehicleListingId: id(1) });
  expect(writes[2].body).toEqual({
    vehicleListingId: id(1),
    preferredStartAt: "2099-10-01T09:30:00.000Z",
    notes: "Please check the interior.",
  });
  expect(writes.every((w) => w.csrf?.length === 48)).toBe(true);
  await expect(page.getByText(/preferred time is not confirmed yet/)).toBeVisible();
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicle-detail-inspection-success.png"),
  });
});
test("anonymous and operator requests fail before mutation", async ({ page }) => {
  let f = await browserSetup(page, "ANONYMOUS");
  await open(page);
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(routePath)}`,
  );
  expect(f.writes).toHaveLength(0);
  await page.unrouteAll();
  f = await browserSetup(page, "STAFF");
  await page.reload();
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByText(/available to customer accounts/)).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("failed inspection keeps values, relates field errors and handles uncertain responses", async ({
  page,
}) => {
  const { state, writes } = await browserSetup(page);
  await open(page);
  await page
    .getByLabel("Preferred date and time", { exact: false })
    .fill("2099-10-01T10:30");
  await page.getByLabel("Notes (optional)").fill("Keep these notes");
  state.status = 422;
  await page.getByRole("button", { name: "Request inspection", exact: true }).click();
  await expect(page.locator("#inspection-time-error")).toBeVisible();
  await expect(page.getByLabel("Notes (optional)")).toHaveValue("Keep these notes");
  await expect(
    page.getByLabel("Preferred date and time", { exact: false }),
  ).toHaveAttribute("aria-invalid", "true");
  state.status = 429;
  await page.getByRole("button", { name: "Request inspection", exact: true }).click();
  await expect(page.locator(".vd-feedback[role=alert]")).toContainText(
    /wait|many|later/i,
  );
  state.offline = true;
  await page.getByRole("button", { name: "Request inspection", exact: true }).click();
  await expect(page.locator(".vd-feedback[role=alert]")).toContainText(
    "Check your account before submitting again",
  );
  expect(writes).toHaveLength(3);
});
test("account change discards private draft and stale success", async ({ page }) => {
  const { state } = await browserSetup(page);
  await open(page);
  state.slow = 900;
  await page.getByLabel("Notes (optional)").fill("Private draft");
  await page
    .getByRole("button", { name: "Enquire about this vehicle", exact: true })
    .click();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByLabel("Notes (optional)")).toHaveValue("");
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enquire about this vehicle", exact: true }),
  ).toBeEnabled();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.waitForTimeout(1100);
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toHaveCount(0);
});
test("missing media and reports stay honest; failed photos use fallback", async ({
  page,
}) => {
  mode = "empty";
  await browserSetup(page);
  await open(page);
  await expect(page.getByText("Photos not available", { exact: true })).toBeVisible();
  await expect(page.getByText(/No condition report is published/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View photos", exact: true }),
  ).toHaveCount(0);
  mode = "normal";
  await page.unrouteAll();
  await browserSetup(page, "CUSTOMER", 404);
  await page.reload();
  await expect(
    page.getByText("This photo is unavailable", { exact: true }),
  ).toBeVisible();
});
test("long data and reduced-motion short mobile viewport remain usable", async ({
  page,
}) => {
  mode = "long";
  await page.setViewportSize({ width: 360, height: 560 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await browserSetup(page);
  await page.goto(routePath);
  await expect(page.locator(".vd-heading h1")).toContainText("Long vehicle");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.locator(".vd-inspection-link").click();
  await expect(page.locator("#vd-inspection-title")).toBeFocused();
  await page
    .getByLabel("Preferred date and time", { exact: false })
    .fill("2099-10-01T10:30");
  await page.screenshot({
    path: path.join(os.tmpdir(), "vehicle-detail-long-mobile.png"),
    fullPage: true,
  });
});
test("server failures, retry, unavailable records and related failures recover", async ({
  page,
  request,
}) => {
  await browserSetup(page);
  mode = "down";
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: "Vehicle details are temporarily unavailable" }),
  ).toBeVisible();
  mode = "normal";
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: record.title, exact: true }),
  ).toBeVisible();
  mode = "missing";
  const missing = await request.get(routePath, {
    headers: { "User-Agent": "Twitterbot" },
  });
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('name="robots" content="noindex"');
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: "This vehicle is unavailable" }),
  ).toBeVisible();
  mode = "relatedDown";
  await page.goto(routePath);
  await expect(
    page.getByRole("heading", { name: record.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Other listings are temporarily unavailable/),
  ).toBeVisible();
});
test("loading, SSR identity and safe structured data", async ({ page, request }) => {
  await browserSetup(page);
  delay = 1000;
  const navigation = page.goto(routePath, { waitUntil: "commit" });
  await navigation;
  await expect(
    page.getByRole("status").filter({ hasText: "Loading related listings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: record.title, exact: true }),
  ).toBeVisible();
  delay = 0;
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
  );
  expect(data["@graph"][0].itemListElement[2].name).toBe(record.title);
  expect(data["@graph"][1].offers.price).toBe("11000000.00");
  expect(calls.filter((c) => c === `/api/v1/public/vehicles/${id(1)}`)).toHaveLength(1);
  mode = "wrongIdentity";
  const invalid = await request.get(routePath, {
    headers: { "User-Agent": "Twitterbot" },
  });
  expect(invalid.status()).toBe(500);
  expect(await invalid.text()).not.toContain("Synthetic listing description");
});

test("touch swipe and modal focus trap work on a short mobile screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await browserSetup(page);
    await open(page);
    const session = await context.newCDPSession(page);
    const box = (await page.locator(".vd-gallery > div").first().boundingBox())!;
    const y = Math.min(650, box.y + box.height / 2);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width - 20, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + 40, y }],
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByText("Photo 2 of 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View photos", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Close photos", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    await dialog.screenshot({
      path: path.join(os.tmpdir(), "vehicle-detail-mobile-gallery.png"),
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "View photos", exact: true }),
    ).toBeFocused();
  } finally {
    await context.close();
  }
});
