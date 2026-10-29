import { test, expect } from "@playwright/test";

// The product cards must use the same vehicle-choice availability as the finder.
// Published catalogue reads are read-only; identity and writes stay isolated.
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
        return route.continue();
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
    const card = page.locator(".shop-product-card").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(
      "Choose your vehicle or ask our team to verify suitability.",
    );
    await page.getByRole("radio", { name: "Find Parts for My Car" }).check();
    await expect(
      page.getByRole("heading", { name: "Find products for my vehicle" }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath(`catalogue-choice-${width}.png`) });

    makesAvailable = false;
    await page.reload();
    await page.getByRole("radio", { name: "Find Parts for My Car" }).check();
    await expect(page.locator(".parts-finder-unavailable")).toContainText("Ask our team");
    await expect(card).toContainText(
      "Ask our team to verify suitability for your vehicle.",
    );
    await expect(card).not.toContainText("Choose your vehicle");
    await page.screenshot({ path: info.outputPath(`catalogue-empty-${width}.png`) });

    makesError = true;
    await page.reload();
    await expect(card).toContainText(
      "Ask our team to verify suitability for your vehicle.",
    );
    await expect(card).not.toContainText("Choose your vehicle");
    expect(pageErrors).toEqual([]);
    expect(unexpectedWrites).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
