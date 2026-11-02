import { test, expect } from "@playwright/test";

// The product cards must use the same vehicle-choice availability as the finder.
// Explicit reviewed/unknown fixtures avoid depending on the first live product.
const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const product = {
  id: id(2),
  name: "Synthetic reviewed part",
  slug: "synthetic-reviewed-part",
  sku: "QA-PART",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "100000",
  compareAtPriceKobo: null,
  currency: "NGN",
  category: { id: id(3), name: "Parts", slug: "parts", description: null },
  images: [],
  availability: [],
  compatibilities: [
    {
      id: id(4),
      make: "QA make",
      model: "QA model",
      yearFrom: 2018,
      yearTo: 2020,
      notes: null,
    },
  ],
};
for (const width of [390, 1440]) {
  test(`catalogue fitment guidance follows vehicle choices at ${width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    let makesAvailable = true;
    let makesError = false;
    const unexpectedWrites: string[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/v1/**", (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/public/fitment/makes"))
        return makesError
          ? route.fulfill({
              status: 503,
              json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
            })
          : route.fulfill({
              json: {
                success: true,
                data: {
                  items: makesAvailable
                    ? [{ id: "f7000000-0000-4000-8000-000000000001", name: "QA make" }]
                    : [],
                },
                message: "Isolated fitment fixture",
                meta: { requestId: "catalogue-fitment" },
              },
            });
      if (request.method() === "GET" && path.startsWith("/api/v1/public/catalog/"))
        return route.fulfill({
          json: {
            success: true,
            message: "Isolated catalogue fixture",
            meta: { requestId: "catalogue-fitment" },
            data: path.endsWith("/products/discovery")
              ? {
                  items: [
                    product,
                    {
                      ...product,
                      id: id(5),
                      name: "Synthetic unknown part",
                      compatibilities: [],
                    },
                  ],
                  totalMatches: 2,
                }
              : { items: [] },
          },
        });
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        unexpectedWrites.push(path);
        return route.abort();
      }
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "ISOLATED_REQUEST" } },
      });
    });

    await page.goto("/parts");
    // A fresh client search avoids using the server's real catalogue seed.
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("Synthetic first");
    const card = page
      .locator(".shop-product-card")
      .filter({ hasText: "Synthetic reviewed part" });
    const unknown = page
      .locator(".shop-product-card")
      .filter({ hasText: "Synthetic unknown part" });
    await expect(unknown).toContainText("Compatibility has not been confirmed.");
    await expect(unknown).not.toContainText("Reviewed application listed");
    await expect(card).toContainText("Reviewed application listed");
    await expect(card).toBeVisible();
    await expect(card).toContainText(
      "Select your vehicle and technical details to confirm fitment.",
    );
    await page.getByRole("radio", { name: "By vehicle" }).check();
    await expect(
      page.getByRole("heading", { name: "Find products for my vehicle" }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath(`catalogue-choice-${width}.png`) });

    makesAvailable = false;
    await page.reload();
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("Synthetic second");
    await page.getByRole("radio", { name: "By vehicle" }).check();
    await expect(page.locator(".parts-finder-unavailable")).toContainText("Ask our team");
    await expect(card).toContainText(
      "Ask our team to confirm fitment for your vehicle and technical details.",
    );
    await expect(card).not.toContainText("Select your vehicle");
    await page.screenshot({ path: info.outputPath(`catalogue-empty-${width}.png`) });

    makesError = true;
    await page.reload();
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .fill("Synthetic third");
    await expect(card).toContainText(
      "Ask our team to confirm fitment for your vehicle and technical details.",
    );
    await expect(card).not.toContainText("Select your vehicle");
    expect(pageErrors).toEqual([]);
    expect(unexpectedWrites).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
