import { expect, test } from "@playwright/test";

for (const width of [320, 1440])
  test(`public Help and catalogue actions match the enquiries release at ${width}px`, async ({
    page,
  }, info) => {
    const writes: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) {
        writes.push(new URL(route.request().url()).pathname);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/help/vehicle-inspections");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Can I inspect a vehicle before buying?",
    );
    await expect(main).toContainText("Send a vehicle enquiry");
    await expect(main).toContainText("confirms any visit separately");
    await expect(main).not.toContainText("Use the inspection request option");
    await page.screenshot({ path: info.outputPath(`inspection-help-${width}.png`) });
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/contact#enquiry$/);
    await expect(main).toContainText(
      "does not confirm a booking, order or vehicle reservation",
    );
    await page.goto("/parts");
    await expect(main).toContainText("workshop collection");
    await expect(main).toContainText("Browsing does not reserve stock");
    const product = main
      .locator('a[href^="/parts/"]')
      .filter({ has: page.locator("h3") })
      .first();
    const productName = await product.getByRole("heading").innerText();
    await product.click();
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(productName);
    await expect(
      main.getByRole("button", { name: /add to cart|pay now|place order/i }),
    ).toHaveCount(0);
    await expect(main.getByRole("link", { name: /checkout/i })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(writes).toEqual([]);
  });
