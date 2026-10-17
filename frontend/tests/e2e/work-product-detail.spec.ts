import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workProductsFixture, bookingId } from "../fixtures/work-products";
const path = `/admin/products/${bookingId(1000)}`;
const review = (page: Page) =>
  page.getByRole("button", { name: "Review changes", exact: true });
const confirm = (page: Page) =>
  page.getByRole("button", { name: "Confirm save", exact: true });

test("catalogue link opens a named direct record and independent read survives reload", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Ceramic brake pads", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ceramic brake pads");
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
  state.reads.length = 0;
  await page.reload();
  await expect(page.locator(".product-detail-summary")).toContainText("₦18,500.00");
  await expect(page.locator(".product-detail-summary")).toContainText("₦21,000.00");
  expect(state.reads.every((url) => url.pathname.endsWith(bookingId(1000)))).toBe(true);
  expect(state.writes).toHaveLength(0);
});

test("outside-page product preserves exact large money and inactive nullable records", async ({
  page,
}) => {
  await workProductsFixture(page);
  await page.goto(`/admin/products/${bookingId(1004)}`);
  await expect(page.locator(".product-detail-summary")).toContainText(
    "₦99,999,999,999,999.99",
  );
  await page.goto(`/admin/products/${bookingId(1002)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Air filter");
  await expect(page.locator(".product-detail-summary")).toContainText(
    "Category inactive",
  );
  await expect(page.locator(".product-detail-summary")).toContainText("Inactive");
  await expect(page.getByText("Not provided", { exact: true })).toHaveCount(3);
  await expect(
    page.getByText("No vehicle compatibility has been recorded."),
  ).toBeVisible();
});

test("compatibility bounds, branch facts and honest image selection render complete records", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  state.records[0].compatibilities = [
    {
      id: bookingId(2010),
      make: "Toyota",
      model: "Camry",
      yearFrom: 2018,
      yearTo: 2024,
      notes: "Check part number.",
    },
    {
      id: bookingId(2011),
      make: "Honda",
      model: null,
      yearFrom: null,
      yearTo: null,
      notes: null,
    },
    {
      id: bookingId(2012),
      make: "Ford",
      model: "Focus",
      yearFrom: 2019,
      yearTo: null,
      notes: null,
    },
    {
      id: bookingId(2013),
      make: "Kia",
      model: "Rio",
      yearFrom: null,
      yearTo: 2020,
      notes: null,
    },
    {
      id: bookingId(2014),
      make: "Nissan",
      model: "Note",
      yearFrom: 2021,
      yearTo: 2021,
      notes: null,
    },
  ];
  state.records[0].images = [0, 1].map((n) => ({
    id: bookingId(2020 + n),
    source: "EXTERNAL",
    url: `https://untrusted.invalid/image-${n}.png`,
    altText: `Recorded image ${n + 1}`,
    sortOrder: n,
    isPrimary: n === 1,
    createdAt: "2026-10-13T08:00:00.000Z",
  }));
  await page.goto(path);
  await expect(
    page.getByRole("table", { name: "Recorded vehicle compatibility" }),
  ).toContainText("2018–2024");
  for (const text of ["All models", "All years", "From 2019", "Up to 2020", "2021"])
    await expect(
      page.getByRole("table", { name: "Recorded vehicle compatibility" }),
    ).toContainText(text);
  await expect(
    page.getByRole("table", { name: "Available stock by branch" }),
  ).toContainText("Port Harcourt (PH)");
  await expect(
    page.getByRole("button", { name: "Show image 1 (primary)" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Show image 2", exact: true }).click();
  await expect(page.locator(".product-detail-image-caption")).toHaveText(
    "Recorded image 1",
  );
  await expect(page.getByText("Image unavailable", { exact: true })).toBeVisible();
  expect(await page.locator('img[src*="untrusted.invalid"]').count()).toBe(0);
});

test("review cancellation writes nothing; confirmed edit updates heading and survives reload", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await expect(page).toHaveURL(`${test.info().project.use.baseURL}${path}?view=edit`);
  await page.getByLabel("Name", { exact: true }).fill("Reviewed brake pads");
  await page.getByLabel("Selling price (NGN)", { exact: true }).fill("12345.67");
  await review(page).click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review(page)).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await review(page).click();
  await confirm(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reviewed brake pads");
  await expect(page.locator(".product-detail-summary")).toContainText("₦12,345.67");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.expectedUpdatedAt).toBe("2026-10-13T08:00:00.000Z");
  expect(state.writes[0].csrf).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reviewed brake pads");
});

test("history and reload retain the editor draft; changed product blocks stale confirmation", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Keep this draft");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Keep this draft");
  await page.getByRole("button", { name: "Close editing" }).click();
  await page.goBack();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Keep this draft");
  await review(page).click();
  state.records[0].updatedAt = "2026-10-13T10:00:00.000Z";
  await confirm(page).click();
  expect(state.writes).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Load latest product and replace this draft" }),
  ).toBeVisible();
});

test("uncertain committed edit survives reload and reconciles without replay", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page);
  await page.goto(`${path}?view=edit`);
  await page.getByLabel("Name", { exact: true }).fill("Recovered product name");
  await review(page).click();
  state.outcome = "uncertain";
  await confirm(page).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.reload();
  await expect(review(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Discard draft and reload saved product", exact: true })
    .click();
  await expect(review(page)).toBeEnabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Recovered product name",
  );
  expect(state.writes).toHaveLength(1);
});

for (const mode of ["error", "malformed", "denied", "missing", "mismatch"]) {
  test(`refresh ${mode} handles private record and draft correctly`, async ({ page }) => {
    const { state } = await workProductsFixture(page);
    await page.goto(`${path}?view=edit`);
    await page.getByLabel("Name", { exact: true }).fill("Retained local draft");
    state.detailMode = mode;
    await page.getByRole("button", { name: "Refresh product", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Product unavailable", exact: true }),
    ).toBeVisible();
    if (["denied", "missing", "mismatch"].includes(mode)) {
      await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product details");
    } else {
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
        "Retained local draft",
      );
      await expect(review(page)).toBeDisabled();
    }
    state.detailMode = "normal";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(review(page)).toBeEnabled();
    expect(state.writes).toHaveLength(0);
  });
}

test("media workspace and invalid views have working direct-route recovery", async ({
  page,
}) => {
  await workProductsFixture(page);
  await page.goto(`${path}?view=media`);
  await expect(page.getByRole("heading", { name: /Compatibility & images/ })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("button", { name: "Add compatibility", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add compatibility", exact: true }),
  ).toBeEnabled();
  await page.goto(`${path}?view=edit&view=media`);
  await expect(
    page.getByRole("heading", { name: "Product view unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit product", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Return to product details" }).click();
  await expect(
    page.getByRole("button", { name: "Edit product", exact: true }),
  ).toBeEnabled();
});

test("staff cannot load administrator product data", async ({ page }) => {
  const { state } = await workProductsFixture(page, "STAFF");
  await page.goto(path);
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit product", exact: true }),
  ).toHaveCount(0);
  expect(state.reads).toHaveLength(0);
});

test("super admin can open details and invalid identifiers make no product request", async ({
  page,
}) => {
  const { state } = await workProductsFixture(page, "SUPER_ADMIN");
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Edit product", exact: true }),
  ).toBeEnabled();
  state.reads.length = 0;
  await page.goto("/admin/products/not-a-product-id");
  await expect(page.getByText("We couldn’t find that page.")).toBeVisible();
  expect(state.reads).toHaveLength(0);
});

test("loading communicates progress then presents the complete record", async ({
  page,
}) => {
  await workProductsFixture(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/admin/catalog/products/${bookingId(1000)}`,
    async (route) => {
      await pending;
      await route.fallback();
    },
  );
  await page.goto(path);
  await expect(page.getByText("Loading product details…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh product", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ceramic brake pads");
});

for (const viewport of [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 430, height: 900 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`maximum text and review remain usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { state } = await workProductsFixture(page);
    Object.assign(state.records[0], {
      name: "P".repeat(180),
      sku: "S".repeat(80),
      slug: "p".repeat(120),
      brand: "B".repeat(100),
      manufacturerPartNumber: "M".repeat(120),
      description: "D".repeat(10000),
      priceKobo: "9999999999999999",
      compareAtPriceKobo: null,
    });
    state.records[0].category = { ...state.records[0].category, name: "C".repeat(120) };
    state.records[0].compatibilities = [
      {
        id: bookingId(2200),
        make: "T".repeat(80),
        model: "M".repeat(80),
        yearFrom: null,
        yearTo: null,
        notes: "N".repeat(1000),
      },
    ];
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      state.records[0].name,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Edit product", exact: true }).click();
    await expect(review(page)).toBeEnabled();
    await review(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return (
          r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
        );
      }),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(review(page)).toBeFocused();
    expect(state.writes).toHaveLength(0);
  });
}

for (const width of [320, 375, 430, 768, 1440]) {
  test(`detail and editor are accessible without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await workProductsFixture(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ceramic brake pads",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Edit product", exact: true }).click();
    await expect(review(page)).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
