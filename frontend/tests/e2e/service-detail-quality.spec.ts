import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import {
  service,
  quoteService,
  branch,
  slot,
  booking,
  policy,
  id,
} from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_SERVICE_DETAIL_TESTS !== "true",
  "Requires isolated service SSR fixture",
);
const port = Number(process.env.SERVICE_DETAIL_FIXTURE_PORT ?? 5021);
const routePath = `/services/${service.id}`;
const record = {
  ...service,
  name: "Vehicle diagnostics",
  shortDescription: "Understand your vehicle’s condition before planning the next step.",
  description:
    "Diagnostics for your vehicle. Our team can discuss the published service details with you.",
  priceKobo: "2510050",
  image: {
    id: id(71),
    url: `/api/v1/public/media/images/${id(71)}`,
    altText: "Isolated workshop photograph",
    width: 1600,
    height: 1000,
  },
};
const currentPolicy = {
  ...policy,
  version: "owner-booking-request-v2",
  minimumAdvanceHours: 168,
  maximumAdvanceHours: 336,
  depositBasisPoints: 0,
  depositRefundableForCustomerCancellation: true,
};
const currentBranch = { ...branch, name: "Port Harcourt" };
const success = (data: unknown) => ({
  success: true,
  message: "Isolated service response",
  data,
  meta: { requestId: "service-detail-test" },
});
let server: Server;
let mode = "normal";
let calls: string[] = [];
function currentRecord() {
  if (mode === "long")
    return {
      ...record,
      name: "LongServiceName".repeat(18),
      description: "LongDescription".repeat(100),
      image: null,
    };
  if (mode === "empty")
    return {
      ...record,
      description: null,
      shortDescription: null,
      image: null,
      priceKobo: "0",
    };
  if (mode === "unbookable") return { ...record, priceKobo: null };
  return record;
}
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    calls.push(url.pathname + url.search);
    if (url.pathname === "/api/v1/public/services") {
      res.writeHead(mode === "otherDown" ? 503 : 200, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify(
          mode === "otherDown"
            ? {
                success: false,
                error: { code: "DATABASE_UNAVAILABLE" },
                meta: { requestId: "qa" },
              }
            : success({
                items:
                  mode === "otherEmpty"
                    ? []
                    : [
                        record,
                        {
                          ...record,
                          id: id(91),
                          name: "Brake assessment",
                          priceKobo: "1800000",
                          durationMinutes: 45,
                        },
                        { ...quoteService, name: "Engine assessment", image: null },
                      ],
              }),
        ),
      );
      return;
    }
    const status = mode === "missing" ? 404 : mode === "down" ? 503 : 200;
    const data = url.pathname.endsWith(quoteService.id)
      ? {
          ...quoteService,
          name: "Engine assessment",
          description:
            "Describe your engine concern so our team can discuss the work required.",
        }
      : mode === "wrong"
        ? { ...record, id: id(99) }
        : currentRecord();
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        status === 200
          ? success(data)
          : { success: false, error: { code: "NOT_FOUND" }, meta: { requestId: "qa" } },
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
  calls = [];
});

async function fixture(page: Page) {
  const state = {
    role: "CUSTOMER",
    slots: "normal",
    policyError: false,
    branchError: false,
    branchEmpty: false,
    post: "normal",
    failImage: false,
    writes: [] as { body: Record<string, unknown>; key?: string; csrf?: string }[],
    browserServiceReads: 0,
    customerReads: [] as string[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const endpoint = url.pathname.replace(/^\/api\/v1/, "");
    if (req.method() === "GET" && endpoint.startsWith("/customers/"))
      state.customerReads.push(endpoint);
    const ok = (data: unknown, status = 200) =>
      route.fulfill({ status, json: success(data) });
    const fail = (status = 503, code = "DATABASE_UNAVAILABLE") =>
      route.fulfill({
        status,
        json: { success: false, error: { code }, meta: { requestId: "qa" } },
      });
    if (endpoint === "/auth/session")
      return state.role === "anonymous"
        ? fail(401, "UNAUTHORIZED")
        : ok({
            id: id(81),
            user: { id: id(80), email: "service@example.test", role: state.role },
            expiresAt: "2027-01-01T00:00:00Z",
            idleExpiresAt: "2027-01-01T00:00:00Z",
            mfaRequired: false,
            mfaVerifiedAt: null,
          });
    if (endpoint === "/auth/csrf") return ok({ csrfToken: "s".repeat(64) });
    if (endpoint.includes("/public/media/images/"))
      return state.failImage
        ? fail(404)
        : route.fulfill({
            path: path.resolve("public/images/allied-autotech/workshop-editorial.webp"),
            contentType: "image/webp",
          });
    if (endpoint === "/public/booking-policy")
      return state.policyError ? fail() : ok(currentPolicy);
    if (endpoint === "/public/branches")
      return state.branchError
        ? fail()
        : ok({ items: state.branchEmpty ? [] : [currentBranch] });
    if (endpoint.endsWith("/slots")) {
      if (state.slots === "down") return fail();
      return ok({
        items:
          state.slots === "empty"
            ? []
            : [
                { ...slot, ...(state.slots === "wrong" ? { branchId: id(99) } : {}) },
                {
                  ...slot,
                  id: id(22),
                  startsAt: "2027-10-02T11:00:00Z",
                  endsAt: "2027-10-02T12:00:00Z",
                },
                {
                  ...slot,
                  id: id(23),
                  startsAt: "2027-10-03T09:00:00Z",
                  endsAt: "2027-10-03T10:00:00Z",
                },
              ],
      });
    }
    if (endpoint === `/public/services/${service.id}`) {
      state.browserServiceReads++;
      return ok(currentRecord());
    }
    if (endpoint === `/public/services/${quoteService.id}`) return ok(quoteService);
    if (endpoint === "/customers/bookings" || endpoint === "/public/support/enquiries") {
      state.writes.push({
        body: req.postDataJSON(),
        key: req.headers()["idempotency-key"],
        csrf: req.headers()["x-csrf-token"],
      });
      if (state.post === "unknown") return route.abort("connectionfailed");
      if (state.post === "conflict") return fail(409, "SLOT_UNAVAILABLE");
      if (endpoint.endsWith("enquiries"))
        return ok({ id: id(90), status: "OPEN", createdAt: "2026-09-30T00:00:00Z" }, 202);
      return ok({
        booking: {
          ...booking,
          service: record,
          branch: currentBranch,
          status: "REQUESTED",
          depositAmountKobo: null,
          paymentHoldExpiresAt: null,
          customerNotes: req.postDataJSON().customerNotes ?? null,
        },
      });
    }
    return ok({ items: [] });
  });
  return state;
}
async function selectBranch(page: Page) {
  await page.getByRole("combobox", { name: "Workshop branch" }).click();
  await page.getByRole("option", { name: "Port Harcourt", exact: true }).click();
}
async function prepare(page: Page) {
  await selectBranch(page);
  await page.locator(".slot").first().click();
}
async function reviewRequest(page: Page) {
  await page.getByRole("button", { name: "Review booking request", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review your booking request", exact: true }),
  ).toBeFocused();
}

async function accessiblePage(page: Page) {
  // Scan the complete document from a stable position. The sticky header can
  // partially cover off-target section links at an arbitrary mid-page scroll.
  // Interaction checks separately verify focus, viewport and pointer access.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`booking review, edit and reference receipt at ${width}px`, async ({
    page,
    context,
  }) => {
    const state = await fixture(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1024 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(routePath);
    await prepare(page);
    const notes = page.getByLabel("What should we know about your vehicle? (optional)");
    await notes.fill("Engine warning light is on.\nPlease investigate.");
    await reviewRequest(page);
    expect(state.writes).toHaveLength(0);
    const review = page.getByRole("region", { name: "Booking request review" });
    await expect(review).toContainText("Engine warning light is on. Please investigate.");
    await expect(review).toContainText("₦25,100.50");
    await expect(review).toContainText("Port Harcourt");
    await expect(page.locator('.sd-booking-progress [aria-current="step"]')).toHaveText(
      "2Review",
    );
    await expect(page.getByRole("combobox", { name: "Workshop branch" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(notes).toHaveValue("Engine warning light is on.\nPlease investigate.");
    await expect(page.locator(".slot").first()).toHaveAttribute("aria-pressed", "true");
    await notes.fill("Engine warning light is on.");
    await reviewRequest(page);
    expect(state.writes).toHaveLength(0);
    await page.locator("#service-request").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `booking-form-${width}-review.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `booking-form-${width}-review-full.png`),
      fullPage: true,
    });
    expect((await accessiblePage(page)).violations).toEqual([]);
    await page.getByRole("button", { name: "Request booking", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Booking request received", exact: true }),
    ).toBeFocused();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body.customerNotes).toBe("Engine warning light is on.");
    expect(state.writes[0].body).not.toHaveProperty("acceptNonRefundableDeposit");
    await expect(page.getByLabel("Booking reference", { exact: true })).toHaveValue(
      booking.id,
    );
    await page.getByRole("button", { name: "Copy booking reference" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(booking.id);
    await expect(page.locator('.sd-booking-progress [aria-current="step"]')).toHaveText(
      "3Received",
    );
    await page.locator("#service-request").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `booking-form-${width}-receipt.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `booking-form-${width}-receipt-full.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await accessiblePage(page)).violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("booking review detects changed policy and requires a fresh review", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(routePath);
  await prepare(page);
  await reviewRequest(page);
  await page.route("**/api/v1/public/booking-policy", (route) =>
    route.fulfill({
      json: success({ ...currentPolicy, version: "updated-booking-policy" }),
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(/The appointment or booking terms have changed/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request booking", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Edit details" }).click();
  await reviewRequest(page);
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  expect(state.writes[0].body.policyVersion).toBe("updated-booking-policy");
});

test("account change discards an unsent booking review and private notes", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(routePath);
  await prepare(page);
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Private reviewed note");
  await reviewRequest(page);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("region", { name: "Booking request review" })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("What should we know about your vehicle? (optional)"),
  ).toHaveValue("");
  await expect(page.getByText("Private reviewed note", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("booking reference supports manual copy when clipboard access fails", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    });
  });
  await page.goto(routePath);
  await prepare(page);
  await reviewRequest(page);
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await page.getByRole("button", { name: "Copy booking reference" }).click();
  const reference = page.getByLabel("Booking reference", { exact: true });
  await expect(reference).toBeFocused();
  expect(
    await reference.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    ),
  ).toBe(booking.id);
  await expect(page.getByText(/Select and copy the value above/)).toBeVisible();
});
async function quoteDraft(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("Service Test");
  await page.getByLabel("Email address", { exact: true }).fill("Service@Example.Test");
  await page.getByLabel("Subject", { exact: true }).fill("Engine assessment enquiry");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please discuss the published service with me.");
  await page.getByRole("combobox", { name: "Handling branch" }).click();
  await page.getByRole("option", { name: "Port Harcourt", exact: true }).click();
}

test("booking server validation returns to preserved notes with an inline error", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/customers/bookings", (route) =>
    route.fulfill({
      status: 422,
      json: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          fields: { "body.customerNotes": ["Invalid notes"] },
        },
        meta: { requestId: "booking-validation" },
      },
    }),
  );
  await page.goto(routePath);
  await prepare(page);
  const notes = page.getByLabel("What should we know about your vehicle? (optional)");
  await notes.fill("Preserve these notes.");
  await reviewRequest(page);
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue("Preserve these notes.");
  await expect(notes).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("region", { name: "Booking request review" })).toHaveCount(
    0,
  );
});

test("booking rate limit preserves the reviewed request and permits editing", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route("**/api/v1/customers/bookings", (route) =>
    route.fulfill({
      status: 429,
      json: {
        success: false,
        error: { code: "RATE_LIMITED" },
        meta: { requestId: "booking-rate-limit" },
      },
    }),
  );
  await page.goto(routePath);
  await prepare(page);
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Keep after rate limit.");
  await reviewRequest(page);
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We couldn’t send your request" }),
  ).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Booking request review" }),
  ).toContainText("Keep after rate limit.");
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(
    page.getByLabel("What should we know about your vehicle? (optional)"),
  ).toHaveValue("Keep after rate limit.");
  expect(state.writes).toHaveLength(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`fixed service layout, keyboard and accessibility at ${width}px`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(routePath);
    await expect(
      page.getByRole("heading", { name: record.name, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText(record.name);
    await expect(page.getByText("₦25,100.50", { exact: true })).toBeVisible();
    await expect(page.locator(".sd-media img")).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), `service-detail-${width}-viewport.png`),
    });
    await page.getByRole("link", { name: "Choose an appointment", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Choose an available appointment." }),
    ).toBeFocused();
    const branch = page.getByRole("combobox", { name: "Workshop branch" });
    await branch.focus();
    await branch.fill("Port");
    await page.keyboard.press("Enter");
    await expect(branch).toHaveValue("Port Harcourt");
    await page.locator(".slot").first().focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".slot").first()).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await accessiblePage(page)).violations).toEqual([]);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), `service-detail-${width}-full.png`),
      fullPage: true,
    });
    expect(state.browserServiceReads).toBe(0);
    expect(errors).toEqual([]);
  });
}
test("request uses current policy, exact notes, CSRF and idempotency; confirmation receives focus", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(routePath);
  await prepare(page);
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Check this\nvehicle.");
  if (
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .click();
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({
    slotId: slot.id,
    policyVersion: currentPolicy.version,
    customerNotes: "Check this vehicle.",
  });
  expect(state.writes[0].key?.length).toBeGreaterThanOrEqual(16);
  expect(state.writes[0].csrf).toBe("s".repeat(64));
  await expect(page.getByText("REQUESTED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View booking", exact: true }),
  ).toHaveAttribute("href", `/dashboard/bookings/${booking.id}`);
  await expect(page.getByText(/Deposit due:/)).toHaveCount(0);
  await page.screenshot({ path: path.join(os.tmpdir(), "service-detail-success.png") });
});
test("unknown booking outcome locks inputs and retries the exact original request", async ({
  page,
}) => {
  const state = await fixture(page);
  state.post = "unknown";
  await page.goto(routePath);
  await prepare(page);
  if (
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .click();
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your request needs checking" }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Edit details" })).toBeDisabled();
  await expect(
    page.getByLabel("What should we know about your vehicle? (optional)"),
  ).toBeDisabled();
  state.post = "normal";
  await page.getByRole("button", { name: "Check the same booking request" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
});
test("anonymous booking review links to sign-in and privileged roles see no customer controls", async ({
  page,
}) => {
  const state = await fixture(page);
  state.role = "anonymous";
  await page.goto(routePath);
  await prepare(page);
  await reviewRequest(page);
  await expect(
    page.getByRole("link", { name: "Sign in to request booking", exact: true }),
  ).toHaveAttribute("href", `/login?next=${encodeURIComponent(routePath)}`);
  await expect(
    page.getByRole("button", { name: "Request booking", exact: true }),
  ).toHaveCount(0);
  for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
    state.role = role;
    await page.reload();
    await expect(page.getByRole("link", { name: "Open your dashboard" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to your dashboard" }),
    ).toHaveAttribute("href", "/admin");
    await expect(page.getByRole("link", { name: "Choose an appointment" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Review booking request" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Load saved vehicles & contact details" }),
    ).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Workshop branch" })).toHaveCount(0);
  }
  expect(state.writes).toHaveLength(0);
  expect(state.customerReads).toEqual([]);
});

test("failed booking access check offers retry without exposing customer actions", async ({
  page,
}) => {
  const state = await fixture(page);
  let unavailable = true;
  await page.route("**/api/v1/auth/session", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.fallback(),
  );
  await page.goto(routePath);
  await expect(page.getByRole("button", { name: "Retry account check" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review booking request" })).toHaveCount(
    0,
  );
  expect(state.customerReads).toEqual([]);
  unavailable = false;
  await page.getByRole("button", { name: "Retry account check" }).click();
  await prepare(page);
  await reviewRequest(page);
  expect(state.writes).toHaveLength(0);
});

test("empty, failed and mismatched appointment reads fail closed with retry", async ({
  page,
}) => {
  const state = await fixture(page);
  state.slots = "down";
  await page.goto(routePath);
  await selectBranch(page);
  await expect(
    page.getByRole("button", { name: "Review booking request", exact: true }),
  ).toBeDisabled();
  state.slots = "wrong";
  await page.getByRole("button", { name: "Retry appointments" }).click();
  await expect(page.locator(".slot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry appointments" })).toBeVisible();
  state.slots = "empty";
  await page.getByRole("button", { name: "Retry appointments" }).click();
  await expect(
    page.getByText(/No appointments are available on this page/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("policy failure blocks request and preserves selected appointment through retry", async ({
  page,
}) => {
  const state = await fixture(page);
  state.policyError = true;
  await page.goto(routePath);
  await prepare(page);
  await expect(
    page.getByRole("button", { name: "Review booking request", exact: true }),
  ).toBeDisabled();
  state.policyError = false;
  await page.getByRole("button", { name: "Retry booking terms" }).click();
  await expect(
    page.getByRole("button", { name: "Review booking request", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".slot").first()).toHaveAttribute("aria-pressed", "true");
});

test("slow branch and appointment reads show loading and cannot submit early", async ({
  page,
}) => {
  await fixture(page);
  let releaseBranch: (() => void) | undefined;
  let releaseSlots: (() => void) | undefined;
  const branchGate = new Promise<void>((resolve) => {
    releaseBranch = resolve;
  });
  const slotGate = new Promise<void>((resolve) => {
    releaseSlots = resolve;
  });
  await page.route("**/api/v1/public/branches?*", async (route) => {
    await branchGate;
    await route.fulfill({ json: success({ items: [currentBranch] }) });
  });
  await page.route("**/api/v1/public/services/*/slots?*", async (route) => {
    await slotGate;
    await route.fulfill({ json: success({ items: [slot] }) });
  });
  try {
    await page.goto(routePath);
    await expect(page.getByRole("combobox", { name: "Workshop branch" })).toBeDisabled();
    await expect(page.getByText("Loading choices…", { exact: true })).toBeVisible();
    releaseBranch?.();
    await selectBranch(page);
    await expect(
      page.getByText("Loading available appointments…", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review booking request", exact: true }),
    ).toBeDisabled();
    releaseSlots?.();
    await page.locator(".slot").click();
    await expect(
      page.getByRole("button", { name: "Review booking request", exact: true }),
    ).toBeEnabled();
  } finally {
    releaseBranch?.();
    releaseSlots?.();
  }
});
test("branch error and empty data remain recoverable", async ({ page }) => {
  const state = await fixture(page);
  state.branchError = true;
  await page.goto(routePath);
  await expect(page.getByRole("combobox", { name: "Workshop branch" })).toBeDisabled();
  state.branchError = false;
  state.branchEmpty = true;
  await page.getByRole("button", { name: "Retry branches" }).click();
  await expect(page.getByText("No branches available on this page.")).toBeVisible();
});

test("branch and appointment pagination preserves identity and clears stale time selection", async ({
  page,
}) => {
  await fixture(page);
  const secondBranch = { ...branch, id: id(62), name: "Second workshop" };
  await page.route("**/api/v1/public/branches?*", (route) => {
    const next = new URL(route.request().url()).searchParams.has("cursor");
    return route.fulfill({
      json: success(
        next ? { items: [secondBranch] } : { items: [currentBranch], nextCursor: id(60) },
      ),
    });
  });
  await page.route("**/api/v1/public/services/*/slots?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: success({
        items: [
          {
            ...slot,
            branchId: q.get("branchId"),
            id: q.has("cursor") ? id(77) : slot.id,
            startsAt: q.has("cursor") ? "2027-10-02T11:00:00Z" : slot.startsAt,
            endsAt: q.has("cursor") ? "2027-10-02T12:00:00Z" : slot.endsAt,
          },
        ],
        ...(!q.has("cursor") ? { nextCursor: id(75) } : {}),
      }),
    });
  });
  await page.goto(routePath);
  await prepare(page);
  const control = page.getByRole("combobox", { name: "Workshop branch" });
  const pages = page.getByRole("navigation", { name: "Branches pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(control).toBeEnabled();
  await expect(control).toHaveValue("Port Harcourt");
  await control.click();
  await page.getByRole("option", { name: "Second workshop", exact: true }).click();
  await expect(page.locator('.slot[aria-pressed="true"]')).toHaveCount(0);
  await page.locator(".slot").click();
  await page.getByRole("button", { name: "More appointments", exact: true }).click();
  await expect(page.locator(".slot")).toHaveText(/Sat, 2 Oct 2027/);
  await expect(
    page.getByRole("button", { name: "Review booking request", exact: true }),
  ).toBeDisabled();
  await page.locator(".slot").click();
  await page.getByRole("button", { name: "First appointments", exact: true }).click();
  await expect(page.locator(".slot")).toHaveText(/Fri, 1 Oct 2027/);
  await expect(page.locator('.slot[aria-pressed="true"]')).toHaveCount(0);
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(control).toBeEnabled();
  await expect(control).toHaveValue("Second workshop");
});

test("searchable branch choice supports touch, Escape and short viewports", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 520 },
    hasTouch: true,
  });
  const touch = await context.newPage();
  await fixture(touch);
  await touch.goto(routePath);
  const input = touch.getByRole("combobox", { name: "Workshop branch" });
  await input.tap();
  await expect(touch.getByRole("listbox")).toBeVisible();
  await input.fill("no matching branch");
  await expect(touch.getByText("No matching choices on this page.")).toBeVisible();
  await input.press("Escape");
  await expect(input).toBeFocused();
  await expect(touch.getByRole("listbox")).toHaveCount(0);
  await touch.setViewportSize({ width: 740, height: 360 });
  await input.tap();
  const box = await touch.getByRole("listbox").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(740);
  expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  await touch.getByRole("option", { name: "Port Harcourt", exact: true }).tap();
  await expect(input).toHaveValue("Port Harcourt");
  await context.close();
  await page.close();
});

test("conflict keeps notes editable and never reports a received booking", async ({
  page,
}) => {
  const state = await fixture(page);
  state.post = "conflict";
  await page.goto(routePath);
  await prepare(page);
  const notes = page.getByLabel("What should we know about your vehicle? (optional)");
  await notes.fill("Keep these diagnostic notes.");
  if (
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .click();
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We couldn’t send your request" }),
  ).toBeFocused();
  await expect(notes).toBeEnabled();
  await expect(notes).toHaveValue("Keep these diagnostic notes.");
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("failed service photo and reduced motion keep the request path usable", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failImage = true;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routePath);
  await expect(
    page.getByRole("img", { name: "Service image unavailable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Choose an appointment", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose an available appointment." }),
  ).toBeFocused();
  await prepare(page);
  await expect(
    page.getByRole("button", { name: "Review booking request", exact: true }),
  ).toBeEnabled();
});
test("account change clears selected time, notes and receipt without replay", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(routePath);
  await prepare(page);
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Private note");
  if (
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .click();
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage("changed");
    c.close();
  });
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Workshop branch" })).toHaveValue("");
  await expect(
    page.getByLabel("What should we know about your vehicle? (optional)"),
  ).toHaveValue("");
  expect(state.writes).toHaveLength(1);
});
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`quotation enquiry layout and real-shaped receipt at ${width}px`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.role = "anonymous";
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(`/services/${quoteService.id}`);
    await expect(
      page.getByRole("heading", { name: "Engine assessment", exact: true }),
    ).toBeVisible();
    await quoteDraft(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await accessiblePage(page)).violations).toEqual([]);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), `service-detail-quote-${width}-full.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send enquiry", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toBeFocused();
    expect(state.writes[0].body).toMatchObject({
      type: "SERVICE",
      serviceId: quoteService.id,
      branchId: branch.id,
      name: "Service Test",
      email: "service@example.test",
      subject: "Engine assessment enquiry",
    });
    await expect(
      page.getByRole("heading", { name: "Booking request received" }),
    ).toHaveCount(0);
  });
test("an uncertain anonymous enquiry remains locked after account change", async ({
  page,
}) => {
  const state = await fixture(page);
  state.post = "unknown";
  await page.goto(`/services/${quoteService.id}`);
  await quoteDraft(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  await expect(page.getByText(/This submission has an unknown outcome/)).toBeVisible();
  await page.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage("changed");
    c.close();
  });
  await expect(page.getByText(/This submission has an unknown outcome/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review enquiry", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("missing image, zero price, unbookable and long content stay truthful and contained", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 360, height: 900 });
  mode = "empty";
  await page.goto(routePath);
  await expect(
    page.getByText("Service photo not available", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("₦0.00", { exact: true })).toBeVisible();
  mode = "unbookable";
  await page.reload();
  await expect(page.getByText(/Online appointments are unavailable/)).toBeVisible();
  mode = "long";
  await page.reload();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "service-detail-long-360.png"),
    fullPage: true,
  });
});
test("service section links, FAQ keyboard states and bounded other services", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(routePath);
  const nav = page.getByRole("navigation", { name: "Service sections" });
  await page.locator(".sd-panel").scrollIntoViewIfNeeded();
  const overview = nav.getByRole("link", { name: "Overview", exact: true });
  await overview.focus();
  await expect(overview).toBeFocused();
  expect(
    await overview.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
      );
    }),
  ).toBe(true);
  await nav.getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/#service-questions$/);
  await expect(page.getByRole("heading", { name: "Before your visit" })).toBeInViewport();
  const question = page.locator(".sd-questions summary").nth(1);
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".sd-questions details").nth(1)).toHaveAttribute("open", "");
  await expect(
    page.locator(".sd-questions").getByText(/A booking request is waiting/),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator(".sd-questions details").nth(1)).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".sd-more-item")).toHaveCount(2);
  expect(calls.filter((p) => p === "/api/v1/public/services?limit=3")).toHaveLength(1);
  await expect(page.locator(`.sd-more-item[href="${routePath}"]`)).toHaveCount(0);
  await expect(page.locator(".sd-more-item").first()).toContainText("Brake assessment");
  await expect(page.locator(".sd-more-item").first()).toContainText("45 minutes");
  await expect(page.locator(".sd-more-item").nth(1)).toContainText("Quotation required");
  await expect(page.locator(".sd-care-image img")).toHaveAttribute(
    "alt",
    /original Precision Autocare/,
  );
  await page.locator(".sd-more-item").nth(1).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Engine assessment");
  await page.locator(".sd-questions summary").nth(1).click();
  await expect(
    page.locator(".sd-questions").getByText(/Sending an enquiry does not confirm/),
  ).toBeVisible();
  expect((await accessiblePage(page)).violations).toEqual([]);
});
test("other service failure and empty states preserve primary detail and request access", async ({
  page,
}) => {
  await fixture(page);
  for (const next of ["otherDown", "otherEmpty"]) {
    mode = next;
    await page.goto(routePath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(record.name);
    await expect(page.getByRole("combobox", { name: "Workshop branch" })).toBeVisible();
    await expect(page.locator(".sd-more-empty")).toContainText(
      next === "otherDown" ? "temporarily unavailable" : "No other services",
    );
    await expect(page.locator(".sd-more-item")).toHaveCount(0);
  }
});
test("service context and supporting sections fit narrow and wide layouts", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(routePath);
  for (const width of [320, 390, 768, 1536]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.locator(".sd-questions summary").first().click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await accessiblePage(page)).violations).toEqual([]);
    for (const [name, selector] of [
      ["care", ".sd-care"],
      ["questions", ".sd-questions"],
      ["more", ".sd-more"],
    ]) {
      const section = page.locator(selector);
      await page.setViewportSize({
        width,
        height: Math.max(1024, Math.ceil((await section.boundingBox())!.height) + 220),
      });
      await section.evaluate((element) =>
        window.scrollTo({
          top: element.getBoundingClientRect().top + window.scrollY - 100,
          behavior: "instant",
        }),
      );
      await section.screenshot({
        path: path.join(os.tmpdir(), `service-detail-oct-${width}-${name}.png`),
      });
    }
  }
});

test("server metadata and structured breadcrumbs use the real identity with no duplicate read", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(routePath);
  await expect(page).toHaveTitle(/Vehicle diagnostics/);
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const graph = scripts
    .map((s) => JSON.parse(s))
    .find((s) =>
      s["@graph"]?.some((r: Record<string, unknown>) => r["@type"] === "Service"),
    )["@graph"];
  expect(graph.find((s: Record<string, unknown>) => s["@type"] === "Service").name).toBe(
    record.name,
  );
  expect(
    graph.find((s: Record<string, unknown>) => s["@type"] === "BreadcrumbList")
      .itemListElement[2].name,
  ).toBe(record.name);
  expect(calls.filter((p) => p.endsWith(service.id))).toHaveLength(1);
});

test("invalid note characters focus the field without sending a booking", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(routePath);
  await prepare(page);
  const notes = page.getByLabel("What should we know about your vehicle? (optional)");
  await notes.fill("Diagnostic note\u0007");
  if (
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Review booking request", exact: true })
      .click();
  await expect(notes).toBeFocused();
  await expect(notes).toHaveAttribute("aria-invalid", "true");
  expect(state.writes).toHaveLength(0);
});

test("focused native-size form, context, review and recovery captures", async ({
  page,
}) => {
  await fixture(page);
  for (const width of [390, 1536]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(routePath);
    await prepare(page);
    for (const [selector, name] of [
      [".sd-panel", "appointment"],
      [".sd-context", "context"],
    ]) {
      const section = page.locator(selector);
      const height = await section.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      await page.setViewportSize({
        width,
        height: Math.max(1024, Math.ceil(height) + 300),
      });
      await section.evaluate((element) =>
        window.scrollTo({
          top: window.scrollY + element.getBoundingClientRect().top - 150,
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
        path: path.join(os.tmpdir(), `service-detail-${width}-${name}.png`),
      });
    }
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(`/services/${quoteService.id}`);
    await quoteDraft(page);
    const panel = page.locator(".sd-panel");
    const height = await panel.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    await page.setViewportSize({ width, height: Math.ceil(height) + 300 });
    await panel.evaluate((element) =>
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top - 150,
        behavior: "instant",
      }),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await panel.screenshot({
      path: path.join(os.tmpdir(), `service-detail-${width}-quotation.png`),
    });
    await page.setViewportSize({ width, height: 1024 });
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await page
      .getByRole("dialog")
      .screenshot({ path: path.join(os.tmpdir(), `service-detail-${width}-review.png`) });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Go back", exact: true })
      .click();
    mode = "missing";
    await page.goto(routePath);
    await page.screenshot({
      path: path.join(os.tmpdir(), `service-detail-${width}-missing.png`),
    });
    mode = "normal";
  }
});

test("floating support actions stay outside desktop form controls", async ({ page }) => {
  await fixture(page);
  for (const width of [900, 1024, 1280, 1440, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(routePath);
    const control = page.getByRole("combobox", { name: "Workshop branch" });
    await control.evaluate((element) =>
      element.scrollIntoView({ block: "end", behavior: "instant" }),
    );
    await control.focus();
    expect(
      await control.evaluate((element) => {
        const b = element.getBoundingClientRect();
        const hit = document.elementFromPoint(b.right - 8, b.bottom - 8);
        return hit === element || element.contains(hit);
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
});
for (const failure of ["missing", "down", "wrong"])
  test(`service ${failure} renders a useful recovery page with correct HTTP status`, async ({
    page,
  }) => {
    await fixture(page);
    mode = failure;
    const response = await page.goto(routePath);
    expect(response?.status()).toBe(failure === "missing" ? 404 : 500);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      failure === "missing"
        ? "This service is unavailable"
        : "Service details are temporarily unavailable",
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "Browse services" }),
    ).toBeVisible();
    expect((await accessiblePage(page)).violations).toEqual([]);
    if (failure === "down") {
      mode = "normal";
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(
        page.getByRole("heading", { name: record.name, exact: true }),
      ).toBeVisible();
    }
  });
