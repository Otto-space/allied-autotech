import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";

// Real public API reads only. Never publish fixtures or submit an enquiry.
test.skip(
  process.env.AAT_REAL_EMPTY_ACCEPTANCE !== "true",
  "Requires explicit acceptance of the current real empty catalogue; never assumes future business data is empty.",
);
for (const width of [390, 1440])
  test(`real empty catalogue and editable handoffs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.continue();
    });
    const dir = path.join(os.tmpdir(), "allied-shop-r2-real");
    await mkdir(dir, { recursive: true });
    await page.goto(
      "/parts?search=engine+oil&family=ENGINE_OIL&minPriceKobo=1000000&maxPriceKobo=5000000",
    );
    await expect(
      page.getByRole("heading", { name: "No products are published yet", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: path.join(dir, `shop-${width}.png`), fullPage: true });
    for (const link of await page
      .getByRole("link", { name: "Ask about a product", exact: true })
      .all()) {
      expect(await link.getAttribute("href")).toContain("part_minPriceKobo=1000000");
      expect(await link.getAttribute("href")).toContain("part_maxPriceKobo=5000000");
    }
    await page
      .getByRole("link", { name: "Ask about a product", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("PRODUCT");
    await expect(page.locator("#support-opening")).toHaveValue(/Minimum budget:.*10,000/);
    await expect(page.locator("#support-opening")).toHaveValue(/Maximum budget:.*50,000/);
    await page.goto(
      "/vehicles?search=Toyota+Corolla&conditions=FOREIGN_USED&maxPriceKobo=1500000000",
    );
    await expect(
      page.getByRole("heading", { name: "No vehicles are published yet", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(dir, `vehicles-${width}.png`),
      fullPage: true,
    });
    await page.locator('a[href^="/contact?vehicle=1"]').first().click();
    await expect(
      page.getByRole("heading", { name: "You have an unsent enquiry", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start this enquiry", exact: true }).click();
    await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("VEHICLE");
    await expect(
      page.getByRole("radio", { name: "Discuss my vehicle requirements", exact: true }),
    ).toBeChecked();
    await expect(page.locator("#support-opening")).toHaveValue(/Toyota Corolla/);
    await expect(page.locator("#support-opening")).toHaveValue(/Foreign used/);
    await expect(page.locator("#support-opening")).toHaveValue(/15,000,000/);
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
    await page.screenshot({
      path: path.join(dir, `contact-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
