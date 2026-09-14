import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/public/services?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Services retrieved",
        data: { items: [] },
        meta: { requestId: "browser-test" },
      },
    }),
  );
});
for (const width of [320, 768, 1440]) {
  test(`homepage and automated help at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Every kilometre",
    );
    await expect(page.getByText("Services are not listed yet")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-home-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Quick help" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Your question").fill("Where is the workshop location?");
    await page.getByRole("button", { name: "Find an answer" }).click();
    await expect(page.getByRole("dialog").getByText(/133 Stadium Road/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Quick help" })).toBeFocused();
    expect(failures).toEqual([]);
  });
}
test("help search and no-match recovery", async ({ page }) => {
  await page.goto("/help");
  await page.getByLabel("Search help topics").fill("zzzxxyy");
  await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("main")
    .getByText("How do I book a service?", { exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Explore services" })).toBeVisible();
});
test("service failure remains an error with a working retry", async ({ page }) => {
  await page.route("**/api/v1/public/services?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        message: "PRIVATE EXCEPTION",
        error: { code: "DATABASE_UNAVAILABLE" },
      },
    }),
  );
  await page.goto("/services");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByText("PRIVATE EXCEPTION")).toHaveCount(0);
  await expect(page.getByText("Services are not listed yet")).toHaveCount(0);
  await page.route("**/api/v1/public/services?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Services retrieved",
        data: { items: [] },
        meta: { requestId: "browser-test" },
      },
    }),
  );
  await page.getByRole("button", { name: "Retry services" }).click();
  await expect(page.getByText("Services are not listed yet")).toBeVisible();
});
