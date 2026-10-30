import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCategoriesFixture, bookingId } from "../fixtures/work-categories";
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
    "owner groups require review before one save at " + width + "px",
    async ({ page }, info) => {
      await workCategoriesFixture(page);
      const writes: unknown[] = [];
      await page.route(
        "**/api/v1/admin/service-categories/owner-structure",
        async (route) => {
          let data: unknown;
          if (route.request().method() === "GET")
            data = {
              revision: "a".repeat(64),
              groups: names.map((name, i) => ({
                id: i === 0 ? bookingId(810) : null,
                name,
                action: i === 0 ? "reuse" : "create",
                isActive: true,
              })),
              tyre: { id: bookingId(800), name: "Tyre Change", categoryId: null },
            };
          else {
            writes.push(route.request().postDataJSON());
            data = {
              created: 7,
              reused: 1,
              assigned: true,
              serviceId: bookingId(800),
              categoryIds: names.map((_, i) => bookingId(810 + i)),
            };
          }
          await route.fulfill({
            json: {
              success: true,
              data,
              message: "Isolated owner group fixture",
              meta: { requestId: "owner-groups" },
            },
          });
        },
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/service-categories");
      const opener = page.getByRole("button", {
        name: "Review owner service groups",
        exact: true,
      });
      await opener.click();
      const modal = page.getByRole("dialog");
      for (const name of names) await expect(modal).toContainText(name);
      await expect(modal).toContainText("Prices, durations and bookings stay unchanged.");
      expect(writes).toHaveLength(0);
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      await expect(opener).toBeFocused();
      expect(writes).toHaveLength(0);
      await opener.click();
      expect(
        (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath("owner-groups-review.png") });
      await modal
        .getByRole("button", { name: "Apply service groups", exact: true })
        .click();
      await expect(
        page
          .getByText(
            "Service groups saved: 7 created, 1 reused. Tyre Change is now grouped under Tyre & Wheel Maintenance.",
            { exact: true },
          )
          .first(),
      ).toBeVisible();
      expect(writes).toEqual([{ expectedRevision: "a".repeat(64) }]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    },
  );
