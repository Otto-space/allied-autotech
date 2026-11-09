import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

// Served by the existing production-build loopback API; no application writes.
const viewports = [
  [1920, 1080],
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
];
const destinations = ["/services?search=diagnostics", "/services", "/parts", "/vehicles"];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/public/capabilities")
      return route.fulfill({
        json: { success: true, data: publicCapabilitiesFixture("browse_enquiries") },
      });
    if (path.startsWith("/api/v1/public/")) {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `http://127.0.0.1:5024${url.pathname}${url.search}`,
      });
      return route.fulfill({ response });
    }
    return route.fulfill({
      status: 401,
      json: { success: false, error: { code: "UNAUTHORIZED" } },
    });
  });
});
for (const [width, height] of viewports) {
  test(`Home reference composition and navigation ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(r.method() + " " + new URL(r.url()).pathname);
    });
    await page.goto("/");
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
    ).toEqual({ width, height });
    const hero = page.getByRole("region", { name: "Workshop highlights" });
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
      "Understand your vehicle’s condition.",
    );
    await expect(hero).toHaveAttribute("data-rotating", "false");
    for (let i = 0; i < 4; i++) {
      await hero
        .getByRole("button", { name: new RegExp(`Show slide ${i + 1}:`) })
        .click();
      await expect(hero).toHaveAttribute("data-slide", String(i + 1));
      await expect(hero.locator("a[data-hero-primary]:visible")).toHaveAttribute(
        "href",
        destinations[i],
      );
      await expect(hero.locator('img[data-current="true"]')).toHaveCount(1);
      await expect(hero.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
    await hero.getByRole("button", { name: /Show slide 1:/ }).click();
    await hero.getByRole("button", { name: "Next slide", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(hero).toHaveAttribute("data-slide", "4");
    await expect(hero.getByRole("status")).toContainText("Slide 4 of 4");
    await hero.getByRole("button", { name: /Show slide 1:/ }).click();
    for (const section of [
      ".home-discovery",
      ".home-services",
      ".home-workshop",
      ".home-shop",
      ".home-vehicles",
      ".home-faq",
      "footer",
    ]) {
      await page.locator(section).scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    const faq = page
      .locator("main")
      .getByText("Where is Allied AutoTech?", { exact: true });
    await faq.click();
    await expect(page.locator("details[open]")).toContainText("133 Stadium Road");
    await faq.click();
    await expect(page.locator(".support-controls")).toHaveCount(1);
    await expect(page.locator("footer")).toContainText("133 Stadium Road");
    await expect(
      page.locator("footer").getByRole("link", { name: "Privacy", exact: true }),
    ).toHaveAttribute("href", "/privacy");
    await page.evaluate(() => scrollTo(0, 0));
    const menu = page.getByRole("button", { name: "Open navigation", exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toHaveCount(
        0,
      );
      await expect(menu).toBeFocused();
    }
    if ([390, 1440].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .include("footer")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath(`home-${width}-viewport.png`) });
      await page.screenshot({
        path: info.outputPath(`home-${width}-full.png`),
        fullPage: true,
      });
    }
    await hero.getByRole("link", { name: "View diagnostics", exact: true }).click();
    await expect(page).toHaveURL(/\/services\?search=diagnostics$/);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test("all editorial images failing retains the task and stops rotation", async ({
  page,
}) => {
  await page.route("**/_next/image?*", (route) => {
    const image = new URL(route.request().url()).searchParams.get("url") ?? "";
    return /workshop-editorial|family-editorial|parts-editorial|showroom-neutral-editorial/.test(
      image,
    )
      ? route.fulfill({ status: 404, body: "" })
      : route.continue();
  });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Workshop highlights" });
  await expect(hero.getByText("Editorial image unavailable")).toBeVisible();
  await expect(hero).toHaveAttribute("data-rotating", "false");
  for (const button of await hero.getByRole("button").all())
    await expect(button).toBeDisabled();
  await expect(
    hero.getByRole("link", { name: "View diagnostics", exact: true }),
  ).toHaveAttribute("href", destinations[0]);
});
