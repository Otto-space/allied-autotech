import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture as securityFixture } from "../fixtures/security";
import { profileFixture, profileId } from "../fixtures/customer-profile";
import { workInvoiceFixture, id as invoiceId } from "../fixtures/work-invoices";

const viewports = [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
];
for (const [width, height] of viewports)
  test.describe(`${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      deviceScaleFactor: width <= 430 ? 2 : 1,
    });
    test("compact shell, account destinations, MFA spacing and keyboard recovery", async ({
      page,
    }, info) => {
      const state = await securityFixture(page, "SUPER_ADMIN");
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/admin/security", { waitUntil: "load" });
      const group = page.getByRole("group", { name: "MFA setup options" });
      await expect(group).toBeVisible();
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });
      const controls = await group.locator("a").evaluateAll((links) =>
        links.map((link) => {
          const { x, y, width, height } = link.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      expect(controls).toHaveLength(2);
      expect(controls.every((control) => control.height >= 44)).toBe(true);
      const [a, b] = controls;
      expect(
        Math.max(b.x - (a.x + a.width), b.y - (a.y + a.height)),
      ).toBeGreaterThanOrEqual(8);
      const summary = page.locator(".dashboard-account-menu summary");
      await summary.click();
      await expect(
        page
          .getByRole("navigation", { name: "Your account" })
          .getByRole("link", { name: "Account security" }),
      ).toHaveAttribute("href", "/admin/security");
      await expect(
        page
          .getByRole("navigation", { name: "Your account" })
          .getByRole("link", { name: "My profile" }),
      ).toHaveAttribute("href", "/admin/profile");
      await summary.press("Escape");
      await expect(summary).toBeFocused();
      const search = page.getByRole("searchbox", { name: "Search dashboard pages" });
      if (width <= 900) {
        await expect(search).toBeHidden();
        await page.getByRole("button", { name: "Find a dashboard page" }).click();
        await expect(search).toBeFocused();
      }
      await search.fill("security");
      await expect(page.locator(".dashboard-search-results")).toBeVisible();
      await search.press("Escape");
      if (width <= 900) {
        await expect(
          page.getByRole("button", { name: "Find a dashboard page" }),
        ).toBeFocused();
        const top = await page.locator(".dashboard-top").boundingBox();
        expect(top!.height).toBeLessThanOrEqual(76);
        await page.getByRole("button", { name: "Open dashboard navigation" }).click();
        await expect(
          page.getByRole("dialog", { name: "Dashboard navigation" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Close dashboard navigation" }).click();
      }
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
      expect(state.writes).toEqual([]);
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath("security.png") });
    });
    test("customer profile identity, account links, refresh and photo failure", async ({
      page,
    }, info) => {
      const state = await profileFixture(page);
      const photoId = profileId(77);
      state.record.photo = {
        id: photoId,
        url: `/api/v1/customers/media/images/${photoId}`,
        altText: null,
        sortOrder: 0,
        isPrimary: true,
        width: 64,
        height: 64,
      };
      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
        "base64",
      );
      await page.route("**/api/v1/customers/media/images/**", (route) => {
        expect(new URL(route.request().url()).search).toBe("");
        return route.fulfill({ contentType: "image/png", body: image });
      });
      await page.goto("/dashboard/profile", { waitUntil: "load" });
      const shell = page.locator(".dashboard-account-menu");
      await expect(shell.locator("summary")).toContainText("Amara Okafor");
      await expect(shell.locator("summary img")).toBeVisible();
      await shell.locator("summary").click();
      await expect(shell.getByRole("link", { name: "My profile" })).toHaveAttribute(
        "href",
        "/dashboard/profile",
      );
      await expect(shell.getByRole("link", { name: "Account security" })).toHaveAttribute(
        "href",
        "/dashboard/security",
      );
      await shell.locator("summary").press("Escape");
      state.record.firstName = "Updated";
      state.record.photo = null;
      await page.evaluate(() => window.dispatchEvent(new Event("aat:profile-updated")));
      await expect(shell.locator("summary")).toContainText("Updated Okafor");
      await expect(shell.locator("summary img")).toHaveCount(0);
      state.record.user.id = profileId(99);
      await page.evaluate(() => window.dispatchEvent(new Event("aat:profile-updated")));
      await expect(shell.locator("summary")).toContainText("My account");
      await expect(shell).not.toContainText("Updated Okafor");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(state.writes).toEqual([]);
      await page.screenshot({ path: info.outputPath("profile.png") });
    });
    test("work profile uses the authorised own-account contract without inventing employee identity", async ({
      page,
    }, info) => {
      const state = await workInvoiceFixture(
        page,
        ["STAFF", "ADMIN", "SUPER_ADMIN"][width % 3],
      );
      await page.goto("/admin/profile", { waitUntil: "load" });
      await expect(
        page.getByRole("heading", { name: "My profile", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".work-own-profile .panel")).toBeVisible();
      await expect(page.locator(".dashboard-breadcrumbs")).toContainText("My profile");
      await expect(page.locator(".dashboard-breadcrumbs")).not.toContainText("Details");
      expect(state.writes).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("work-profile.png") });
    });
    test("invoice find/create separation preserves URL filters and mounted draft", async ({
      page,
    }, info) => {
      const state = await workInvoiceFixture(page);
      await page.goto("/admin/invoices?status=ISSUED", { waitUntil: "load" });
      await expect(page.locator(".iv-record").first()).toBeVisible();
      const filters = page.locator(".iv-filters");
      await expect(filters).toBeVisible();
      await page.getByRole("button", { name: "Create an invoice", exact: true }).click();
      await expect(filters).toBeHidden();
      await expect(page.locator("#invoice-create-workspace")).toBeVisible();
      await page
        .getByLabel("Source record", { exact: true })
        .selectOption(invoiceId(195000));
      await expect(page).toHaveURL(/status=ISSUED/);
      await page
        .getByRole("button", { name: "Find existing invoices", exact: true })
        .click();
      await expect(filters).toBeVisible();
      await expect(page.locator("#invoice-create-workspace")).toBeHidden();
      await page.goBack();
      await expect(page.locator("#invoice-create-workspace")).toBeVisible();
      await expect(page.getByLabel("Source record", { exact: true })).toHaveValue(
        invoiceId(195000),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(state.writes).toEqual([]);
      await page.screenshot({ path: info.outputPath("invoices.png") });
    });
  });
