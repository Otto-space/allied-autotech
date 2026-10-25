import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const id = (n: number) => `f7100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const makeId = id(1),
  modelId = id(2),
  categoryId = id(3),
  productId = id(4);
const model = {
  id: modelId,
  makeId,
  name: "Corolla",
  yearFrom: 2013,
  yearTo: 2019,
  make: { id: makeId, name: "Toyota" },
};
const category = {
  id: categoryId,
  name: "Brake pads",
  slug: "synthetic-brake-pads",
  description: null,
};
const baseProduct = {
  id: productId,
  name: "Synthetic Corolla brake pads",
  slug: "synthetic-pads",
  sku: "TEST-PADS",
  brand: "Test manufacturer",
  manufacturerPartNumber: "TEST-2018",
  description: null,
  priceKobo: "1500000",
  compareAtPriceKobo: null,
  currency: "NGN",
  condition: "NEW",
  classification: "AFTERMARKET",
  productType: "BRAKE_PADS",
  category,
  images: [],
  compatibilities: [],
  availability: [
    {
      branch: { id: id(5), code: "TEST", name: "Port Harcourt test branch" },
      inStock: true,
    },
  ],
};
async function fixture(page: Page) {
  const state = {
    requests: [] as URL[],
    writes: [] as Record<string, unknown>[],
    modelFailure: false,
    makeFailure: false,
    empty: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          message: "Isolated fitment browser fixture",
          data,
          meta: { requestId: "fitment-browser-test" },
        },
      });
    if (path.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (path.endsWith("/public/fitment/makes")) {
      if (state.makeFailure)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
        });
      return ok({
        items: [
          { id: makeId, name: "Toyota" },
          { id: id(10), name: "Honda" },
        ].filter((item) =>
          item.name
            .toLowerCase()
            .startsWith(url.searchParams.get("search")?.toLowerCase() ?? ""),
        ),
      });
    }
    if (path.endsWith("/public/fitment/models"))
      return ok({
        items:
          url.searchParams.get("makeId") === makeId
            ? [{ id: modelId, makeId, name: "Corolla", yearFrom: 2013, yearTo: 2019 }]
            : [],
      });
    if (path.endsWith(`/public/fitment/models/${modelId}`))
      return state.modelFailure
        ? route.fulfill({
            status: 503,
            json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
          })
        : ok(model);
    if (path.endsWith("/public/catalog/facets"))
      return ok({
        items:
          url.searchParams.get("field") === "category"
            ? [{ value: categoryId, label: "Brake pads" }]
            : [],
      });
    if (path.endsWith("/public/catalog/categories")) return ok({ items: [category] });
    if (path.endsWith(`/public/catalog/categories/${categoryId}`)) return ok(category);
    if (path.endsWith("/public/catalog/products/discovery")) {
      if (url.searchParams.get("limit") !== "1") state.requests.push(url);
      const selected = url.searchParams.has("vehicleModelId");
      const required = ["engineCode", "market", "position", "brakeSystem"];
      const missing = required.filter((key) => !url.searchParams.get(key));
      const incompatible = url.searchParams.get("market") === "Excluded market";
      const verified = selected && !missing.length && !incompatible;
      const fitment = {
        status: !selected
          ? "UNKNOWN"
          : incompatible
            ? "NOT_COMPATIBLE"
            : verified
              ? "VERIFIED_FIT"
              : "NEEDS_VERIFICATION",
        scope: "MODEL",
        message: incompatible
          ? "An approved exclusion applies. Request another part."
          : verified
            ? "Approved evidence matches the selected configuration."
            : "Make, model and year identify a candidate. Confirm the missing details.",
        missingQualifiers: missing,
        matchedRuleIds: selected ? [id(20)] : [],
      };
      return ok({
        items:
          state.empty || (url.searchParams.get("fitment") === "verified" && !verified)
            ? []
            : [{ ...baseProduct, fitment }],
        totalMatches: state.empty ? 0 : 1,
        ...(selected ? { verifiedMatches: state.empty || !verified ? 0 : 1 } : {}),
      });
    }
    if (path.endsWith(`/public/catalog/products/${productId}`)) return ok(baseProduct);
    if (path.endsWith("/public/catalog/products"))
      return ok({ items: [{ id: productId, name: baseProduct.name }] });
    if (path.endsWith("/public/branches"))
      return ok({
        items: [{ id: id(5), name: "Port Harcourt test branch", code: "TEST" }],
      });
    if (
      path.endsWith("/public/support/enquiries") &&
      route.request().method() === "POST"
    ) {
      state.writes.push(route.request().postDataJSON());
      return ok({ id: id(30), status: "OPEN", createdAt: "2026-10-23T00:00:00Z" }, 202);
    }
    return ok({ items: [] });
  });
  return state;
}
async function chooseCar(page: Page) {
  await page.getByRole("button", { name: "Find parts for my car", exact: true }).click();
  const make = page.getByRole("combobox", { name: "Vehicle make", exact: true });
  await make.fill("Toy");
  await page.getByRole("option", { name: "Toyota", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle model", exact: true }).click();
  await page.getByRole("option", { name: "Corolla", exact: true }).click();
  await page.getByLabel("Model year", { exact: true }).selectOption("2018");
}
for (const width of [1440, 390])
  test(`parts finder carries verified vehicle context and enquiry at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/parts");
    await chooseCar(page);
    await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`vehicleModelId=${modelId}`));
    await expect(
      page.getByRole("heading", { name: "No verified match for these details" }),
    ).toBeVisible();
    await expect(page.locator(".product-card")).toContainText("Needs verification");
    await page.getByText("All technical details", { exact: false }).click();
    await page.getByText("Engine and vehicle configuration", { exact: true }).click();
    await page.getByText("Brakes and position", { exact: true }).click();
    for (const [label, value] of [
      ["Engine code", "2ZR-FE"],
      ["Vehicle market", "Japan"],
      ["Axle / position", "front"],
      ["Brake system / hardware", "Akebono"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
    await expect(page.locator(".product-card")).toContainText("Verified fit");
    await expect(
      page.getByRole("heading", { name: "No verified match for these details" }),
    ).toHaveCount(0);
    await expect
      .poll(() => state.requests.at(-1)?.searchParams.get("engineCode"))
      .toBe("2ZR-FE");
    await page.getByLabel("Show verified matches only").check();
    await expect(page).toHaveURL(/fitment=verified/);
    await page.goBack();
    await expect(page).not.toHaveURL(/fitment=verified/);
    await expect(page.getByLabel("Vehicle make", { exact: true })).toHaveValue("Toyota");
    await expect(page.getByLabel("Vehicle model", { exact: true })).toHaveValue(
      "Corolla",
    );
    await page.reload();
    await expect(page.getByLabel("Model year", { exact: true })).toHaveValue("2018");
    expect(
      (await new AxeBuilder({ page }).include(".parts-car-finder").analyze()).violations,
    ).toEqual([]);
    await page.locator(".parts-car-finder").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`parts-finder-${width}.png`) });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    state.empty = true;
    await page.getByLabel("Sort by", { exact: true }).selectOption("price_asc");
    await page
      .locator(".parts-fitment-help")
      .getByRole("link", { name: "Request the right part", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact\?parts=1/);
    await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
      "Parts verification: Toyota Corolla 2018",
    );
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      /Engine code: 2ZR-FE/,
    );
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      /Collection only/,
    );
    await page.getByLabel("Your name", { exact: true }).fill("Synthetic Parts Customer");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("parts-test@example.test");
    await expect(page.getByLabel("Handling branch", { exact: true })).toHaveValue(
      "Port Harcourt test branch",
    );
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    expect(state.writes).toHaveLength(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send enquiry", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      type: "PRODUCT",
      email: "parts-test@example.test",
    });
    expect(state.writes[0].message).toContain("Vehicle: Toyota Corolla, model year 2018");
    expect(state.writes[0]).not.toHaveProperty("customerId");
    expect(errors).toEqual([]);
  });

test("unavailable catalogue reads can retry and changing make clears dependent selection", async ({
  page,
}) => {
  const state = await fixture(page);
  state.makeFailure = true;
  await page.goto("/parts");
  await page.getByRole("button", { name: "Find parts for my car", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle make", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry make options" })).toBeVisible();
  state.makeFailure = false;
  await page.getByRole("button", { name: "Retry make options" }).click();
  await page.getByRole("option", { name: "Toyota", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle model", exact: true }).click();
  await page.getByRole("option", { name: "Corolla", exact: true }).click();
  await page.getByLabel("Model year", { exact: true }).selectOption("2018");
  await page.getByRole("combobox", { name: "Vehicle make", exact: true }).fill("Honda");
  await page.getByRole("option", { name: "Honda", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Vehicle model", exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Model year", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
  await expect(
    page.getByText(
      "Choose your vehicle make and model from the suggestions, then choose a supported model year.",
      { exact: true },
    ),
  ).toBeVisible();
});
