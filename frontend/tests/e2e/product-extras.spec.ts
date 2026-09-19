import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type {
  ProductCompatibility,
  ProductImage,
} from "@/lib/api/product-extras-schemas";

// All records and writes are isolated in browser interception.
const id = (n: number) => `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const category = {
  id: id(2),
  name: "Isolated category",
  slug: "test-category",
  description: null,
  isActive: true,
  createdAt: time,
  updatedAt: time,
};
const productFixture = () => ({
  id: id(1),
  name: "Isolated brake pad",
  slug: "test-brake-pad",
  sku: "TEST-PART",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "12345",
  compareAtPriceKobo: null,
  currency: "NGN",
  isActive: true,
  featured: false,
  createdAt: time,
  updatedAt: time,
  category,
  availability: [],
  compatibilities: [] as ProductCompatibility[],
  images: [] as ProductImage[],
});
const compatibility = (): ProductCompatibility => ({
  id: id(3),
  make: "Test make",
  model: "Test model",
  yearFrom: 2015,
  yearTo: 2020,
  notes: null,
});
const imageFixture = (n = 4): ProductImage => ({
  id: id(n),
  url: `https://unapproved.invalid/part-${n}.jpg`,
  altText: null,
  sortOrder: 0,
  isPrimary: n === 4,
  createdAt: time,
});
const reply = (route: Route, data?: unknown, status = 200) =>
  route.fulfill({
    status,
    json: {
      success: true,
      message: "Isolated response",
      ...(data === undefined ? {} : { data }),
      meta: { requestId: "product-test" },
    },
  });
const fail = (route: Route, status = 503) =>
  route.fulfill({
    status,
    json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
  });
type Write = {
  method: string;
  endpoint: string;
  body: Record<string, unknown>;
  csrf?: string;
};
async function fixture(
  page: Page,
  options: { role?: string; images?: boolean; compat?: boolean } = {},
) {
  const state = {
    product: productFixture(),
    writes: [] as Write[],
    reads: [] as string[],
    failRead: false,
    absent: false,
    unknown: false,
    contradictory: false,
  };
  if (options.compat) state.product.compatibilities = [compatibility()];
  if (options.images) state.product.images = [imageFixture(), imageFixture(5)];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: {
          id: id(11),
          email: "operator@example.test",
          role: options.role ?? "ADMIN",
        },
        mfaRequired: true,
        mfaVerifiedAt: time,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-product-csrf".repeat(4) });
    if (request.method() === "GET") {
      state.reads.push(endpoint);
      if (endpoint === "/admin/catalog/products")
        return state.failRead
          ? fail(route)
          : reply(route, { items: state.absent ? [] : [state.product] });
      if (endpoint === "/admin/catalog/categories")
        return reply(route, { items: [category] });
      return fail(route, 404);
    }
    state.writes.push({
      endpoint,
      method: request.method(),
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
    });
    if (state.unknown) return route.abort("connectionreset");
    const kind = endpoint.includes("/compatibilities")
      ? "compatibilities"
      : endpoint.includes("/images")
        ? "images"
        : null;
    if (!kind) return reply(route, { id: id(1) });
    const itemId = endpoint.split("/")[6];
    if (request.method() === "DELETE") {
      if (kind === "compatibilities")
        state.product.compatibilities = state.product.compatibilities.filter(
          (item) => item.id !== itemId,
        );
      else
        state.product.images = state.product.images.filter((item) => item.id !== itemId);
      return reply(route);
    }
    const body = request.postDataJSON();
    const record = {
      ...body,
      id: itemId ?? id(30 + state.writes.length),
      createdAt: time,
    };
    if (kind === "compatibilities") {
      state.product.compatibilities = [
        ...state.product.compatibilities.filter((item) => item.id !== itemId),
        record,
      ];
      return reply(
        route,
        { ...record, productId: state.contradictory ? id(99) : state.product.id },
        request.method() === "POST" ? 201 : 200,
      );
    }
    if (body.isPrimary)
      state.product.images = state.product.images.map((item) => ({
        ...item,
        isPrimary: false,
      }));
    state.product.images = [
      ...state.product.images.filter((item) => item.id !== itemId),
      record,
    ];
    return reply(
      route,
      state.contradictory
        ? { ...record, url: "https://different.invalid/other.jpg" }
        : record,
      request.method() === "POST" ? 201 : 200,
    );
  });
  return state;
}
async function open(page: Page) {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Compatibility & images", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add compatibility", exact: true }),
  ).toBeEnabled();
}
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function addCompatibility(page: Page) {
  await page.getByRole("button", { name: "Add compatibility", exact: true }).click();
  await page.getByLabel("Vehicle make", { exact: true }).fill("Test make");
}

test("compatibility create, complete range update and removal follow actual child contracts", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await addCompatibility(page);
  await page.getByLabel("First year (optional)").fill("2020");
  await page.getByLabel("Final year (optional)").fill("2015");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  await expect(page.getByLabel("Final year (optional)")).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Final year (optional)").fill("2024");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go back" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review compatibility", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("First year (optional)")).toHaveValue("2020");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  await confirm(page).click();
  await expect(
    page.getByText("Product record change confirmed.", { exact: false }),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({
    make: "Test make",
    model: null,
    yearFrom: 2020,
    yearTo: 2024,
    notes: null,
  });
  expect(state.writes[0].csrf).toBeTruthy();
  await page
    .getByRole("button", { name: "Edit compatibility for Test make", exact: true })
    .click();
  await page.getByLabel("First year (optional)").fill("");
  await page.getByLabel("Vehicle model (optional)").fill("Test model");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  await confirm(page).click();
  await page
    .getByRole("button", {
      name: "Remove compatibility for Test make Test model",
      exact: true,
    })
    .click();
  await confirm(page).click();
  await expect(
    page.getByText("No compatibility records are saved for this part."),
  ).toBeVisible();
  expect(state.writes.map((write) => write.method)).toEqual(["POST", "PATCH", "DELETE"]);
  expect(state.writes[1].body).toEqual({
    make: "Test make",
    model: "Test model",
    yearFrom: null,
    yearTo: 2024,
    notes: null,
  });
  expect(state.writes[2].body).toEqual({});
  expect(state.reads).not.toContain(`/admin/catalog/products/${id(1)}`);
});

test("image validation, primary replacement and deletion never fetch unapproved hosts", async ({
  page,
}) => {
  const state = await fixture(page, { images: true });
  const mediaRequests: string[] = [];
  await page.route("https://**/*.jpg", (route) => {
    mediaRequests.push(route.request().url());
    return route.abort();
  });
  await open(page);
  await page.getByRole("button", { name: "Add product image", exact: true }).click();
  await page.getByLabel("Public image URL").fill("not a URL");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(page.getByText("Enter a valid image URL.")).toBeVisible();
  await page.getByLabel("Public image URL").fill("http://unapproved.invalid/plain.jpg");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(page.getByLabel("Public image URL")).toBeFocused();
  await expect(
    page.getByText("Use a public HTTPS URL without credentials."),
  ).toBeVisible();
  await page
    .getByLabel("Public image URL")
    .fill("https://user:pass@unapproved.invalid/private.jpg");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Public image URL").fill("https://unapproved.invalid/new.jpg");
  await page.getByLabel("Sort position").fill("10001");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(page.getByLabel("Sort position")).toBeFocused();
  await page.getByLabel("Sort position").fill("0");
  await page.getByLabel("Primary image").check();
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Not approved; image display unavailable"),
  ).toBeVisible();
  await confirm(page).click();
  await expect(page.getByRole("heading", { name: "Image 3 · primary" })).toBeVisible();
  expect(state.product.images.filter((item) => item.isPrimary)).toHaveLength(1);
  await page.getByRole("button", { name: "Edit image 3", exact: true }).click();
  await page
    .getByLabel("Image description (optional)")
    .fill("Side view of the test part");
  await page.getByLabel("Sort position").fill("10000");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await confirm(page).click();
  await page.getByRole("button", { name: "Remove image 3", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText(/No replacement primary image/),
  ).toBeVisible();
  await confirm(page).click();
  await expect(
    page.getByRole("button", { name: "Edit image 3", exact: true }),
  ).toHaveCount(0);
  expect(state.writes.map((write) => write.method)).toEqual(["POST", "PATCH", "DELETE"]);
  expect(state.writes[0].body).toEqual({
    url: "https://unapproved.invalid/new.jpg",
    altText: null,
    sortOrder: 0,
    isPrimary: true,
  });
  expect(state.writes[1].body.sortOrder).toBe(10000);
  expect(state.product.images.some((item) => item.isPrimary)).toBe(false);
  expect(mediaRequests).toEqual([]);
});

test("child-only changes reject a stale draft even without a product timestamp change", async ({
  page,
}) => {
  const state = await fixture(page, { compat: true });
  await open(page);
  await page
    .getByRole("button", { name: "Edit compatibility for Test make Test model" })
    .click();
  await page.getByLabel("Fitment notes (optional)").fill("Preserved draft");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  state.product.compatibilities[0].yearTo = 2025;
  await confirm(page).click();
  await expect(page.getByRole("dialog").getByText(/changed|updated/i)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.product.updatedAt).toBe(time);
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Fitment notes (optional)")).toHaveValue(
    "Preserved draft",
  );
  await expect(
    page.getByRole("button", { name: "Review compatibility", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload product editor" }).click();
  await expect(page.getByLabel("Final year (optional)")).toHaveValue("2025");
});

test("failed preflight is retryable because no mutation was sent", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  await addCompatibility(page);
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  state.failRead = true;
  await confirm(page).click();
  await expect(
    page.getByRole("dialog").getByText(/No change was submitted/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  state.failRead = false;
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

for (const outcome of ["interrupted", "contradictory"] as const)
  test(`${outcome} compatibility save locks changes across editor close and reopen`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await open(page);
    await addCompatibility(page);
    await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
    state.unknown = outcome === "interrupted";
    state.contradictory = outcome === "contradictory";
    await confirm(page).click();
    await expect(
      page.getByRole("dialog").getByText(/outcome could not be confirmed/i),
    ).toBeVisible();
    await expect(confirm(page)).toBeDisabled();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page
      .getByRole("button", { name: "Close compatibility & images", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compatibility & images", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add compatibility", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/previous change could not be confirmed/)).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });

test("a disappeared product is an unavailable record, not an empty child list", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  state.absent = true;
  await page
    .getByRole("button", { name: "Refresh compatibility & images", exact: true })
    .click();
  await expect(page.getByText(/no longer on the selected catalogue page/)).toBeVisible();
  await expect(
    page.getByText("No compatibility records are saved for this part."),
  ).toHaveCount(0);
});

test("staff cannot read administrator products", async ({ page }) => {
  const state = await fixture(page, { role: "STAFF" });
  await page.goto("/admin/products");
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  expect(state.reads).toEqual([]);
});

test("basic product edits reject stale prices and preserve the draft for review", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "View & edit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Preserved part name");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  state.product.priceKobo = "12346";
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText(/This record has changed/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Preserved part name",
  );
});

test("basic catalogue saves with unknown outcomes cannot be resent after reselecting the part", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "View & edit", exact: true }).click();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  state.unknown = true;
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await page.getByRole("button", { name: "View & edit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review changes", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});

test("account invalidation discards private product drafts and prevents writes", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  await addCompatibility(page);
  await page.getByLabel("Fitment notes (optional)").fill("Private unsaved draft");
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByLabel("Fitment notes (optional)")).toHaveCount(0);
  await expect(page.getByText("Isolated brake pad", { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("mobile editor and review dialog have no overflow or automated accessibility violations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await fixture(page, { compat: true, images: true });
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Recorded product images" }),
  ).toBeVisible();
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
    path: path.join(os.tmpdir(), "allied-product-extras-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go back" })).toBeFocused();
  expect(
    await page
      .getByRole("region", { name: "Review details" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-product-review-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Remove image 1", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-product-extras-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
