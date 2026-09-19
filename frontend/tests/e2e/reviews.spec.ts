import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { ReviewRecord } from "@/lib/api/review-schemas";
const id = (n: number) => `c4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const row = (): ReviewRecord => ({
  id: id(1),
  targetType: "BUSINESS",
  rating: 4,
  title: "Isolated review",
  comment: "Synthetic customer feedback",
  createdAt: time,
  updatedAt: time,
  product: null,
  service: null,
  status: "PENDING",
  version: 0,
  productId: null,
  orderItemId: null,
  serviceId: null,
  bookingId: null,
  orderId: null,
  vehicleTransactionId: null,
  moderationNote: null,
  moderatedAt: null,
});
const order = {
  id: id(2),
  status: "COMPLETED",
  orderNumber: "TEST-ORDER",
  items: [
    {
      id: id(3),
      productId: id(4),
      productName: "Test purchased part",
      sku: "TEST",
      quantity: 1,
      unitPriceKobo: "100",
      subtotalKobo: "100",
    },
  ],
};
const booking = {
  id: id(5),
  status: "COMPLETED",
  scheduledAt: time,
  service: {
    id: id(6),
    name: "Test completed service",
    slug: "test-service",
    description: null,
    shortDescription: null,
    pricingType: "FIXED",
    priceKobo: "100",
    currency: "NGN",
    durationMinutes: 30,
    version: 0,
  },
};
const sale = {
  id: id(7),
  status: "COMPLETED",
  transactionNumber: "TEST-SALE",
  vehicleListing: { id: id(8), title: "Test purchased vehicle", status: "SOLD" },
};
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "review-test" },
    },
  });
const fail = (route: Route, code = "DATABASE_UNAVAILABLE", status = 503) =>
  route.fulfill({
    status,
    json: { success: false, message: "Private server exception", error: { code } },
  });
async function fixture(page: Page, role = "CUSTOMER") {
  const state = {
    rows: [row()],
    failList: false,
    malformed: false,
    failSource: false,
    sourceChanged: false,
    unknown: false,
    contradictory: false,
    stale: false,
    pagination: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    reads: [] as string[],
    writes: [] as { endpoint: string; body: Record<string, unknown>; csrf?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(11), role, email: "review@example.test" },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : time,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-review-csrf-".repeat(3) });
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (endpoint.includes("/support/reviews")) {
        if (state.failList) return fail(route);
        if (state.malformed) return reply(route, { items: [{}] });
        const items = state.rows
          .filter(
            (row) =>
              (!endpoint.startsWith("/public/") || row.status === "APPROVED") &&
              (!url.searchParams.has("status") ||
                row.status === url.searchParams.get("status")) &&
              (!url.searchParams.has("targetType") ||
                row.targetType === url.searchParams.get("targetType")),
          )
          .map((row) => ({
            ...row,
            customer: { firstName: "Test", lastName: "Customer" },
            moderationNote: row.moderationNote ?? "Private moderation detail",
          }));
        return reply(route, {
          items: url.searchParams.has("cursor") ? [] : items,
          ...(state.pagination && !url.searchParams.has("cursor")
            ? { nextCursor: id(1) }
            : {}),
        });
      }
      for (const [base, source] of [
        ["/customers/orders", order],
        ["/customers/bookings", booking],
        ["/customers/vehicle-transactions", sale],
      ] as const) {
        if (endpoint === base)
          return state.failSource ? fail(route) : reply(route, { items: [source] });
        if (endpoint === `${base}/${source.id}`)
          return state.failSource
            ? fail(route)
            : reply(route, {
                ...source,
                status: state.sourceChanged ? "CANCELLED" : source.status,
              });
      }
      return fail(route, "NOT_FOUND", 404);
    }
    state.writes.push({
      endpoint,
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
    });
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.unknown) return route.abort("connectionreset");
    if (state.stale) return fail(route, "STALE_VERSION", 409);
    const body = request.postDataJSON();
    if (endpoint.endsWith("/moderation")) {
      state.rows = state.rows.map((row) => ({
        ...row,
        status: body.decision,
        moderationNote: body.note ?? null,
        version: row.version + 1,
      }));
      return reply(route, state.contradictory ? row() : state.rows[0]);
    }
    const saved = { ...row(), id: id(20), title: null, ...body };
    state.rows.push(saved);
    return reply(route, state.contradictory ? { ...saved, rating: 1 } : saved);
  });
  return state;
}
async function content(page: Page) {
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page.getByLabel("Your review", { exact: true }).fill("My isolated review text");
}
const submit = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit for moderation", exact: true });
test("business review requires a selected rating and confirms moderation receipt", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await expect(page.getByLabel("Rating", { exact: true })).toBeFocused();
  await content(page);
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await expect(page.getByText(/Approved reviews are public/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await submit(page).click();
  await expect(page.getByText(/Review received/)).toBeVisible();
  expect(state.writes[0].body).toEqual({
    targetType: "BUSINESS",
    rating: 4,
    comment: "My isolated review text",
  });
  expect(state.writes[0].csrf).toBe("isolated-review-csrf-".repeat(3));
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue("");
});
for (const [target, sourceId, fields] of [
  ["PRODUCT", id(3), { productId: id(4), orderItemId: id(3) }],
  ["SERVICE", id(5), { serviceId: id(6), bookingId: id(5) }],
  ["ORDER", id(2), { orderId: id(2) }],
  ["VEHICLE_TRANSACTION", id(7), { vehicleTransactionId: id(7) }],
] as const)
  test(`${target} review uses a completed account record and revalidates it`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/dashboard/reviews");
    await page.getByLabel("Review type", { exact: true }).selectOption(target);
    await page.getByLabel("Completed record", { exact: true }).selectOption(sourceId);
    await content(page);
    await page.getByRole("button", { name: "Review submission", exact: true }).click();
    await submit(page).click();
    await expect(page.getByText(/Review received/)).toBeVisible();
    expect(state.writes[0].body).toEqual({
      targetType: target,
      rating: 4,
      comment: "My isolated review text",
      ...fields,
    });
    expect(
      state.reads.some((url) =>
        /\/(orders|bookings|vehicle-transactions)\/c400/.test(url),
      ),
    ).toBe(true);
  });
test("a changed completed record prevents review creation", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await page.getByLabel("Completed record", { exact: true }).selectOption(id(2));
  state.sourceChanged = true;
  await content(page);
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await submit(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(submit(page)).toBeDisabled();
});
test("failed preflight is recoverable without a duplicate creation lock", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await page.getByLabel("Completed record", { exact: true }).selectOption(id(2));
  state.failSource = true;
  await content(page);
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await submit(page).click();
  await expect(page.getByText(/No change was submitted/)).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review submission", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["unknown", "contradictory"] as const)
  test(`${mode} creation outcome locks repeat submissions`, async ({ page }) => {
    const state = await fixture(page);
    state[mode] = true;
    await page.goto("/dashboard/reviews");
    await content(page);
    await page.getByRole("button", { name: "Review submission", exact: true }).click();
    await submit(page).click();
    await expect(submit(page)).toBeDisabled();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.getByRole("button", { name: "Refresh submissions" }).click();
    await expect(
      page.getByRole("button", { name: "Review submission", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/Review received/)).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });
test("submission list filters paginate and recover failed reads without false empty states", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failList = true;
  await page.goto("/dashboard/reviews");
  await expect(
    page.getByRole("region", { name: "Your submissions" }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByText("You have not submitted any reviews.")).toHaveCount(0);
  state.failList = false;
  state.pagination = true;
  await page.getByRole("button", { name: "Refresh submissions" }).click();
  await page.getByLabel("Moderation status", { exact: true }).selectOption("PENDING");
  await page
    .getByRole("navigation", { name: "Your reviews pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("No reviews match this page and status.")).toBeVisible();
  expect(state.reads.at(-1)).toContain("cursor=");
});
test("administrator rejects with a required customer-visible reason and exact version", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto("/admin/reviews");
  await page.getByLabel("Decision", { exact: true }).selectOption("REJECTED");
  await page.getByRole("button", { name: "Review moderation decision" }).click();
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Customer-visible moderation note", { exact: true })
    .fill("Please remove personal contact details.");
  await page.getByRole("button", { name: "Review moderation decision" }).click();
  await expect(page.getByRole("dialog")).toContainText("customer can see");
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByText(/Moderation decision saved/)).toBeVisible();
  expect(state.writes[0].body).toEqual({
    expectedVersion: 0,
    decision: "REJECTED",
    note: "Please remove personal contact details.",
  });
  await page.getByLabel("Review status", { exact: true }).selectOption("REJECTED");
  await expect(
    page.getByRole("button", { name: "Review moderation decision" }),
  ).toHaveCount(0);
});
for (const mode of ["stale", "unknown", "contradictory"] as const)
  test(`${mode} moderation never claims publication or permits dialog replay`, async ({
    page,
  }) => {
    const state = await fixture(page, "SUPER_ADMIN");
    state[mode] = true;
    await page.goto("/admin/reviews");
    await page.getByRole("button", { name: "Review moderation decision" }).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/Moderation decision saved/)).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });
test("staff cannot read or moderate the administrator review queue", async ({ page }) => {
  const state = await fixture(page, "STAFF");
  await page.goto("/admin/reviews");
  await expect(
    page.getByText("Administrator access is required to moderate reviews."),
  ).toBeVisible();
  expect(state.reads).toEqual([]);
  expect(state.writes).toEqual([]);
});
test("public reviews expose only public fields and fail honestly", async ({ page }) => {
  const state = await fixture(page);
  state.rows[0].status = "APPROVED";
  await page.goto("/reviews");
  await expect(page).toHaveTitle(/Customer reviews/);
  await expect(page.getByRole("heading", { name: "Isolated review" })).toBeVisible();
  await expect(page.getByText("Private moderation detail", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.getByText("Test Customer", { exact: false })).toHaveCount(0);
  state.failList = true;
  await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("No published reviews match this page and filters."),
  ).toHaveCount(0);
});
test("account change discards review draft and pending response", async ({ page }) => {
  const state = await fixture(page);
  state.delay = true;
  await page.goto("/dashboard/reviews");
  await content(page);
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await submit(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByLabel("Your review", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  state.release?.();
  await expect(page.getByText(/Review received/)).toHaveCount(0);
});
test("mobile review form and consent dialog support keyboard and accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/dashboard/reviews");
  await expect(page.getByRole("heading", { name: "Isolated review" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await content(page);
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeFocused();
  // Freeze the click's smooth page scroll before capturing a fixed top-layer dialog.
  await page.evaluate(() =>
    window.scrollTo({ top: window.scrollY, behavior: "instant" }),
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-review-dialog-mobile.png"),
  });
  const bounds = await page.getByRole("dialog").evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    headingTop: element.querySelector("h2")?.getBoundingClientRect().top,
    viewport: innerHeight,
  }));
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.headingTop).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review submission", exact: true }),
  ).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-reviews-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-reviews-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("approval publishes feedback and keeps private moderation details off the public page", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto("/reviews");
  await expect(
    page.getByText("No published reviews match this page and filters."),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/reviews");
  await expect(page.getByRole("heading", { name: "Isolated review" })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-review-moderation-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review moderation decision" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review moderation decision" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Review moderation decision" }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByText("Moderation decision saved.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({ expectedVersion: 0, decision: "APPROVED" });
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "Isolated review" })).toBeVisible();
  await expect(page.getByText("Private moderation detail", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.getByText("Test Customer", { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-public-reviews-desktop.png"),
    fullPage: true,
  });
});
