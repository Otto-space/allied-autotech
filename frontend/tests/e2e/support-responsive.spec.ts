import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";

async function anonymous(page: Page) {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: { success: false, error: { code: "SESSION_EXPIRED" } },
    }),
  );
}
for (const [width, height, mobile] of [
  [320, 740, true],
  [360, 800, true],
  [390, 844, true],
  [768, 1024, true],
  [850, 900, true],
  [851, 900, false],
  [1024, 768, false],
  [1280, 800, false],
  [1366, 768, false],
  [1440, 900, false],
  [1366, 480, false],
] as const)
  test(`support controls use ${mobile ? "mobile bar" : "desktop icons"} at ${width}x${height}`, async ({
    page,
  }) => {
    await anonymous(page);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/help");
    const controls = page.getByRole("navigation", {
      name: "Customer support",
      exact: true,
    });
    await expect(controls).toHaveCSS("flex-direction", mobile ? "row" : "column");
    const labels = controls.locator(".support-control-label");
    for (const label of await labels.all()) {
      if (mobile) await expect(label).toBeVisible();
      else await expect(label).toBeHidden();
    }
    const box = await controls.boundingBox();
    expect(box).not.toBeNull();
    if (mobile) {
      expect(box!.x).toBe(0);
      expect(box!.width).toBe(width);
    } else {
      expect(box!.width).toBe(48);
      expect(box!.x).toBe(width - 64);
    }
    const help = page.getByRole("button", { name: "Quick help", exact: true });
    await help.click();
    const dialog = page.getByRole("dialog", { name: "How can we help?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(help).toBeFocused();
    await expect(controls.getByRole("link")).toHaveAttribute("target", "_blank");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
    if ([390, 1024, 1366].includes(width))
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-support-${width}-${height}.png`),
      });
  });
test("resizing an open mobile header to a laptop closes the menu and restores desktop support", async ({
  page,
}) => {
  await anonymous(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation", exact: true })
    .getByRole("link", { name: "Services", exact: true })
    .focus();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation", exact: true })
      .getByRole("link", { name: "Services", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Customer support", exact: true }),
  ).toHaveCSS("flex-direction", "column");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});
test.describe("touch landscape", () => {
  test.use({ hasTouch: true });
  test("keeps the support bar on a landscape phone without applying it to laptops", async ({
    page,
  }) => {
    await anonymous(page);
    await page.setViewportSize({ width: 932, height: 430 });
    await page.goto("/help");
    await expect(
      page.getByRole("navigation", { name: "Customer support", exact: true }),
    ).toHaveCSS("flex-direction", "row");
    await page.setViewportSize({ width: 1024, height: 430 });
    await expect(
      page.getByRole("navigation", { name: "Customer support", exact: true }),
    ).toHaveCSS("flex-direction", "column");
  });
});
