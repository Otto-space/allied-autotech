import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const services = [
  [
    "Comprehensive Vehicle Diagnostics",
    "3c25b4f8-10e9-43e5-b8cb-63206bab6395",
    "diagnostics-at-work",
    "₦8,000",
  ],
  [
    "Wheel Alignment",
    "14e8ba81-1fc2-4057-ba50-99c15060aea2",
    "alignment-at-work",
    "₦4,000",
  ],
  [
    "Generic Lube Oil Service",
    "69e474a3-8ff5-4be5-a7ea-8edffded4bcf",
    "oil-service",
    "₦8,000",
  ],
] as const;

for (const width of [320, 390, 768, 1440]) {
  test(`approved service photography and catalogue geometry at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    expect((await page.goto("/services"))?.status()).toBe(200);
    const rows = page.locator(".services-row");
    await expect(rows).toHaveCount(4);
    const widths: number[] = [];
    for (const row of await rows.all()) {
      await row.scrollIntoViewIfNeeded();
      const image = row.getByRole("img");
      await expect
        .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      const media = await row.locator(".services-row-media").boundingBox();
      expect(media!.width / media!.height).toBeCloseTo(1.5, 1);
      widths.push((await row.boundingBox())!.width);
      await expect(row.getByRole("link", { name: /^View / })).toBeVisible();
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    await expect(rows.filter({ hasText: "Tyre Change" }).locator("img")).toHaveAttribute(
      "src",
      /tyre-care-at-work/,
    );
    await expect(rows.filter({ hasText: "Generic Lube Oil Service" })).toContainText(
      "Illustrative image",
    );
    expect(await page.locator("main").innerText()).not.toMatch(
      /workbook|already reflecting|No additional discount/,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    if ([390, 1440].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.locator("#service-catalogue").scrollIntoViewIfNeeded();
      await page.evaluate(
        () =>
          document.activeElement instanceof HTMLElement && document.activeElement.blur(),
      );
      await page.screenshot({
        path: info.outputPath(`catalogue-${width}.png`),
        fullPage: true,
        caret: "initial",
      });
    }
    expect(errors).toEqual([]);
  });
}

for (const [name, id, asset, price] of services) {
  test(`${name} retains its actual scope, price and discovery action`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    expect((await page.goto(`/services/${id}`))?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name, exact: true }),
    ).toBeVisible();
    const photograph = page.locator(".sd-media img");
    await expect(photograph).toHaveAttribute("src", new RegExp(asset));
    await expect
      .poll(() =>
        photograph.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(page.locator(".sd-overview")).toContainText(price);
    expect(await page.locator("main").innerText()).not.toMatch(
      /workbook|already reflecting|No additional discount/,
    );
    await expect(
      page.getByRole("link", { name: /Send an enquiry/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Book now/ })).toHaveCount(0);
    if (asset === "oil-service") {
      await expect(page.locator(".sd-media")).toContainText("Illustrative image");
      await expect(page.locator(".sd-description")).toContainText("Basic Oil Service");
    }
    if (asset === "alignment-at-work")
      await expect(page.locator(".sd-description")).toContainText("seven days");
    for (const image of await page.locator(".sd-more-media img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      scrollTo(0, 0);
    });
    await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({
      path: info.outputPath(`${asset}-390.png`),
      fullPage: true,
      caret: "initial",
    });
  });
}

test("an image failing before enhancement leaves service identity and enquiry available", async ({
  page,
}) => {
  await page.route("**/images/workshop/owner/diagnostics-at-work.webp", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto(`/services/${services[0][1]}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("img", { name: "Service image unavailable", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: services[0][0], exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Send an enquiry/ }).first()).toBeVisible();
});

test("the first service photograph and description are readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`/services/${services[0][1]}`);
    await expect(page.locator(".sd-media img")).toHaveAttribute(
      "src",
      /diagnostics-at-work/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: services[0][0], exact: true }),
    ).toBeVisible();
    expect(await page.locator(".sd-description").innerText()).not.toMatch(
      /workbook|already reflecting/,
    );
  } finally {
    await context.close();
  }
});
