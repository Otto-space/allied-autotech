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

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
  test(`Vehicles inventory hierarchy and filter layout at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/vehicles");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Explore vehicle listings",
    );
    await expect(page.locator(".vehicle-card").first()).toBeVisible();
    await expect(page.locator(".vehicle-hero-media")).toHaveCount(0);
    await expect(page.locator("#vehicle-search")).not.toBeFocused();
    const panel = page.locator("#vehicle-filter-panel");
    if (width >= 1024) {
      await expect(panel).toBeVisible();
      expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(false);
      await expect(
        panel.getByRole("button", { name: "Apply filters", exact: true }),
      ).toBeInViewport();
      const rail = (await panel.boundingBox())!;
      const card = (await page.locator(".vehicle-card").first().boundingBox())!;
      expect(rail.width).toBeGreaterThanOrEqual(260);
      expect(rail.width).toBeLessThanOrEqual(300);
      expect(rail.x + rail.width).toBeLessThan(card.x);
      await expect(panel.locator("input").first()).not.toBeFocused();
      await page
        .getByRole("button", { name: /Filters/, exact: false })
        .first()
        .click();
      await expect(panel).not.toBeVisible();
      await page.locator(".vehicle-filter-trigger").click();
      await expect(panel).toBeVisible();
    } else {
      await expect(panel).not.toBeVisible();
      const trigger = page.getByRole("button", { name: "Filters", exact: true });
      await trigger.click();
      await expect(panel).toBeVisible();
      expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(true);
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expect(
        panel.getByRole("button", { name: "Apply filters", exact: true }),
      ).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(panel).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(os.tmpdir(), `aat-vehicles-redesign-${width}.png`),
      fullPage: false,
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

test("Filter drawer to desktop transition restores page scrolling and preserves drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vehicles");
  const panel = page.locator("#vehicle-filter-panel");
  await page.locator(".vehicle-filter-trigger").click();
  await page.getByLabel("Maximum price (NGN)", { exact: true }).fill("4000000");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .not.toBe("hidden");
  expect(await panel.evaluate((el) => el.matches(":modal"))).toBe(false);
  await expect(page.getByLabel("Maximum price (NGN)", { exact: true })).toHaveValue(
    "4000000",
  );
  await expect(
    panel.getByRole("button", { name: "Apply filters", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .not.toBe("hidden");
});

test("short mobile drawers keep actions visible and contain keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const kind of ["vehicle", "product"] as const) {
    await page.goto(kind === "vehicle" ? "/vehicles" : "/parts");
    const trigger = page.locator(`.${kind}-filter-trigger`);
    const panel = page.locator(`#${kind}-filter-panel`);
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const close = panel.getByRole("button", { name: "Close filters", exact: true });
    const apply = panel.getByRole("button", { name: "Apply filters", exact: true });
    await expect(apply).toBeInViewport();
    expect((await apply.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(apply).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
});

for (const width of [390, 1440]) {
  test(`Vehicle drafts preview, cancel, reset, apply and history at ${width}`, async ({
    page,
  }) => {
    const previews: string[] = [];
    await page.route("**/api/v1/public/vehicles/discovery?**", (route) => {
      const query = new URL(route.request().url()).searchParams;
      if (query.get("limit") === "1" && query.has("maxPriceKobo")) {
        previews.push(query.toString());
        return route.fulfill({
          json: {
            success: true,
            data: { totalMatches: 0 },
            message: "Isolated count fixture",
            meta: { requestId: "redesign-count" },
          },
        });
      }
      return route.continue();
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/vehicles");
    const panel = page.locator("#vehicle-filter-panel");
    const trigger = page.locator(".vehicle-filter-trigger");
    if (width < 1024) await trigger.click();
    await expect(panel).toBeVisible();
    const maximum = page.getByLabel("Maximum price (NGN)", { exact: true });
    await maximum.fill("1000000");
    await expect(panel.getByRole("status")).toHaveText("0 matching vehicles");
    await expect(page).toHaveURL(/\/vehicles$/);
    expect(previews).toHaveLength(1);
    await panel.getByRole("button", { name: "Close filters", exact: true }).click();
    await trigger.click();
    await expect(maximum).toHaveValue("");
    await maximum.fill("1000000");
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/maxPriceKobo=100000000/);
    await expect(
      page.getByRole("heading", { name: "No matching vehicles", exact: true }),
    ).toBeVisible();
    if (width < 1024) await trigger.click();
    await panel.getByRole("button", { name: "Reset draft", exact: true }).click();
    await expect(maximum).toHaveValue("");
    await expect(page).toHaveURL(/maxPriceKobo=100000000/);
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/\/vehicles$/);
    await expect(page.locator(".vehicle-card").first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/maxPriceKobo=100000000/);
    await expect(
      page.getByRole("heading", { name: "No matching vehicles", exact: true }),
    ).toBeVisible();
  });
}
