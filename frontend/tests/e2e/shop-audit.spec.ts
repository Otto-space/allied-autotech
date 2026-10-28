import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";

// Browser-only fictional responses. No database or application mutations.
async function fixture(
  page: Page,
  options: { noMakes?: boolean; failedMakes?: boolean } = {},
) {
  const writes: string[] = [];
  const requests: URL[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (options.failedMakes && url.pathname.endsWith("/public/fitment/makes"))
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    requests.push(url);
    let data = discoveryResponse(url, options.noMakes ? "no-fitment" : "populated");
    if (
      url.pathname.endsWith("/products/options") &&
      url.searchParams.get("field") === "brand"
    )
      data = { items: [] };
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Isolated Shop audit fixture",
        meta: { requestId: "shop-audit" },
      },
    });
  });
  await page.goto("/parts");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("DEMO");
  await expect(page.locator(".shop-product-card")).toHaveCount(12);
  return { writes, requests };
}

for (const width of [390, 1440]) {
  test(`Shop search, empty suggestions and filters remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 936 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await fixture(page, { noMakes: true });
    await expect(
      page.getByRole("radio", { name: "Get help choosing a product" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "Find products for my vehicle" }),
    ).toHaveCount(0);
    const help = page.locator(".parts-finder-help a");
    await expect(help).toHaveAttribute("href", /part_search=DEMO/);
    const search = await page
      .getByRole("searchbox", { name: "Search products" })
      .boundingBox();
    const toolbar = await page.locator(".product-toolbar").boundingBox();
    expect(search!.y).toBeLessThan(toolbar!.y);
    expect(
      await page
        .locator(".product-search-panel")
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThan(width < 768 ? 420 : 310);
    await expect(page.getByRole("group", { name: "Category shortcuts" })).toHaveCount(0);
    const trigger = page.getByRole("button", { name: /^Filters/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const brand = page.getByRole("textbox", { name: "Brand", exact: true });
    await expect(brand).toBeVisible();
    await expect(brand).not.toHaveAttribute("list", /.+/);
    await expect(
      page.getByText(
        "No brand suggestions for this search. You can enter the full brand name.",
      ),
    ).toBeVisible();
    await brand.fill("Unlisted brand");
    await page.getByLabel("Product type", { exact: true }).selectOption("BRAKE_PADS");
    await expect(
      page.getByRole("option", { name: "Brake pads", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/productType=BRAKE_PADS/);
    await expect(page).toHaveURL(/brand=Unlisted\+brand/);
    await expect(
      page.getByRole("button", { name: "Remove Product type: Brake pads" }),
    ).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.hover();
    await expect(trigger).toBeFocused();
    expect(await trigger.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      "none",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(state.writes).toEqual([]);
    await page
      .locator(".product-search-panel")
      .screenshot({ path: info.outputPath(`shop-controls-${width}.png`) });
  });

  test(`available vehicle finder keeps selection and deliberate mode switching at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 936 });
    const state = await fixture(page);
    const mode = page.getByRole("radio", {
      name: "Find products for my vehicle",
      exact: true,
    });
    await mode.check();
    await page.getByRole("combobox", { name: "Vehicle make", exact: true }).fill("Toy");
    await page.getByRole("option", { name: "Toyota", exact: true }).click();
    await page.getByRole("combobox", { name: "Vehicle model", exact: true }).fill("Cor");
    await page.getByRole("option", { name: "Corolla", exact: true }).click();
    await page.getByLabel("Model year", { exact: true }).selectOption("2018");
    await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
    await expect(page).toHaveURL(/vehicleModelId=/);
    await expect(page).toHaveURL(/search=DEMO/);
    await expect(
      page.getByRole("heading", { name: "No verified match for these details" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Search all products", exact: true }).check();
    await expect(page).not.toHaveURL(/vehicleModelId=/);
    await expect(page).toHaveURL(/search=DEMO/);
    await page.goBack();
    await expect(mode).toBeChecked();
    await expect(page.getByLabel("Model year", { exact: true })).toHaveValue("2018");
    expect(state.writes).toEqual([]);
  });
}

test("vehicle-choice errors stay distinct from an empty catalogue and recover", async ({
  page,
}) => {
  const options = { failedMakes: true };
  const state = await fixture(page, options);
  await page
    .getByRole("radio", { name: "Find products for my vehicle", exact: true })
    .check();
  await expect(
    page.getByText(
      "Vehicle choices could not be checked. Retry or ask our team for help.",
    ),
  ).toBeVisible();
  options.failedMakes = false;
  await page.getByRole("button", { name: "Retry vehicle choices", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Vehicle make", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
