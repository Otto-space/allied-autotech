import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";

const evidence = path.join(os.tmpdir(), "allied-brand-r2-20261026");
fs.mkdirSync(evidence, { recursive: true });
test.beforeEach(async ({ page }) => {
  // Browser requests cannot reach real accounts or submit any business mutation.
  await page.route("**/api/v1/**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const data = discoveryResponse(new URL(route.request().url()));
    await route.fulfill({
      status: data ? 200 : 401,
      json: data
        ? {
            success: true,
            data,
            message: "Isolated brand fixture",
            meta: { requestId: "brand-r2" },
          }
        : { success: false },
    });
  });
});

async function keyboardTo(page: Page, selector: string) {
  // Begin at the document, then use native keyboard navigation, never CSS focus classes.
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Control+Home");
  for (let index = 0; index < 180; index++) {
    await page.keyboard.press("Tab");
    if (await page.locator(selector).evaluate((node) => node === document.activeElement))
      return;
  }
  throw new Error(`Keyboard did not reach ${selector}`);
}

for (const width of [360, 390, 768, 1024, 1440]) {
  for (const [route, name, sections] of [
    ["/", "home", [".home-services", ".trust-story"]],
    ["/about", "about", [".about-hero"]],
    ["/services", "services", [".services-principles"]],
  ] as const) {
    test(`${name} complete artwork, white surfaces and actions at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      expect((await page.goto(route))?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const section of sections) {
        const area = page.locator(section);
        await area.scrollIntoViewIfNeeded();
        const image = area.locator(".campaign-artwork img");
        await expect
          .poll(() =>
            image.evaluate(
              (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const composition = await image.evaluate((node: HTMLImageElement) => ({
          ratio: node.clientWidth / node.clientHeight,
          fit: getComputedStyle(node).objectFit,
          resource: node.currentSrc,
          width: node.naturalWidth,
        }));
        expect(composition.ratio).toBeCloseTo(0.8, 2);
        expect(composition.fit).toBe("contain");
        expect(composition.resource).toContain("/brand/r2/");
        expect(composition.width).toBeLessThanOrEqual(1080);
        const link = area.getByRole("link").last();
        await expect(link).toBeVisible();
        const before = await link.boundingBox();
        await link.hover();
        await expect(link).toHaveCSS("visibility", "visible");
        const after = await link.boundingBox();
        expect(after?.width).toBe(before?.width);
        expect(after?.height).toBe(before?.height);
        if ([390, 1440].includes(width)) {
          // Document coordinates keep fixed navigation at the page top instead
          // of obscuring tall section captures. No UI is hidden for the shot.
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          const bounds = await area.boundingBox();
          await page.screenshot({
            path: path.join(evidence, `${name}-${section.slice(1)}-${width}.png`),
            fullPage: true,
            clip: bounds!,
          });
        }
        expect(
          (
            await new AxeBuilder({ page })
              .include(section)
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await expect(
        page.locator('img[src*="delivery"], img[src*="ad-copy-4"]'),
      ).toHaveCount(0);
      await expect(page.locator(".site-header__brand img")).toHaveAttribute(
        "src",
        "/brand/r2/mark-red.png",
      );
      await expect(page.locator("footer .brand-logo__mark")).toHaveAttribute(
        "src",
        "/brand/r2/mark-white.png",
      );
      expect(errors).toEqual([]);
    });
  }
}

test("CTA keyboard focus survives hover and Enter opens the intended journey", async ({
  page,
}) => {
  await page.goto("/about");
  await keyboardTo(page, '.about-actions a[href="/services"]');
  const link = page.locator('.about-actions a[href="/services"]');
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", "solid");
  await link.hover();
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-width", "3px");
  await page.screenshot({ path: path.join(evidence, "about-focus-hover.png") });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.locator("#service-catalogue")).toBeVisible();
});

test("mobile navigation retains the home identity and reaches Shop search", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({ status: 401, json: { success: false } }),
  );
  await page.goto("/about");
  await page.getByRole("button", { name: "Open navigation" }).tap();
  await expect(
    page.getByRole("navigation", { name: "Mobile primary navigation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile primary navigation" })
    .getByRole("link", { name: /Shop/ })
    .tap();
  await expect(page).toHaveURL(/\/parts$/);
  await expect(page.getByRole("searchbox").first()).toBeVisible();
  await context.close();
});

test("failed artwork keeps its reserved frame, explanation and working CTA", async ({
  page,
}) => {
  await page.route("**/brand/r2/precision-autocare-*.webp", (route) => route.abort());
  await page.goto("/about");
  await expect(page.locator(".campaign-artwork__fallback")).toContainText(
    "Precision Autocare",
  );
  const frame = await page.locator(".campaign-artwork").boundingBox();
  expect(frame!.width / frame!.height).toBeCloseTo(0.8, 2);
  await page.screenshot({ path: path.join(evidence, "about-artwork-failure.png") });
  await page
    .locator(".about-actions")
    .getByRole("link", { name: "Contact the team" })
    .click();
  await expect(page).toHaveURL(/\/contact$/);
});

test("slow artwork reserves space without blocking text or navigation", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/brand/r2/precision-autocare-*.webp", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("link", { name: "Explore services", exact: true }),
  ).toBeVisible();
  const before = await page.locator(".campaign-artwork").boundingBox();
  release();
  await expect
    .poll(() =>
      page
        .locator(".campaign-artwork img")
        .evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
    )
    .toBe(true);
  const after = await page.locator(".campaign-artwork").boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.width).toBe(before?.width);
});

for (const [route, selector] of [
  ["/", ".home-services"],
  ["/services", ".services-principles"],
]) {
  test(`failed artwork has readable fallback on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.route("**/brand/r2/*.webp", (request) => request.abort());
    await page.goto(route);
    const section = page.locator(selector);
    await section.scrollIntoViewIfNeeded();
    const fallback = section.locator(".campaign-artwork__fallback");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(
      (
        await new AxeBuilder({ page })
          .include(selector)
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}

test("200 percent CSS zoom reflows artwork and actions without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ["/", "/about", "/services"]) {
    await page.goto(route);
    // CSS zoom is explicit emulation, not a claim of physical-device/browser zoom.
    await page.evaluate(() => {
      document.body.style.zoom = "2";
    });
    for (const image of await page.locator(".campaign-artwork img").all()) {
      await image.scrollIntoViewIfNeeded();
      expect(await image.evaluate((node) => getComputedStyle(node).objectFit)).toBe(
        "contain",
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
});
