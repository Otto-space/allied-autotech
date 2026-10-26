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
const time = "2026-09-17T10:00:00.000Z";
const pngFixture = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABACAIAAABqVuVZAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAwElEQVR4nO3ZsQnDQADFUO8/2a2QTqOkD8RNCN/Fg5tA6Mtn+zqvnPMdwoXOuVUEoADql5UwKIBiUP971JhYAMWgTKzVhVaDAigGZWJpUM/8riDSARSDMrE0qHmPRTqAYlAm1rw7LooBFIMyseYB8rIaQDEoE0uDmsdYpAMoBmVizaPjohhAMSgT6yHHn9UAikGZWBrUvMciHUAxKBNr3h0XxQCKQZlY8wB5WQ2gGJSJpUHNYyzSARSDMrHm0fk4b0LgG4V7Cf4VAAAAAElFTkSuQmCC",
    "base64",
  );
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
  mediaVersion: 0,
  createdAt: time,
  updatedAt: time,
  category,
  availability: [],
  compatibilities: [] as ProductCompatibility[],
  images: [] as ProductImage[],
});
const compatibility = (): ProductCompatibility => ({
  id: id(3),
  version: 0,
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
const conflict = (route: Route) =>
  route.fulfill({
    status: 409,
    json: { success: false, error: { code: "CONFLICT" } },
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
  page.on("dialog", (dialog) => dialog.accept());
  const state = {
    product: productFixture(),
    writes: [] as Write[],
    reads: [] as string[],
    failRead: false,
    absent: false,
    unknown: false,
    contradictory: false,
    raceNextCompatibilityWrite: false,
    failUpload: false,
    uploadPreparations: 0,
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
    if (endpoint.endsWith("/assets/upload")) {
      state.uploadPreparations++;
      if (state.failUpload) return fail(route);
      return reply(route, {
        assetToken: "isolated-product-asset-token-".repeat(3),
        upload: {
          method: "PUT",
          url: "https://media.example.test/product-fixture.png",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          headers: { "content-type": "image/png" },
        },
      });
    }
    if (endpoint.endsWith("/images/confirm")) {
      const body = request.postDataJSON();
      state.writes.push({ endpoint, method: request.method(), body });
      if (body.expectedVersion !== state.product.mediaVersion) return conflict(route);
      state.product.mediaVersion++;
      if (body.isPrimary)
        state.product.images.forEach((image) => (image.isPrimary = false));
      const image = {
        ...imageFixture(88),
        url: `/api/v1/admin/catalog/products/${id(1)}/images/${id(88)}/content`,
        source: "UPLOADED" as const,
        altText: body.altText,
        sortOrder: body.sortOrder,
        isPrimary: body.isPrimary,
        width: 64,
        height: 64,
      };
      state.product.images.push(image);
      return reply(route, { version: state.product.mediaVersion, images: [image] });
    }
    if (endpoint.endsWith("/images/reorder")) {
      const body = request.postDataJSON();
      state.writes.push({ endpoint, method: request.method(), body });
      if (body.expectedVersion !== state.product.mediaVersion) return conflict(route);
      state.product.mediaVersion++;
      state.product.images = body.imageIds.map((imageId: string, sortOrder: number) => ({
        ...state.product.images.find((image) => image.id === imageId)!,
        sortOrder,
      }));
      return reply(route, {
        version: state.product.mediaVersion,
        imageIds: body.imageIds,
      });
    }
    if (request.method() === "GET") {
      state.reads.push(endpoint);
      if (endpoint === "/admin/catalog/products")
        return state.failRead
          ? fail(route)
          : reply(route, { items: state.absent ? [] : [state.product] });
      if (endpoint === `/admin/catalog/products/${id(1)}`)
        return state.failRead
          ? fail(route)
          : state.absent
            ? fail(route, 404)
            : reply(route, state.product);
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
    const body = request.postDataJSON();
    const previousImage = state.product.images.find((item) => item.id === itemId);
    const previousCompatibility = state.product.compatibilities.find(
      (item) => item.id === itemId,
    );
    if (kind === "compatibilities" && request.method() !== "POST") {
      if (state.raceNextCompatibilityWrite && previousCompatibility) {
        state.raceNextCompatibilityWrite = false;
        previousCompatibility.version = (previousCompatibility.version ?? 0) + 1;
        previousCompatibility.notes = "Another editor's change";
        return conflict(route);
      }
      if (body.expectedVersion !== previousCompatibility?.version) return conflict(route);
    }
    if (kind === "images") state.product.mediaVersion += 1;
    if (request.method() === "DELETE") {
      if (kind === "compatibilities")
        state.product.compatibilities = state.product.compatibilities.filter(
          (item) => item.id !== itemId,
        );
      else
        state.product.images = state.product.images.filter((item) => item.id !== itemId);
      return reply(route);
    }
    const record = {
      ...previousImage,
      ...body,
      id: itemId ?? id(30 + state.writes.length),
      createdAt: time,
      ...(kind === "compatibilities"
        ? {
            version:
              request.method() === "POST" ? 0 : (previousCompatibility?.version ?? 0) + 1,
          }
        : {}),
    };
    if (kind === "compatibilities") delete record.expectedVersion;
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
    ].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
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
async function open(page: Page, task = "compatibility") {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Compatibility & images", exact: true }).click();
  if (task === "compatibility")
    await page.getByRole("button", { name: "Compatibility", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Isolated brake pad", exact: true }),
  ).toBeVisible();
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
    expectedVersion: 0,
    make: "Test make",
    model: "Test model",
    yearFrom: null,
    yearTo: 2024,
    notes: null,
  });
  expect(state.writes[2].body).toEqual({ expectedVersion: 1 });
  expect(state.reads).toContain(`/admin/catalog/products/${id(1)}`);
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
  await open(page, "images");
  await page.getByRole("button", { name: "Use hosted image URL", exact: true }).click();
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
  await page.getByLabel("Display order (1 first)").fill("10002");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(page.getByLabel("Display order (1 first)")).toBeFocused();
  await page.getByLabel("Display order (1 first)").fill("1");
  await page.getByLabel("Use as main image").check();
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Not approved; image display unavailable"),
  ).toBeVisible();
  await confirm(page).click();
  await expect(page.getByRole("heading", { name: "Image 3 · Main image" })).toBeVisible();
  expect(state.product.images.filter((item) => item.isPrimary)).toHaveLength(1);
  await page.getByRole("button", { name: "Edit image 3", exact: true }).click();
  await page
    .getByLabel("Image description (alt text, optional)")
    .fill("Side view of the test part");
  await page.getByLabel("Display order (1 first)").fill("10001");
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
    expectedVersion: 0,
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

test("a write-time compatibility conflict preserves the draft and offers the latest record on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const state = await fixture(page, { compat: true });
  await open(page);
  await page
    .getByRole("button", { name: "Edit compatibility for Test make Test model" })
    .click();
  await page.getByLabel("Fitment notes (optional)").fill("My unsaved correction");
  await page.getByRole("button", { name: "Review compatibility", exact: true }).click();
  state.raceNextCompatibilityWrite = true;
  await confirm(page).click();
  await expect(page.getByRole("dialog").getByText(/record has changed/i)).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.expectedVersion).toBe(0);
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
    path: path.join(os.tmpdir(), "allied-compatibility-conflict-mobile.png"),
  });
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Fitment notes (optional)")).toHaveValue(
    "My unsaved correction",
  );
  await expect(
    page.getByRole("button", { name: "Review compatibility", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload product editor" }).click();
  await expect(page.getByLabel("Fitment notes (optional)")).toHaveValue(
    "Another editor's change",
  );
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
    await page.getByRole("button", { name: "Back to products", exact: true }).click();
    await page
      .getByRole("button", { name: "Compatibility & images", exact: true })
      .click();
    await page.getByRole("button", { name: "Compatibility", exact: true }).click();
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
    .getByRole("button", { name: "Refresh product records", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add compatibility", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No compatibility records are saved for this part."),
  ).toHaveCount(0);
});

test("staff cannot read administrator products", async ({ page }) => {
  const state = await fixture(page, { role: "STAFF" });
  await page.goto("/admin/products");
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  expect(
    state.reads.filter(
      (endpoint) =>
        endpoint !== "/staff/profile" && endpoint !== "/staff/notifications/summary",
    ),
  ).toEqual([]);
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
  state.product.updatedAt = "2026-09-17T10:00:01.000Z";
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
  await page.getByRole("button", { name: "Back to products", exact: true }).click();
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
  await open(page, "images");
  await expect(page.getByRole("heading", { name: "Saved images (2)" })).toBeVisible();
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

for (const width of [360, 390, 768, 1024, 1440])
  test(`populated gallery moves, main selection and preview keyboard at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await fixture(page, { images: true, compat: true });
    state.product.images = state.product.images.map((image) => ({
      ...image,
      source: "UPLOADED",
      url: `/api/v1/admin/catalog/products/${id(1)}/images/${image.id}/content`,
    }));
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAGAAAABACAIAAABqVuVZAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAwElEQVR4nO3ZsQnDQADFUO8/2a2QTqOkD8RNCN/Fg5tA6Mtn+zqvnPMdwoXOuVUEoADql5UwKIBiUP971JhYAMWgTKzVhVaDAigGZWJpUM/8riDSARSDMrE0qHmPRTqAYlAm1rw7LooBFIMyseYB8rIaQDEoE0uDmsdYpAMoBmVizaPjohhAMSgT6yHHn9UAikGZWBrUvMciHUAxKBNr3h0XxQCKQZlY8wB5WQ2gGJSJpUHNYyzSARSDMrHm0fk4b0LgG4V7Cf4VAAAAAElFTkSuQmCC",
      "base64",
    );
    await page.route("**/api/v1/admin/catalog/products/*/images/*/content", (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    await page.goto(`/admin/products?media=${id(1)}&search=retained`);
    await expect(
      page.getByRole("heading", { name: "Saved images (2)", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recorded compatibility", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(".product-gallery img")
          .first()
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const move = page.getByRole("button", { name: "Move image 2 earlier", exact: true });
    await move.focus();
    await page.keyboard.press("Enter");
    expect(state.writes).toHaveLength(0);
    await confirm(page).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.product.images.map((image) => image.id)).toEqual([id(5), id(4)]);
    expect(
      state.product.images.filter((image) => image.isPrimary).map((image) => image.id),
    ).toEqual([id(4)]);
    await page.getByRole("button", { name: "Set image 1 as main", exact: true }).click();
    await confirm(page).click();
    await expect(
      page.getByRole("heading", { name: "Image 1 · Main image", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit image 1", exact: true }).click();
    await page
      .getByLabel("Image description (alt text, optional)")
      .fill("Keep this gallery draft");
    await page.getByRole("button", { name: "Enlarge image 2", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /Image preview/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Enlarge image 2", exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel("Image description (alt text, optional)")).toHaveValue(
      "Keep this gallery draft",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".product-media-editor")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Cancel image edit", exact: true }).click();
    for (const dismiss of await page
      .getByRole("button", { name: "Dismiss notification", exact: true })
      .all())
      await dismiss.click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`product-gallery-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Compatibility", exact: true }).click();
    await expect(page).toHaveURL(/tab=compatibility/);
    await expect(
      page.getByRole("heading", { name: "Recorded compatibility", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Saved images (2)", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("search")).toBe("retained");
    if (width === 1440) {
      // Half the logical viewport emulates 200% reflow on a 1440x900 desktop.
      await page.setViewportSize({ width: 720, height: 450 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.getByRole("button", { name: "Edit image 1", exact: true }).click();
      await page.getByLabel("Image description (alt text, optional)").focus();
      await expect(
        page.getByLabel("Image description (alt text, optional)"),
      ).toBeFocused();
    }
  });

test("file prepare failure, same-file retry and reviewed attachment preserve metadata", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route("https://media.example.test/**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*" },
      body: "",
    }),
  );
  await open(page, "images");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await page
    .getByLabel("Image description (alt text, optional)")
    .fill("Synthetic oil filter, front view");
  await page.getByLabel("Display order (1 first)").fill("3");
  await page.locator("#product-image-file").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG or WebP image.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review uploaded image", exact: true }),
  ).toBeDisabled();
  const file = { name: "fixture.png", mimeType: "image/png", buffer: pngFixture() };
  await page.locator("#product-image-file").setInputFiles(file);
  state.failUpload = true;
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.locator("#product-image-file-error").getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByLabel("Image description (alt text, optional)")).toHaveValue(
    "Synthetic oil filter, front view",
  );
  state.failUpload = false;
  await page.locator("#product-image-file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.getByText("File uploaded. Ready to attach when you confirm the record.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review uploaded image", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Synthetic oil filter, front view",
  );
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Saved images (1)", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    expectedVersion: 0,
    sortOrder: 2,
    isPrimary: false,
    altText: "Synthetic oil filter, front view",
  });
  expect(state.uploadPreparations).toBe(2);
});

test("declining a task change preserves edits; confirmed cancellation clears the scoped draft", async ({
  page,
}) => {
  await fixture(page, { images: true });
  await open(page, "images");
  await page.getByRole("button", { name: "Edit image 1", exact: true }).click();
  await page
    .getByLabel("Image description (alt text, optional)")
    .fill("Discard this local edit");
  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Compatibility", exact: true }).click();
  await expect(page.getByLabel("Image description (alt text, optional)")).toHaveValue(
    "Discard this local edit",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel image edit", exact: true }).click();
  await page.getByRole("button", { name: "Edit image 1", exact: true }).click();
  await expect(page.getByLabel("Image description (alt text, optional)")).toHaveValue("");
});
