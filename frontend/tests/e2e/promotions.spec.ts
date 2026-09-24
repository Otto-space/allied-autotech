import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { Promotion } from "@/lib/api/promotion-schemas";
import { collectionOnlyOptions } from "../fixtures/fulfillment";
const id = (n: number) => `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T09:00:37Z";
const promotionFixture = (): Promotion => ({
  id: id(1),
  name: "Isolated promotion",
  code: "TEST-CODE",
  description: null,
  discountType: "PERCENTAGE",
  percentageBasisPoints: 1234,
  fixedAmountKobo: null,
  minimumOrderAmountKobo: null,
  maximumDiscountAmountKobo: "100000",
  usageLimit: 10,
  perCustomerLimit: 2,
  startsAt: time,
  endsAt: "2026-09-30T09:00:37Z",
  isActive: false,
  version: 3,
  createdAt: time,
  updatedAt: time,
});
const reply = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "promotion-test" },
    },
  });
const fail = (route: Route, code: string, status = 409) =>
  route.fulfill({
    status,
    json: { success: false, message: "Do not display this exception", error: { code } },
  });
async function fixture(page: Page, role = "ADMIN") {
  const state = {
    item: promotionFixture(),
    writes: [] as {
      endpoint: string;
      method: string;
      body: Record<string, unknown>;
      csrf?: string;
    }[],
    reads: [] as string[],
    failList: false,
    unknown: false,
    contradictory: false,
    stale: false,
    previews: [] as unknown[],
    previewMode: "success",
    quantity: 1,
    releasePreview: undefined as (() => void) | undefined,
  };
  const branch = { id: id(20), name: "Isolated branch", code: "TEST" };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(11), email: "test@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : time,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-promotion-csrf".repeat(3) });
    if (endpoint === "/public/branches") return reply(route, { items: [branch] });
    if (endpoint === "/public/fulfillment-options")
      return reply(route, collectionOnlyOptions);
    if (endpoint === "/customers/cart") {
      const product = {
        id: id(21),
        name: "Isolated part",
        slug: "isolated-part",
        sku: "TEST",
        brand: null,
        manufacturerPartNumber: null,
        description: null,
        priceKobo: "12345",
        compareAtPriceKobo: null,
        currency: "NGN",
        category: { id: id(22), name: "Test category", slug: "test", description: null },
        images: [],
        compatibilities: [],
        availability: [{ branch, inStock: true }],
      };
      return reply(route, {
        subtotalKobo: String(12345 * state.quantity),
        items: [
          {
            id: id(23),
            quantity: state.quantity,
            unitPriceKobo: "12345",
            lineSubtotalKobo: String(12345 * state.quantity),
            product,
          },
        ],
      });
    }
    if (endpoint === "/customers/promotions/preview") {
      state.previews.push({
        body: request.postDataJSON(),
        csrf: request.headers()["x-csrf-token"],
      });
      if (state.previewMode === "delayed")
        await new Promise<void>((resolve) => {
          state.releasePreview = resolve;
        });
      if (state.previewMode === "ineligible") return fail(route, "CONFLICT");
      if (state.previewMode === "malformed")
        return reply(route, { code: "TEST-CODE", discountAmountKobo: "99999999" });
      return reply(route, {
        code: request.postDataJSON().code,
        discountAmountKobo: "1234",
      });
    }
    if (request.method() === "GET") {
      state.reads.push(url.pathname + url.search);
      if (endpoint === "/admin/promotions") {
        if (state.failList) return fail(route, "DATABASE_UNAVAILABLE", 503);
        return reply(route, {
          items:
            url.searchParams.get("isActive") === "true"
              ? []
              : [{ ...state.item, id: url.searchParams.has("cursor") ? id(2) : id(1) }],
          ...(url.searchParams.has("cursor") || url.searchParams.has("isActive")
            ? {}
            : { nextCursor: id(1) }),
        });
      }
      if (endpoint === `/admin/promotions/${id(1)}`) return reply(route, state.item);
      return fail(route, "NOT_FOUND", 404);
    }
    state.writes.push({
      endpoint,
      method: request.method(),
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
    });
    if (endpoint.startsWith("/customers/cart/items/")) {
      state.quantity = request.postDataJSON().quantity;
      return reply(route, {});
    }
    if (endpoint === "/customers/orders/checkout") return fail(route, "CONFLICT");
    if (state.unknown) return route.abort("connectionreset");
    if (state.stale) {
      state.item.version++;
      state.item.name = "Changed by another administrator";
      state.stale = false;
      return fail(route, "STALE_VERSION");
    }
    state.item = {
      ...state.item,
      ...request.postDataJSON(),
      version: request.method() === "POST" ? 0 : state.item.version + 1,
    };
    return reply(
      route,
      state.contradictory ? { ...state.item, code: "WRONG-CODE" } : state.item,
      request.method() === "POST" ? 201 : 200,
    );
  });
  return state;
}
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function fillCreate(page: Page) {
  await page.goto("/admin/promotions/new");
  await page.getByLabel("Promotion name", { exact: true }).fill("New isolated promotion");
  await page.getByLabel("Redemption code (optional)").fill("test-new");
  await page.getByLabel("Discount percentage").fill("12.34");
  await page.getByLabel("Starts at (Lagos time)").fill("2026-09-17T10:00");
  await page.getByLabel("Ends at (Lagos time)").fill("2026-09-18T10:00");
}
for (const destination of [
  "/admin/promotions",
  "/admin/promotions/new",
  `/admin/promotions/${id(1)}`,
])
  test(`staff cannot read or manage ${destination}`, async ({ page }) => {
    const state = await fixture(page, "STAFF");
    await page.goto(destination);
    await expect(page.getByText(/Administrator access is required/)).toBeVisible();
    expect(state.reads).toEqual([]);
    expect(state.writes).toEqual([]);
  });
test("promotion list separates errors, filters and cursor pages without inventing usage totals", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failList = true;
  await page.goto("/admin/promotions");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No promotions yet" })).toHaveCount(0);
  state.failList = false;
  await page.getByRole("button", { name: "Refresh promotions" }).click();
  await expect(page.getByRole("heading", { name: "Isolated promotion" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => state.reads.some((value) => value.includes("cursor=")))
    .toBe(true);
  await page.getByLabel("Configuration filter").selectOption("true");
  await expect(
    page.getByRole("heading", { name: "No matching promotions" }),
  ).toBeVisible();
  expect(state.reads.at(-1)).toBe("/api/v1/admin/promotions?limit=25&isActive=true");
  await expect(page.getByText(/do not include redemption counts/)).toBeVisible();
});
test("creation reviews exact basis points, minor amounts, Lagos dates and no write before confirmation", async ({
  page,
}) => {
  const state = await fixture(page);
  await fillCreate(page);
  await page.getByLabel("Discount cap (NGN, optional)").fill("99999999999999.99");
  await page.getByLabel("Minimum subtotal (NGN, optional)").fill("0.01");
  await page.getByLabel("Enable this promotion").check();
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  expect(state.writes).toEqual([]);
  await expect(page.getByRole("button", { name: "Go back" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review promotion", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Promotion created", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].csrf).toBeTruthy();
  expect(state.writes[0].body).toEqual({
    name: "New isolated promotion",
    code: "TEST-NEW",
    description: null,
    discountType: "PERCENTAGE",
    percentageBasisPoints: 1234,
    fixedAmountKobo: null,
    minimumOrderAmountKobo: "1",
    maximumDiscountAmountKobo: "9999999999999999",
    usageLimit: null,
    perCustomerLimit: null,
    startsAt: "2026-09-17T10:00:00+01:00",
    endsAt: "2026-09-18T10:00:00+01:00",
    isActive: true,
  });
});
test("cross-field validation focuses the relevant error and switching discount type clears hidden invalid input", async ({
  page,
}) => {
  const state = await fixture(page);
  await fillCreate(page);
  await page.getByLabel("Ends at (Lagos time)").fill("2026-09-16T10:00");
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await expect(page.getByLabel("Ends at (Lagos time)")).toBeFocused();
  await page.getByLabel("Ends at (Lagos time)").fill("2026-09-18T10:00");
  await page.getByLabel("Total usage limit (optional)").fill("2");
  await page.getByLabel("Per-customer limit (optional)").fill("3");
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await expect(page.getByLabel("Per-customer limit (optional)")).toBeFocused();
  await page.getByLabel("Per-customer limit (optional)").fill("1");
  await page.getByLabel("Discount type").selectOption("FIXED_AMOUNT");
  await page.getByLabel("Fixed discount (NGN)").fill("invalid");
  await page.getByLabel("Discount type").selectOption("PERCENTAGE");
  await page.getByLabel("Discount percentage").fill("0.01");
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("versioned edit switches discount type, clears optional values and preserves unchanged timestamp seconds", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/admin/promotions/${id(1)}`);
  await page.getByLabel("Discount type").selectOption("FIXED_AMOUNT");
  await page.getByLabel("Fixed discount (NGN)").fill("25.01");
  await page.getByLabel("Redemption code (optional)").fill("");
  await page.getByLabel("Discount cap (NGN, optional)").fill("0");
  await page.getByLabel("Total usage limit (optional)").fill("");
  await page.getByLabel("Per-customer limit (optional)").fill("");
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("None; not redeemable by customers"),
  ).toBeVisible();
  await confirm(page).click();
  await expect(page.getByText("Promotion changes confirmed.")).toBeVisible();
  expect(state.writes[0].body).toMatchObject({
    expectedVersion: 3,
    discountType: "FIXED_AMOUNT",
    percentageBasisPoints: null,
    fixedAmountKobo: "2501",
    code: null,
    maximumDiscountAmountKobo: "0",
    usageLimit: null,
    perCustomerLimit: null,
    startsAt: time,
  });
});
test("stale versions preserve the draft until explicit reload", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/admin/promotions/${id(1)}`);
  await page.getByLabel("Promotion name", { exact: true }).fill("Preserved draft");
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  state.stale = true;
  await confirm(page).click();
  await expect(page.getByRole("dialog").getByText(/record has changed/)).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue(
    "Preserved draft",
  );
  await expect(
    page.getByRole("button", { name: "Review promotion", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload promotion editor" }).click();
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveValue(
    "Changed by another administrator",
  );
});
for (const outcome of ["unknown", "contradictory"] as const)
  test(`${outcome} promotion creation cannot be acknowledged or resent`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await fillCreate(page);
    state[outcome] = true;
    await page.getByRole("button", { name: "Review promotion", exact: true }).click();
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await expect(
      page.getByRole("heading", { name: "Promotion created", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review promotion", exact: true }),
    ).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });
test("cart preview uses the server subtotal, resets after code and cart edits, and does not send a discount to checkout", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  await page.goto("/dashboard/cart");
  await page.getByLabel("Promotion code (optional)").fill("test-code");
  await page.getByRole("button", { name: "Check promotion code" }).click();
  await expect(page.getByText(/Estimated discount:/)).toBeVisible();
  expect(state.previews).toEqual([
    {
      body: { code: "TEST-CODE", subtotalKobo: "12345" },
      csrf: "isolated-promotion-csrf".repeat(3),
    },
  ]);
  await page.getByLabel("Promotion code (optional)").fill("CHANGED");
  await expect(page.getByText(/Estimated discount:/)).toHaveCount(0);
  await page.getByLabel("Promotion code (optional)").fill("test-code");
  await expect(page.getByText(/Estimated discount:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Check promotion code" }).click();
  await expect(page.getByText(/Estimated discount:/)).toBeVisible();
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByText(/Estimated discount:/)).toHaveCount(0);
  await page.getByLabel("Collection branch").selectOption(id(20));
  await page.getByRole("button", { name: "Create order & review total" }).click();
  expect(state.writes.at(-1)?.body).toEqual({
    branchId: id(20),
    fulfillmentMethod: "COLLECTION",
    promotionCode: "test-code",
  });
});
test("ineligible and malformed previews stay unconfirmed and late results are discarded after code changes", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  await page.goto("/dashboard/cart");
  await page.getByLabel("Promotion code (optional)").fill("TEST-CODE");
  state.previewMode = "ineligible";
  await page.getByRole("button", { name: "Check promotion code" }).click();
  await expect(page.getByText(/not eligible for the current subtotal/)).toBeVisible();
  state.previewMode = "malformed";
  await page.getByRole("button", { name: "Check promotion code" }).click();
  await expect(page.getByText(/could not check this code/)).toBeVisible();
  await expect(page.getByText(/Estimated discount:/)).toHaveCount(0);
  state.previewMode = "delayed";
  await page.getByRole("button", { name: "Check promotion code" }).click();
  await expect.poll(() => !!state.releasePreview).toBe(true);
  await page.getByLabel("Promotion code (optional)").fill("NEW-CODE");
  state.releasePreview?.();
  await expect(page.getByRole("button", { name: "Check promotion code" })).toBeEnabled();
  await expect(page.getByText(/Estimated discount:/)).toHaveCount(0);
});
test("account invalidation removes an unsaved promotion and closes its review", async ({
  page,
}) => {
  const state = await fixture(page);
  await fillCreate(page);
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Promotion name", { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("promotion editor and review work at mobile and desktop widths without accessibility violations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await fixture(page);
  await fillCreate(page);
  await page
    .getByLabel("Description (optional)")
    .fill("Isolated promotion description for responsive verification.");
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
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-promotion-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review promotion", exact: true }).click();
  expect(
    await page
      .getByRole("region", { name: "Review details" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-promotion-review-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review promotion", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-promotion-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
