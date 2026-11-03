import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
const destinations = [
  "/admin/vehicles",
  "/admin/profile",
  "/admin/service-categories",
  "/admin/workforce/bookings",
  "/admin/workforce/aftercare",
  "/admin/refunds",
  "/admin/payment-disputes/work",
  "/admin/privacy",
  "/admin/finance-policy",
];
const articles = destinations.map((href, index) => ({
  id: `staff-topic-${index}`,
  title: `Staff guidance ${index + 1}`,
  summary: "Read the authorised guidance.",
  prerequisites: "Authorised access is required.",
  steps: ["Review the current record."],
  outcome: "The next step is clear.",
  recovery: "Contact the team.",
  keywords: "staff",
  page: "work",
  href,
  source: "Synthetic browser fixture",
  version: 1,
  status: "published",
  reviewedAt: "2026-11-01",
}));
for (const width of [390, 1440])
  test(`authorised Help destinations survive navigation and refresh at ${width}`, async ({
    page,
  }) => {
    // Nine independent destinations each navigate, reload and return; keep the whole flow bounded.
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      expect(route.request().method()).toBe("GET");
      if (endpoint.endsWith("/auth/session"))
        return route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        });
      return route.fulfill({
        json: {
          success: true,
          message: "Synthetic authorised catalogue",
          meta: { requestId: "destination-test" },
          data: endpoint.endsWith("/learning/catalogue")
            ? {
                accessKey: "a".repeat(64),
                audience: "work",
                contentVersion: 1,
                mode: "browse_enquiries",
                flags: { guides: false, practice: false, ai: false },
                articles,
                guides: [],
                scenarios: [],
              }
            : { items: [] },
        },
      });
    });
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const article of articles) {
      await page
        .getByRole("link", { name: "Read answer: " + article.title, exact: true })
        .click();
      await expect(page.locator(".learning-detail")).toBeVisible();
      await expect(
        page.locator(".learning-detail").locator(`a[href="${article.href}"]`),
      ).toHaveCount(1);
      await page.reload();
      await expect(
        page.locator(".learning-detail").locator(`a[href="${article.href}"]`),
      ).toHaveCount(1);
      await page.getByRole("link", { name: "Back to results" }).click();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-destinations-${width}.png`),
    });
  });
