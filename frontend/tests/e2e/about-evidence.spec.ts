import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { operatingPrinciples } from "../../lib/brand-content";

test.beforeEach(async ({ context }) => {
  // Public page rendering only. No sign-in, customer data or business mutations.
  await context.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 401, json: { success: false } }),
  );
});

for (const width of [360, 390, 768, 1440]) {
  test(`About principles and equipment inspection at ${width}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 936 });
    await page.emulateMedia({
      reducedMotion: width === 360 || width === 1440 ? "reduce" : "no-preference",
    });
    await page.goto("/about");
    await expect(page).toHaveTitle(/About Allied AutoTech/);
    await expect(page.locator("main h1")).toHaveText("Automotive care in Port Harcourt");
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "Our principles" })
      .click();
    await expect(page).toHaveURL(/#principles$/);
    const principles = page.locator("#principles");
    await expect(principles.locator(".principles-list > li:visible")).toHaveCount(4);
    const more = principles.locator("summary");
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(principles.locator(".principles-list > li:visible")).toHaveCount(11);
    for (const [title, copy] of operatingPrinciples) {
      await expect(
        principles.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(principles.getByText(copy, { exact: true })).toBeVisible();
    }
    await more.press("Space");
    await expect(principles.locator(".principles-list > li:visible")).toHaveCount(4);
    await expect(more).toBeFocused();
    await page.screenshot({ path: info.outputPath(`principles-${width}.png`) });
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "Workshop equipment" })
      .click();
    await expect(page).toHaveURL(/#equipment$/);
    const trigger = page.getByRole("link", {
      name: "View photo of 3D alignment machine",
      exact: true,
    });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "3D alignment machine",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close photo", exact: true });
    await expect(close).toBeFocused();
    const image = dialog.getByRole("img", { name: "3D alignment machine", exact: true });
    await expect
      .poll(() =>
        image.evaluate(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(image).toHaveCSS("object-fit", "contain");
    expect((await image.boundingBox())!.width).toBeGreaterThan(200);
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await close.hover();
    expect(await close.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    const box = (await close.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(936);
    expect(
      (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`equipment-preview-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    const group = page.locator(".equipment-disclosure").filter({
      has: page.getByRole("heading", { name: /Electronic & electrical diagnostics/ }),
    });
    await group.locator("summary").press("Enter");
    const next = group.getByRole("link", {
      name: "View photo of Autel MK808S diagnostic tablet",
      exact: true,
    });
    await next.click();
    await page
      .getByRole("dialog", { name: "Autel MK808S diagnostic tablet", exact: true })
      .getByRole("button", { name: "Close photo", exact: true })
      .click();
    await expect(next).toBeFocused();
    await expect(group).toHaveAttribute("open", "");
    expect(
      (
        await new AxeBuilder({ page })
          .include("#principles")
          .include("#equipment")
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`Equipment image failure stays recoverable at ${width}`, async ({ page }) => {
    let failImage = true;
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      const imagePath = url.searchParams.get("url") ?? url.pathname;
      if (imagePath.endsWith("/3d-alignment.jpg") && failImage)
        return route.fulfill({ status: 503, body: "Image unavailable" });
      return route.fallback();
    });
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/about#equipment");
    const trigger = page.getByRole("link", {
      name: "View photo of 3D alignment machine",
      exact: true,
    });
    await expect(trigger).toContainText("Photo unavailable");
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "3D alignment machine",
      exact: true,
    });
    await expect(dialog.getByText("This photo could not load.")).toBeVisible();
    await expect(
      dialog.getByText("Supports precise wheel-alignment checks."),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
    ).toEqual([]);
    failImage = false;
    await dialog.getByRole("button", { name: "Retry photo" }).click();
    await expect
      .poll(() =>
        dialog.getByRole("img").evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(dialog.getByText("This photo could not load.")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}

test("A slow equipment photo keeps Close available on a short screen", async ({
  page,
}) => {
  // Use a wider short viewport so the detail requests a larger derivative than
  // the now-readable thumbnail; an already decoded identical URL cannot be delayed.
  await page.setViewportSize({ width: 1024, height: 568 });
  await page.goto("/about#equipment");
  const trigger = page.getByRole("link", {
    name: "View photo of 3D alignment machine",
    exact: true,
  });
  await expect
    .poll(() =>
      trigger.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((url.searchParams.get("url") ?? url.pathname).endsWith("/3d-alignment.jpg")) {
      requested = true;
      await delayed;
    }
    await route.fallback();
  });
  try {
    await trigger.click();
    await expect.poll(() => requested).toBe(true);
    const dialog = page.getByRole("dialog", {
      name: "3D alignment machine",
      exact: true,
    });
    await expect(dialog.getByText("Loading photo…")).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close photo", exact: true });
    const box = (await close.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(568);
    await close.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  } finally {
    release();
  }
});
