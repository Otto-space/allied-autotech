import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
test.beforeEach(async ({ page }) => {
  await page.route(
    /\/api\/v1\/public\/(services|catalog\/products|vehicles|support\/reviews)\?/,
    (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Services retrieved",
          data: { items: [] },
          meta: { requestId: "browser-test" },
        },
      }),
  );
});
for (const width of [320, 768, 1024, 1440]) {
  test(`homepage and automated help at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 600 : 900 });
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Precision vehicle care",
    );
    await expect(page.getByText("Services are not listed yet")).toBeVisible();
    await expect(page.getByText(/No parts are published yet/)).toBeVisible();
    await expect(page.getByText(/No vehicles are published yet/)).toBeVisible();
    await expect(page.getByRole("link", { name: "View My Garage" })).toHaveAttribute(
      "href",
      "/dashboard/vehicles",
    );
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(
      /Quicksand/i,
    );
    expect(
      await page
        .getByRole("heading", { level: 1 })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/Quicksand/i);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-home-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Quick help" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Your question").fill("Where is the workshop location?");
    await page.getByRole("button", { name: "Find an answer" }).click();
    await expect(page.getByRole("dialog").getByText(/133 Stadium Road/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Quick help" })).toBeFocused();
    expect(failures).toEqual([]);
  });
}
test("help search and no-match recovery", async ({ page }) => {
  await page.goto("/help");
  await page.getByLabel("Search help topics").fill("zzzxxyy");
  await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("main")
    .getByText("How do I book a service?", { exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Explore services" })).toBeVisible();
});
test("service failure remains an error with a working retry", async ({ page }) => {
  await page.route("**/api/v1/public/services?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        message: "PRIVATE EXCEPTION",
        error: { code: "DATABASE_UNAVAILABLE" },
      },
    }),
  );
  await page.goto("/services");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByText("PRIVATE EXCEPTION")).toHaveCount(0);
  await expect(page.getByText("Services are not listed yet")).toHaveCount(0);
  await page.route("**/api/v1/public/services?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Services retrieved",
        data: { items: [] },
        meta: { requestId: "browser-test" },
      },
    }),
  );
  await page.getByRole("button", { name: "Retry services" }).click();
  await expect(page.getByText("Services are not listed yet")).toBeVisible();
});

test("homepage catalogue failure recovers to real response data without sample products", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let recovered = false;
  const partId = "60000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/public/catalog/products?*", (route) => {
    if (!recovered)
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated catalogue response",
        data: {
          items: [
            {
              id: partId,
              name: "Isolated replacement component with a long catalogue name",
              slug: "isolated-part",
              sku: "FIXTURE-ONLY",
              brand: null,
              manufacturerPartNumber: null,
              description: null,
              priceKobo: "12345",
              compareAtPriceKobo: null,
              currency: "NGN",
              category: {
                id: "60000000-0000-4000-8000-000000000002",
                name: "Isolated category",
                slug: "isolated-category",
                description: null,
              },
              images: [],
              compatibilities: [],
              availability: [],
            },
          ],
        },
        meta: { requestId: "isolated-preview" },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Retry featured parts" })).toBeVisible();
  await expect(page.getByText(/No parts are published yet/)).toHaveCount(0);
  await expect(page.getByText(/No vehicles are published yet/)).toBeVisible();
  await expect(page.getByText(/Brake Pad Set|Executive Sedan|OEM Component/)).toHaveCount(
    0,
  );
  recovered = true;
  await page.getByRole("button", { name: "Retry featured parts" }).click();
  const productLink = page.getByRole("link", {
    name: "Isolated replacement component with a long catalogue name",
  });
  await expect(productLink).toHaveAttribute("href", `/parts/${partId}`);
  await expect(productLink.locator("xpath=ancestor::article")).toContainText("123.45");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
