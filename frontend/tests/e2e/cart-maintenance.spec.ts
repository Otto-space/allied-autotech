import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { overviewFixture } from "../fixtures/overview";
const id = (n: number) => `e6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branch = { id: id(1), code: "TEST", name: "Test branch" };
const product = {
  id: id(2),
  name: "Test cart part",
  slug: "test-part",
  sku: "TEST",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "9007199254740993",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: { id: id(3), name: "Test category", slug: "test", description: null },
  images: [],
  compatibilities: [],
  availability: [{ branch, inStock: true }],
};
const ok = (route: Route, data?: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      ...(data === undefined ? {} : { data }),
      meta: { requestId: "cart-test" },
    },
  });
const fail = (route: Route, status = 503) =>
  route.fulfill({
    status,
    json: {
      success: false,
      message: "Private failure",
      error: { code: status === 409 ? "CONFLICT" : "DATABASE_UNAVAILABLE" },
    },
  });
async function fixture(page: Page, role = "CUSTOMER") {
  const state = {
    quantity: 2,
    failRead: false,
    mode: "success",
    reads: [] as string[],
    writes: [] as { endpoint: string; method: string; body: unknown; csrf?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return ok(route, {
        id: id(10),
        user: { id: id(11), email: "cart@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-17T10:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return ok(route, { csrfToken: "isolated-cart-csrf-".repeat(3) });
    if (request.method() === "GET") {
      state.reads.push(endpoint);
      if (endpoint.endsWith("/overview")) return ok(route, overviewFixture(role));
      if (endpoint === "/public/branches") return ok(route, { items: [branch] });
      if (endpoint === "/customers/cart") {
        if (state.failRead) return fail(route);
        const subtotal = (BigInt(product.priceKobo) * BigInt(state.quantity)).toString();
        return ok(route, {
          subtotalKobo: subtotal,
          items: state.quantity
            ? [
                {
                  id: id(4),
                  quantity: state.quantity,
                  unitPriceKobo: product.priceKobo,
                  lineSubtotalKobo: subtotal,
                  product,
                },
              ]
            : [],
        });
      }
      if (endpoint === "/admin/operations/status")
        return ok(route, {
          queues: [],
          openPaymentAnomalies: 0,
          lastReconciliation: null,
        });
      return ok(route, { items: [] });
    }
    state.writes.push({
      endpoint,
      method: request.method(),
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
    });
    if (state.mode === "unknown") return fail(route);
    if (state.mode === "rejected") return fail(route, 409);
    if (state.mode === "malformed") return route.fulfill({ json: { success: true } });
    if (endpoint === "/customers/cart" && request.method() === "DELETE") {
      state.quantity = 0;
      return ok(route);
    }
    if (endpoint.startsWith("/customers/cart/items/")) {
      state.quantity = 0;
      return ok(route);
    }
    return fail(route, 409);
  });
  return state;
}
async function openReview(page: Page) {
  await page.getByRole("button", { name: "Clear cart", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
const confirm = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear cart", exact: true })
    .click();
test("clear cart reviews exact contents and money, sends one CSRF DELETE, then renders empty", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await openReview(page);
  await expect(page.getByRole("dialog")).toContainText("Test cart part × 2");
  await expect(page.getByRole("dialog")).toContainText("180,143,985,094,819.86");
  expect(state.writes).toHaveLength(0);
  await confirm(page);
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  expect(state.writes).toEqual([
    {
      endpoint: "/customers/cart",
      method: "DELETE",
      body: {},
      csrf: "isolated-cart-csrf-".repeat(3),
    },
  ]);
  expect(
    state.reads.filter((value) => value === "/customers/cart").length,
  ).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("button", { name: "Clear cart", exact: true })).toHaveCount(
    0,
  );
});
test("cancelled clear restores focus without changing the cart", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await openReview(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Clear cart", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("2");
  expect(state.writes).toHaveLength(0);
});
test("cart changed in another tab is refreshed without deleting newly added contents", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await openReview(page);
  state.quantity = 3;
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("3");
  await openReview(page);
  await expect(page.getByRole("dialog")).toContainText("Test cart part × 3");
});
test("failed preflight performs no deletion and failed reads hide cached cart contents", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await openReview(page);
  state.failRead = true;
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Test cart part", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Clear cart", exact: true }),
  ).toBeDisabled();
  state.failRead = false;
  await page.getByRole("button", { name: "Refresh cart", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear cart", exact: true }),
  ).toBeEnabled();
});
for (const mode of ["unknown", "malformed"]) {
  test(`${mode} clear result prevents replay, item edits and checkout after refresh`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = mode;
    await page.goto("/dashboard/cart");
    await openReview(page);
    await confirm(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Clear cart", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Refresh cart", exact: true }).click();
    await expect(page.getByText(/A cart change has an unknown outcome/)).toBeVisible();
    for (const name of [
      "Clear cart",
      "Update",
      "Remove Test cart part",
      "Create order & review total",
    ])
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });
}
test("unknown item removal also prevents clearing or checking out a stale cart", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "unknown";
  await page.goto("/dashboard/cart");
  await page.getByRole("button", { name: "Remove Test cart part", exact: true }).click();
  await expect(page.getByText(/A cart change has an unknown outcome/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear cart", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Create order & review total", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("a rejected clear can be reviewed again without being automatically replayed", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "rejected";
  await page.goto("/dashboard/cart");
  await openReview(page);
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Clear cart", exact: true }),
  ).toBeEnabled();
  state.mode = "success";
  await openReview(page);
  await confirm(page);
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
});
test("account invalidation dismisses a pending cart review and removes its private contents", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/cart");
  await openReview(page);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Test cart part × 2", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
for (const role of ["ADMIN", "STAFF"]) {
  test(`${role} operations shows only applicable expiry information and never calls bulk expiry`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Welcome back.", exact: true }),
    ).toBeVisible();
    const heading = page.getByRole("heading", {
      name: "Overdue orders and reservations",
    });
    if (role === "ADMIN") {
      await page
        .getByText("Processing queues & payment monitoring", { exact: true })
        .click();
      await expect(heading).toBeVisible();
      await expect(page.getByText(/Bulk expiry is unavailable/)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Review orders", exact: true }),
      ).toHaveAttribute("href", "/admin/orders");
      await expect(
        page.getByRole("link", { name: "Review vehicle purchases", exact: true }),
      ).toHaveAttribute("href", "/admin/vehicle-sales");
    } else await expect(heading).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
    expect(state.reads.some((value) => value.endsWith("/expire"))).toBeFalsy();
  });
}
for (const width of [320, 1280]) {
  test(`cart clear is accessible at ${width}px`, async ({ page }) => {
    await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (["error", "warning"].includes(entry.type())) errors.push(entry.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/cart");
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart");
    await openReview(page);
    await page.evaluate(() =>
      window.scrollTo({ top: window.scrollY, behavior: "instant" }),
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const dialog = page.getByRole("dialog");
    expect(
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-cart-clear-${width}.png`),
    });
    await page.keyboard.press("Escape");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
