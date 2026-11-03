import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workSupportFixture } from "../fixtures/work-support";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
test.skip(
  process.env.RUN_CONSOLIDATED_AUDIT_FIXTURES !== "true",
  "Requires the isolated audit SSR fixture; never run against real inventory.",
);
const sizes = [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
];
for (const [width, height] of sizes)
  test.describe(`${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      deviceScaleFactor: width <= 430 ? 2 : 1,
    });
    test("submitted search prioritises matches and retains empty-category navigation", async ({
      page,
    }, info) => {
      await page.goto("/search?scope=all&search=Synthetic", {
        waitUntil: "load",
      });
      await expect(
        page.getByRole("heading", { name: "Search results", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Close search", exact: true }),
      ).toBeEnabled();
      const results = page.getByRole("region", { name: "Vehicles search results" });
      await expect(
        results.getByRole("link", { name: "Synthetic test vehicle", exact: true }),
      ).toBeVisible();
      const box = await results.boundingBox();
      expect(box!.y).toBeLessThan(width <= 430 ? 620 : 560);
      await page.getByText("Services: no matches", { exact: true }).click();
      await expect(
        page.getByRole("link", { name: "View all services results" }),
      ).toHaveAttribute("href", "/services?search=Synthetic");
      await expect(page.getByLabel("Search for", { exact: true })).toHaveValue(
        "Synthetic",
      );
      await page.getByLabel("Search for", { exact: true }).fill("Changed");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page).toHaveURL(/search=Changed/);
      await page.goBack();
      await expect(page.getByLabel("Search for", { exact: true })).toHaveValue(
        "Synthetic",
      );
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
      await page.screenshot({ path: info.outputPath("search.png") });
    });
    test("single Home listing preserves full owner faults and natural image proportions", async ({
      page,
    }, info) => {
      await page.goto("/", { waitUntil: "load" });
      const card = page.locator(".home-vehicle-card");
      await expect(card).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      const statement = card.locator(".vehicle-owner-issue-preview span");
      await expect(statement).toContainText(
        "Confirm the full condition before making an enquiry.",
      );
      expect(
        await statement.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
      const img = card.locator(".product-media img");
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      expect(["contain", "cover"]).toContain(
        await img.evaluate((el) => getComputedStyle(el).objectFit),
      );
      const grid = await card.boundingBox();
      if (width >= 1024) expect(grid!.width).toBeGreaterThan(600);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("home-vehicle.png") });
    });
    test("support action stays beside the subject within the contained table", async ({
      page,
    }, info) => {
      const f = await workSupportFixture(page, "SUPER_ADMIN");
      await page.goto("/admin/support", { waitUntil: "load" });
      const row = page.locator(".wsu-record").first();
      await expect(row).toBeVisible();
      const identity = row.locator("td").first();
      await expect(
        identity.getByRole("link", { name: "Service estimate request", exact: true }),
      ).toBeVisible();
      const action = identity.getByRole("link", {
        name: "Open case Service estimate request",
        exact: true,
      });
      await expect(action).toBeVisible();
      const rect = await action.boundingBox(),
        region = await page
          .getByRole("region", { name: "Customer care cases" })
          .boundingBox();
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(region!.x + region!.width + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(f.support.writes).toEqual([]);
      await page.screenshot({ path: info.outputPath("support.png") });
    });
    test("workforce action is available with identity before horizontal scrolling", async ({
      page,
    }, info) => {
      const f = await workStaffDetailFixture(page, "SUPER_ADMIN");
      await page.route(/\/api\/v1\/admin\/workforce\/accounts(?:\?.*)?$/, (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated audit directory",
            meta: { requestId: "audit-directory" },
            data: {
              generatedAt: "2026-11-03T10:00:00.000Z",
              items: [
                {
                  userId: f.member.id,
                  name: "Synthetic colleague",
                  email: "colleague@example.test",
                  role: "STAFF",
                  status: "ACTIVE",
                  verified: true,
                  managed: true,
                  position: "WORKSHOP_LEAD",
                  version: 1,
                  accountBranch: { id: id(101), name: "Test workshop", isActive: true },
                  responsibilities: [],
                  responsibilitiesMore: false,
                  canInspect: true,
                },
              ],
            },
          },
        }),
      );
      await page.goto("/admin/workforce/access", { waitUntil: "load" });
      const link = page.getByRole("link", {
        name: "View/manage Synthetic colleague",
        exact: true,
      });
      await expect(link).toBeVisible();
      const cell = link.locator("..");
      await expect(cell).toContainText("Synthetic colleague");
      const box = await link.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("directory.png") });
    });
  });
