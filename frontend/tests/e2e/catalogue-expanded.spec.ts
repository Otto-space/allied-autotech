import { expect, test } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
});

for (const width of [390, 1440]) {
  for (const kind of ["product", "vehicle"]) {
    test(`${kind} facet clearing preserves search and sort at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        kind === "product"
          ? "/parts?search=filter&sort=price_asc&maxPriceKobo=1"
          : "/vehicles?search=BMW&sort=price_asc&maxPriceKobo=1",
      );
      const active = page.getByLabel(`Active ${kind} filters`, { exact: true });
      await active
        .getByRole("button", { name: "Clear all filters", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`search=${kind === "product" ? "filter" : "BMW"}&sort=price_asc$`),
      );
      await expect(
        page.locator(kind === "product" ? ".shop-product-card" : ".vehicle-card").first(),
      ).toBeVisible();
      await expect(
        active.getByRole("button", { name: "Clear all filters", exact: true }),
      ).toHaveCount(0);
      await active.getByRole("button", { name: "Reset search", exact: true }).click();
      await expect(page).toHaveURL(kind === "product" ? /\/parts$/ : /\/vehicles$/);
    });
  }
  test(`Used hierarchy commits the recorded OR set only on Apply at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/vehicles");
    if (width < 1024) await page.locator(".vehicle-filter-trigger").click();
    const panel = page.locator("#vehicle-filter-panel");
    await panel.getByRole("radio", { name: "Used", exact: true }).check();
    await expect(
      panel.getByRole("checkbox", { name: "Used (origin unspecified)", exact: true }),
    ).toBeChecked();
    await expect(page).toHaveURL(/\/vehicles$/);
    await panel.getByRole("checkbox", { name: "Foreign used", exact: true }).uncheck();
    await panel
      .getByRole("checkbox", { name: "Nigerian (locally) used", exact: true })
      .uncheck();
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/conditions=USED$/);
    await expect(page.locator(".vehicle-card").first()).toContainText("AC not working");
  });
}

test("legacy merchandising filters remain removable without exposing the control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/parts?featured=true");
  await expect(
    page.locator("#product-filter-panel").getByLabel("Featured products"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Remove Featured only", exact: true }).click();
  await expect(page).toHaveURL(/\/parts$/);
});

test("all seven real vehicle photos remain usable in the responsive gallery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vehicles/83b356f8-c3a6-401e-8d88-41d974d11a2b");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2007 BMW 120i");
  await expect(
    page.locator(".vd-gallery > .vd-gallery-controls").getByRole("status"),
  ).toHaveText("Photo 1 of 7");
  const opener = page.getByRole("button", { name: "View photos", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Vehicle photos", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Photo 2 of 7");
  await page.keyboard.press("End");
  await expect(dialog.getByRole("status")).toHaveText("Photo 7 of 7");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .not.toBe("hidden");
});

test("long service category lists use one searchable paginated mechanism", async ({
  page,
}) => {
  const categories = Array.from({ length: 20 }, (_, i) => ({
    id: `f0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name: `Workshop category ${i + 1}`,
    slug: `workshop-${i + 1}`,
  }));
  await page.route("**/api/v1/public/services/categories?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Isolated category fixture",
        meta: { requestId: "catalogue-categories" },
        data: { items: categories, nextCursor: "A".repeat(120) },
      },
    }),
  );
  await page.goto("/services");
  await expect(page.locator("#service-category")).toHaveCount(0);
  await page.getByText("Find a category", { exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Category name", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Service category options pages" }),
  ).toBeVisible();
});

test("single Home vehicle has a complete photo, consistent identity and known specifications", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const section = page.locator(".home-vehicles");
  await section.scrollIntoViewIfNeeded();
  const card = section.locator(".home-vehicle-card");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText("2007 BMW 120i");
  await expect(card).toContainText("2.0 L · 5-door hatchback");
  await expect(card).toContainText("4 cylinders");
  await expect(card).toContainText("N46");
  await expect(card).toContainText(
    "AC not working. Owner reports a leak. Diagnosis and repair required.",
  );
  const media = (await card.locator(".product-media").boundingBox())!;
  const body = (await card.locator(".home-card__body").boundingBox())!;
  expect(media.width).toBeGreaterThan(600);
  expect(media.width / media.height).toBeCloseTo(4 / 3, 1);
  expect(body.y).toBeGreaterThanOrEqual(media.y + media.height - 1);
  await expect
    .poll(() =>
      card
        .locator("img")
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  await section.screenshot({
    path: path.join(os.tmpdir(), "aat-expanded-home-1440.png"),
  });
});

test("single catalogue cards favour larger photographs and omit internal SKU clutter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/parts");
  const product = page.locator(".shop-product-card").first();
  await expect(product).toBeVisible();
  await expect(product).not.toContainText("SKU");
  expect((await product.boundingBox())!.width).toBeGreaterThan(380);
  expect((await product.locator(".product-media").boundingBox())!.height).toBeLessThan(
    120,
  );
  await page.goto("/vehicles");
  const vehicle = page.locator(".vehicle-card").first();
  await expect(vehicle).toBeVisible();
  expect((await vehicle.boundingBox())!.width).toBeGreaterThan(540);
  await expect(vehicle).not.toContainText("Not listed");
  await expect(vehicle).toContainText(
    "AC not working. Owner reports a leak. Diagnosis and repair required.",
  );
  const media = (await vehicle.locator(".product-media").boundingBox())!;
  expect(media.width / media.height).toBeCloseTo(4 / 3, 1);
  await vehicle.screenshot({
    path: path.join(os.tmpdir(), "aat-expanded-large-vehicle-card.png"),
  });
  await page.goto("/");
  const service = page.locator(".home-services .service-discovery__item").first();
  await service.scrollIntoViewIfNeeded();
  const servicePhoto = (await service.locator("img").boundingBox())!;
  const serviceBody = (await service.locator(".service-discovery__body").boundingBox())!;
  expect(servicePhoto.width).toBeGreaterThan(300);
  expect(servicePhoto.y + servicePhoto.height).toBeLessThanOrEqual(serviceBody.y + 1);
  await page.goto("/about#equipment");
  const equipment = page.locator(".equipment-grid figure").first();
  await equipment.scrollIntoViewIfNeeded();
  const equipmentPhoto = (await equipment.locator(".equipment-image").boundingBox())!;
  const caption = (await equipment.locator("figcaption").boundingBox())!;
  expect(equipmentPhoto.width).toBeGreaterThan(180);
  expect(equipmentPhoto.y + equipmentPhoto.height).toBeLessThanOrEqual(caption.y + 1);
});

for (const dpr of [1, 2]) {
  test(`real responsive vehicle image selects a bounded derivative at DPR ${dpr}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    try {
      const response = page.waitForResponse(
        (response) =>
          response.url().includes("/api/catalogue-image/vehicles/images/") &&
          response.status() === 200,
      );
      await page.goto(`${baseURL}/vehicles`);
      const img = page.locator(".vehicle-card img").first();
      await img.scrollIntoViewIfNeeded();
      const derivative = await response;
      await expect
        .poll(() =>
          img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
        )
        .toBe(true);
      const measured = await img.evaluate((el: HTMLImageElement) => ({
        currentSrc: el.currentSrc,
        src: el.src,
        srcset: el.srcset,
        slot: el.getBoundingClientRect().width,
        naturalWidth: el.naturalWidth,
        dpr: devicePixelRatio,
      }));
      const original = await page.request.get(measured.src);
      const derivativeBytes = (await derivative.body()).byteLength;
      const dimensions = await sharp(await derivative.body()).metadata();
      const originalBytes = (await original.body()).byteLength;
      expect(measured.currentSrc).toContain("/api/catalogue-image/");
      expect(derivativeBytes).toBeLessThan(originalBytes);
      expect(derivative.headers()["cache-control"]).toBe("private, no-store");
      await fs.writeFile(
        path.join(os.tmpdir(), `aat-expanded-image-dpr${dpr}.json`),
        JSON.stringify(
          {
            ...measured,
            derivativeBytes,
            originalBytes,
            encodedWidth: dimensions.width,
            encodedHeight: dimensions.height,
          },
          null,
          2,
        ),
      );
      await page.screenshot({
        path: path.join(os.tmpdir(), `aat-expanded-vehicles-390-dpr${dpr}.png`),
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });
}
