import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleDetailFixture, bookingId } from "../fixtures/work-vehicle-detail";
import {
  workBookingDetailFixture,
  bookingId as workBookingId,
} from "../fixtures/work-booking-detail";
import { workforceBookingConfirmationFixture } from "../fixtures/workforce-booking-confirmation";
import { fixture } from "../fixtures/overview-browser";
import { workInventoryFixture } from "../fixtures/work-inventory";
import { workProductsFixture } from "../fixtures/work-products";

for (const inventory of [false, true])
  for (const width of [320, 1440])
    test.describe(`${inventory ? "Inventory" : "Product"} input at ${width}px`, () => {
      test.use({ hasTouch: width === 320 });
      test(`${inventory ? "Inventory" : "Product"} records share keyboard regions and SKU copying at ${width}px`, async ({
        page,
      }, info) => {
        const f = inventory
          ? await workInventoryFixture(page)
          : await workProductsFixture(page);
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "clipboard", {
            value: {
              writeText: async (value: string) => {
                document.documentElement.dataset.copiedSku = value;
              },
            },
          });
        });
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(inventory ? "/admin/inventory" : "/admin/products");
        const region = page.getByRole("region", {
          name: inventory ? "Parts inventory records" : "Product records",
          exact: true,
        });
        await expect(region).toBeVisible();
        await region.focus();
        await expect(region).toBeFocused();
        const copy = region.getByRole("button", { name: /^Copy SKU / }).first();
        const sku = (await copy.getAttribute("aria-label"))!.slice("Copy SKU ".length);
        await copy.focus();
        await copy.press("Enter");
        await expect(page.locator("html")).toHaveAttribute("data-copied-sku", sku);
        expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(
          width === 320 ? 44 : 36,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .include("main")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(
            `records-${inventory ? "inventory" : "product"}-${width}.png`,
          ),
        });
        expect(f.state.writes).toEqual([]);
      });
    });

for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  for (const width of [320, 1280])
    test(`${role} has explicit scoped stock actions and an editable destination at ${width}px`, async ({
      page,
    }, info) => {
      const f = await workVehicleDetailFixture(page, role);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async (value: string) => {
              document.documentElement.dataset.copiedStock = value;
            },
          },
        });
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin/vehicles");
      const row = page.locator(".ws-table tbody tr").first();
      await expect(
        row.getByRole("link", {
          name: "View details for 2022 Toyota Camry (AA-001)",
          exact: true,
        }),
      ).toHaveAttribute("href", `/admin/vehicles/${bookingId(7000)}`);
      const edit = row.getByRole("link", {
        name: "Edit details for 2022 Toyota Camry (AA-001)",
        exact: true,
      });
      await expect(edit).toHaveAttribute(
        "href",
        `/admin/vehicles/${bookingId(7000)}#vehicle-record-editor`,
      );
      await row.getByRole("button", { name: "Copy stock number AA-001" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-copied-stock", "AA-001");
      await expect(row.getByRole("status")).toHaveText("Copied");
      await expect(row.locator(".aat-status")).toContainText("Available");
      expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`stock-${role}-${width}.png`) });
      await edit.focus();
      await edit.press("Enter");
      const panel = page.locator("#vehicle-record-editor");
      await expect(panel).toHaveAttribute("open", "");
      await expect(panel.locator("summary")).toBeFocused();
      await expect(page.getByLabel("Colour (optional)", { exact: true })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(f.detail.writes).toEqual([]);
      await panel.locator("summary").click();
      await page.getByRole("button", { name: "Edit details", exact: true }).click();
      await expect(panel).toHaveAttribute("open", "");
      await page.screenshot({ path: info.outputPath(`editor-${role}-${width}.png`) });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width === 1280) {
        const nav = page.getByRole("navigation", { name: "Vehicle record sections" });
        const positions = await nav
          .getByRole("link")
          .evaluateAll((links) =>
            links.map((link) => Math.round(link.getBoundingClientRect().y)),
          );
        expect(new Set(positions).size).toBe(1);
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
        const collapsed = await nav
          .getByRole("link")
          .evaluateAll((links) =>
            links.map((link) => Math.round(link.getBoundingClientRect().y)),
          );
        expect(new Set(collapsed).size).toBe(1);
      }
      expect(
        (
          await new AxeBuilder({ page })
            .include(".work-vehicle-detail")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    });

test("failed stock refresh removes the edit shortcut and failed clipboard offers manual selection", async ({
  page,
}) => {
  const f = await workVehicleDetailFixture(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("Denied");
        },
      },
    });
  });
  await page.goto("/admin/vehicles");
  const row = page.locator(".ws-table tbody tr").first();
  await row.getByRole("button", { name: "Copy stock number AA-001" }).click();
  await expect(row.getByRole("status")).toContainText("Copy unavailable");
  f.state.mode = "error";
  await page.getByRole("button", { name: "Refresh vehicle stock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry vehicle stock", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Edit details for/ })).toHaveCount(0);
  expect(f.detail.writes).toEqual([]);
});

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  for (const width of [320, 600, 1024])
    test(`${role} dashboard search remains readable and functional at ${width}px`, async ({
      page,
    }, info) => {
      await fixture(page, role);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
      const input = page.getByRole("searchbox", {
        name: "Search dashboard pages",
        exact: true,
      });
      await expect(input).toBeVisible();
      if (width <= 600) expect((await input.boundingBox())!.width).toBeGreaterThan(180);
      await input.fill("booking");
      await expect(page.locator(".dashboard-search-results")).toBeVisible();
      await expect(page.locator(".dashboard-search")).toHaveCSS(
        "outline-color",
        "rgb(215, 25, 32)",
      );
      await input.press("Escape");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width === 320)
        await page.screenshot({ path: info.outputPath(`search-${role}-320.png`) });
    });

for (const managed of [false, true])
  test(`${managed ? "Managed Staff" : "Administrator"} appointment dates count only current confirmed work`, async ({
    page,
  }) => {
    const now = new Date();
    await page.clock.install({ time: now });
    const next = new Date(now.getTime() + 120000).toISOString();
    if (managed) {
      const f = await workforceBookingConfirmationFixture(page);
      f.booking.status = "CONFIRMED";
      f.booking.scheduledAt = next;
      await page.goto("/admin/workforce/bookings/" + f.booking.id);
      await expect(page.getByRole("timer")).toContainText("Starts in");
      await expect(page.getByRole("timer")).toHaveAttribute("aria-live", "off");
      f.booking.status = "REQUESTED";
      await page.reload();
      await expect(page.getByRole("timer")).toHaveCount(0);
      await expect(page.getByText("Awaiting workshop confirmation.")).toBeVisible();
      expect(f.writes).toEqual([]);
    } else {
      const f = await workBookingDetailFixture(page);
      f.state.record.scheduledAt = next;
      await page.goto("/admin/bookings/" + workBookingId(1));
      await expect(page.getByRole("timer")).toContainText("Starts in");
      await page.clock.fastForward(120000);
      await expect(page.getByRole("timer")).toHaveCount(0);
      await expect(page.locator(".booking-detail-summary")).toContainText("Confirmed");
      expect(f.state.writes).toEqual([]);
    }
  });
