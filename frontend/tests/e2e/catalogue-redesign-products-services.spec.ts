import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET"
      ? route.continue()
      : route.fulfill({
          status: 403,
          json: { success: false, error: { code: "QA_READ_ONLY" } },
        }),
  );
});

for (const route of ["/parts", "/services"]) {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    test(`${route} image-led catalogue at ${width}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveText(
        route === "/parts"
          ? "Find the right parts"
          : "Find the service your vehicle needs",
      );
      const card = page
        .locator(route === "/parts" ? ".shop-product-card" : ".services-row")
        .first();
      await expect(card).toBeVisible();
      const media = card.locator(
        route === "/parts" ? ".product-media" : ".services-row-media",
      );
      const identity = card.locator(
        route === "/parts" ? ".shop-product-identity" : ".services-row-copy",
      );
      const photoBox = (await media.boundingBox())!;
      const copyBox = (await identity.boundingBox())!;
      expect(photoBox.y + photoBox.height).toBeLessThanOrEqual(copyBox.y + 1);
      expect(photoBox.width).toBeGreaterThan(width < 375 ? 250 : width < 768 ? 140 : 240);
      if (route === "/parts") {
        await expect(
          page.getByRole("radio", { name: "Find Parts for My Car", exact: true }),
        ).toBeVisible();
        await expect(card.getByText("Image unavailable", { exact: true })).toBeVisible();
        const panel = page.locator("#product-filter-panel");
        if (width >= 1024) {
          await expect(panel).toBeVisible();
          await expect(
            panel.getByRole("button", { name: "Apply filters", exact: true }),
          ).toBeInViewport();
        } else {
          await page.locator(".product-filter-trigger").click();
          await expect(panel).toBeVisible();
          expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(true);
          await expect(
            panel.getByRole("button", { name: "Apply filters", exact: true }),
          ).toBeInViewport();
          await page.keyboard.press("Escape");
          await expect(panel).not.toBeVisible();
          await expect(page.locator(".product-filter-trigger")).toBeFocused();
        }
      } else {
        await expect(
          page.getByRole("link", { name: /Describe a vehicle problem/ }),
        ).toHaveAttribute("href", "/contact#enquiry");
        await expect(card.getByText("Quotation required", { exact: true })).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: path.join(os.tmpdir(), `aat-${route.slice(1)}-redesign-${width}.png`),
      });
      if (width === 390 || width === 1440)
        expect(
          (
            await new AxeBuilder({ page })
              .include("main")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) {
  test(`Shop unavailable finder, count preview and deliberate Apply at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/parts");
    await page.getByRole("radio", { name: "Find Parts for My Car", exact: true }).check();
    await expect(page.locator(".parts-finder-unavailable")).toBeVisible();
    await expect(page.locator(".parts-finder-unavailable a")).toHaveAttribute(
      "href",
      /\/contact\?/,
    );
    await page
      .getByRole("radio", { name: "Search by part name or number", exact: true })
      .check();
    await expect(page.locator(".parts-finder-region")).not.toBeVisible();
    const panel = page.locator("#product-filter-panel");
    if (width < 1024) await page.locator(".product-filter-trigger").click();
    const maximum = panel.getByLabel("Maximum", { exact: true });
    await maximum.fill("0.01");
    await expect(panel.getByRole("status").last()).toHaveText("0 matching products");
    await expect(page).toHaveURL(/\/parts$/);
    await panel.getByRole("button", { name: "Close filters", exact: true }).click();
    await page.locator(".product-filter-trigger").click();
    await expect(maximum).toHaveValue("");
    await maximum.fill("0.01");
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    if (width >= 1024) await expect(panel).toBeVisible();
    else await expect(panel).not.toBeVisible();
    await expect(page).toHaveURL(/maxPriceKobo=1(?:&|$)/);
    await expect(
      page.getByRole("heading", { name: "No matching products", exact: true }),
    ).toBeVisible();
    if (width < 1024) await page.locator(".product-filter-trigger").click();
    await panel.getByRole("button", { name: "Reset draft", exact: true }).click();
    await expect(maximum).toHaveValue("");
    await expect(page).toHaveURL(/maxPriceKobo=1(?:&|$)/);
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/\/parts$/);
    await expect(page.locator(".shop-product-card").first()).toBeVisible();
  });

  test(`Services search recovery, sorting and problem enquiry at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/services");
    await page.getByRole("link", { name: /Browse a service/ }).click();
    await expect(page.locator("#service-catalogue")).toBeInViewport();
    await page
      .getByLabel("Search services", { exact: true })
      .fill("zz-no-matching-service");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No matching services", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filter", exact: true }).click();
    await expect(page.locator(".services-row").first()).toBeVisible();
    await page.getByLabel("Sort services", { exact: true }).selectOption("duration_asc");
    await expect(page).toHaveURL(/sort=duration_asc/);
    await page.getByRole("link", { name: /Describe a vehicle problem/ }).click();
    await expect(page).toHaveURL(/\/contact#enquiry$/);
    await expect(page.locator("#enquiry")).toBeInViewport();
  });
}
