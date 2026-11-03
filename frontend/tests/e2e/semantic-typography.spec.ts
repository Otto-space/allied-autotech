import { test, expect, type Locator } from "@playwright/test";
import { fixture } from "../fixtures/overview-browser";

async function font(locator: Locator, family: string) {
  await expect(locator).toBeVisible();
  expect(
    await locator.evaluate((element) =>
      getComputedStyle(element).fontFamily.toLowerCase(),
    ),
  ).toContain(family);
}

for (const width of [390, 1366]) {
  for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
    test(`${role} semantic fonts at ${width}px`, async ({ page }) => {
      await fixture(page, role);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
      await font(page.getByRole("heading", { level: 1 }), "nippo");
      if (role === "CUSTOMER") await page.locator(".customer-history > summary").click();
      await page.getByText("View daily data", { exact: true }).click();
      await font(
        page.getByRole("region", { name: "Daily activity data" }).locator("td").first(),
        "quicksand",
      );
      await font(page.getByLabel("Inspect day"), "quicksand");
      await font(
        page.getByRole("button", { name: "Bookings", exact: true }),
        "quicksand",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    });
  }
  for (const route of ["/login", "/contact", "/help"]) {
    test(`${route} semantic fonts and dialog at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(route);
      await font(page.getByRole("heading", { level: 1 }), "nippo");
      const input = page.locator("main input:not([type=hidden]),main textarea").first();
      if (await input.count()) await font(input, "quicksand");
      const paragraph = page.locator("main p").filter({ visible: true }).first();
      await font(paragraph, "quicksand");
      const link = page.locator("main a").filter({ visible: true }).first();
      await font(link, "quicksand");
      // Authentication intentionally has no public assistance widget.
      if (route === "/help") {
        await page
          .getByRole("button", { name: "Ask Allie", exact: true })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await font(dialog.getByRole("heading").first(), "nippo");
        await font(dialog.getByRole("button").first(), "quicksand");
        await page.keyboard.press("Escape");
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    });
  }
}
