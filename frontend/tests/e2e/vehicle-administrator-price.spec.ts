import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleDetailFixture, bookingId } from "../fixtures/work-vehicle-detail";

for (const role of ["ADMIN", "SUPER_ADMIN"])
  for (const width of [390, 1440])
    test(`${role} without employee profile reviews an exact grouped asking price at ${width}px`, async ({
      page,
    }) => {
      const fixture = await workVehicleDetailFixture(page, role);
      await page.setViewportSize({ width, height: 1000 });
      await page.route("**/api/v1/staff/profile", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Synthetic account",
            meta: { requestId: "admin-price-fixture" },
            data: {
              id: bookingId(302),
              email: "admin@example.test",
              role,
              status: "ACTIVE",
              capabilities: [],
              staffProfile: null,
            },
          },
        }),
      );
      const writes: Record<string, unknown>[] = [];
      await page.route(
        `**/api/v1/staff/vehicles/listings/${bookingId(7100)}/price`,
        async (route) => {
          const body = route.request().postDataJSON();
          writes.push(body);
          Object.assign(fixture.detail.record.listings[0], {
            priceKobo: body.priceKobo,
            version: 1,
          });
          await route.fulfill({
            json: {
              success: true,
              message: "Synthetic price saved",
              meta: { requestId: "admin-price-fixture" },
              data: fixture.detail.record.listings[0],
            },
          });
        },
      );
      await page.goto(`/admin/vehicles/${bookingId(7000)}`);
      await expect(
        page.getByRole("heading", { name: "2022 Toyota Camry", exact: true }),
      ).toBeVisible();
      await page.getByText("Manage asking price", { exact: true }).first().click();
      const amount = page.getByLabel("New asking price (NGN)", { exact: true });
      await amount.fill("55000,000.00");
      await page
        .getByLabel("Price change reason", { exact: true })
        .fill("Synthetic reviewed correction");
      await page
        .getByRole("button", { name: "Review asking price", exact: true })
        .click();
      await expect(
        page.getByText("Enter an NGN amount such as 55000000.00 or 55,000,000.00.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(writes).toHaveLength(0);
      await amount.fill("55,000,000.00");
      await page
        .getByRole("button", { name: "Review asking price", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("₦55,000,000");
      await expect(dialog).not.toContainText("must have a staff profile");
      expect(writes).toHaveLength(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0]).toEqual({
        expectedVersion: 0,
        priceKobo: "5500000000",
        reason: "Synthetic reviewed correction",
      });
      await expect(page.locator(".vd-price").first()).toContainText("₦55,000,000");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    });
