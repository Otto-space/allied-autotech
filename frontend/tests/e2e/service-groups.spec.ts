import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = (n: number) => "f8000000-0000-4000-8000-" + String(n).padStart(12, "0");
const names = [
  "Tyre & Wheel Maintenance",
  "Vehicle Diagnostics & Inspections",
  "ECU Programming & Vehicle Electronics",
  "Suspension Repairs",
  "Engine & Drive System Maintenance",
  "Vehicle AC Maintenance",
  "Bodywork & Painting",
  "Interior Repairs",
];
for (const width of [390, 1440])
  test(
    "service groups preserve empty-group enquiry at " + width + "px",
    async ({ page }, info) => {
      const groups = names.map((name, i) => ({
        id: id(i + 1),
        name,
        slug: "group-" + i,
        image:
          i < 2
            ? {
                id: id(900 + i),
                url: `/api/v1/public/media/images/${id(900 + i)}`,
                altText: "Group workshop photo",
                width: 96,
                height: 64,
              }
            : null,
        description: "Discuss your vehicle and the work required with the workshop.",
      }));
      await page.route("**/api/v1/**", (route) => {
        const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
        if (path.startsWith("/public/media/images/"))
          return path.endsWith(id(900))
            ? route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#a00"/></svg>',
              })
            : route.fulfill({ status: 404, body: "" });
        if (path === "/auth/session")
          return route.fulfill({
            status: 401,
            json: {
              success: false,
              message: "Sign in required",
              error: { code: "UNAUTHENTICATED" },
              meta: { requestId: "group-fixture" },
            },
          });
        let data: unknown = { items: [] };
        if (path === "/public/services/categories") data = { items: groups };
        if (path.startsWith("/public/services/categories/"))
          data = groups.find((g) => path.endsWith(g.id));
        if (path === "/public/services/discovery") data = { items: [], totalMatches: 0 };
        return route.fulfill({
          json: {
            success: true,
            data,
            message: "Isolated groups",
            meta: { requestId: "group-fixture" },
          },
        });
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/services");
      const cards = page.locator(".service-group-card");
      await expect(cards).toHaveCount(8);
      const photo = cards.first().getByRole("img");
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await expect(photo).toHaveCSS("object-fit", "contain");
      expect((await photo.boundingBox())!.height).toBeLessThanOrEqual(240);
      await cards.nth(1).scrollIntoViewIfNeeded();
      await expect(
        cards.nth(1).getByRole("img", { name: "Service image unavailable" }),
      ).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).include(".service-groups").analyze()).violations,
      ).toEqual([]);
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("groups.png") });
      await cards.filter({ hasText: "Vehicle AC Maintenance" }).click();
      await expect(page).toHaveURL(new RegExp("categoryId=" + id(6)));
      const retry = page.getByRole("button", { name: "Retry services", exact: true });
      if (await retry.isVisible()) await retry.click();
      await expect(
        page.getByRole("heading", { name: "Discuss this work with the workshop" }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Ask about this service group", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp("serviceGroup=" + id(6)));
      await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
        "Service group enquiry: Vehicle AC Maintenance",
      );
      await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
        new RegExp("Service group: /services\\?categoryId=" + id(6)),
      );
      await page.reload();
      await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
        "Service group enquiry: Vehicle AC Maintenance",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("group-enquiry.png") });
    },
  );
