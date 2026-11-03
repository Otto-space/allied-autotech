import { test, expect } from "@playwright/test";
import { workforceAccessFixture, id } from "../fixtures/workforce-access";
import { profileFixture, profileId } from "../fixtures/customer-profile";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { workOrdersFixture } from "../fixtures/work-orders";
for (const [width, height] of [
  [1280, 720],
  [320, 720],
])
  test.describe(`boundaries ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width === 320,
      hasTouch: width === 320,
    });
    test("private portrait uses the exact owned URL and falls back on image failure", async ({
      page,
    }, info) => {
      const state = await profileFixture(page);
      const photo = (n: number) => ({
        id: profileId(n),
        url: `/api/v1/customers/media/images/${profileId(n)}`,
        altText: null,
        sortOrder: 0,
        isPrimary: true,
        width: 64,
        height: 64,
      });
      state.record.photo = photo(77);
      await page.route("**/api/v1/customers/media/images/**", (route) => {
        const url = new URL(route.request().url());
        expect(url.search).toBe("");
        return url.pathname.endsWith(profileId(78))
          ? route.fulfill({ status: 404 })
          : route.fulfill({
              contentType: "image/png",
              body: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
                "base64",
              ),
            });
      });
      await page.goto("/dashboard/profile", { waitUntil: "load" });
      const summary = page.locator(".dashboard-account-menu summary");
      await expect(summary).toContainText("Amara Okafor");
      await expect
        .poll(() =>
          summary.locator("img").evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: info.outputPath("profile-populated.png") });
      const rejectedImage = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith(profileId(78)) &&
          response.status() === 404,
      );
      state.record.photo = photo(78);
      await page.getByRole("button", { name: "Refresh profile", exact: true }).click();
      await rejectedImage;
      await expect(summary).toContainText("Amara Okafor");
      await expect(summary.locator("img")).toHaveCount(0);
      expect(state.writes).toEqual([]);
    });
    test("managed own profile needs no operational grant and hides after access denial", async ({
      page,
    }) => {
      const state = await workforceAccessFixture(page, true, undefined, true);
      state.access.permissions = [];
      state.access.assignments = [];
      await page.route("**/api/v1/staff/profile", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated own account",
            meta: { requestId: "own-profile" },
            data: {
              id: id(1),
              email: "synthetic-workforce@example.test",
              role: "STAFF",
              status: "ACTIVE",
              staffProfile: null,
              capabilities: [],
            },
          },
        }),
      );
      await page.goto("/admin/profile", { waitUntil: "load" });
      await expect(page.locator(".work-own-profile .panel")).toBeVisible();
      await expect(page.locator(".work-own-profile")).toContainText("No name recorded");
      expect(new URL(page.url()).pathname).toBe("/admin/profile");
      expect(
        state.reads.some((p) =>
          /\/staff\/workforce\/(jobs|bookings|enquiries|complaints)$/.test(p),
        ),
      ).toBe(false);
      state.denied = true;
      await page.reload({ waitUntil: "load" });
      await expect(
        page.getByRole("heading", { name: "Work access unavailable", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".work-own-profile .panel")).toHaveCount(0);
      expect(state.writes).toEqual([]);
    });
    test("closed checkout empty state remains truthful without changing release capability", async ({
      page,
    }) => {
      const f = await workOrdersFixture(page, "SUPER_ADMIN");
      f.state.mode = "empty";
      await page.route("**/api/v1/public/capabilities", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated closed release",
            meta: { requestId: "audit-release" },
            data: {
              ...publicCapabilitiesFixture("browse_enquiries"),
              serverTime: new Date().toISOString(),
            },
          },
        }),
      );
      await page.goto("/admin/orders", { waitUntil: "load" });
      await expect(
        page.getByRole("heading", { name: "No orders on this page" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Existing orders remain available here. New online checkout is unavailable in this release.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("New orders will appear here when customers complete checkout.", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(f.base.writes).toEqual([]);
    });
  });
