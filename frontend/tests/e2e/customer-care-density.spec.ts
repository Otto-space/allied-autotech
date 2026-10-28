import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";
import { overviewFixture } from "../fixtures/overview";

for (const width of [360, 390, 768, 1440]) {
  test(`empty care is compact and useful at ${width}`, async ({ page }, info) => {
    const state = await fixture(page, "CUSTOMER");
    state.mode = "empty";
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
        writes.push(request.url());
    });
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/dashboard");
    const care = page.getByRole("region", { name: "Current vehicle care" });
    await expect(care.getByText("No service in progress", { exact: true })).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`empty-care-${width}.png`),
      fullPage: true,
    });
    await expect(
      care.locator(".customer-care-next,.care-review,.customer-care-secondary"),
    ).toHaveCount(0);
    expect((await care.boundingBox())!.height).toBeLessThan(330);
    await expect(page.locator(".customer-history > summary")).toBeInViewport();
    const garage = care.getByRole("link", { name: "Manage garage", exact: true });
    await garage.focus();
    await page.keyboard.press("Tab");
    await expect(
      care.getByRole("link", { name: "Get support", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await garage.hover();
    await expect(garage).toBeFocused();
    await expect(garage).toHaveCSS("outline-style", "solid");
    expect(
      (await new AxeBuilder({ page }).include(".customer-overview").analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/vehicles$/);
  });
}

for (const width of [390, 1440]) {
  test(`care renders only recorded items and keeps their actions at ${width}`, async ({
    page,
  }, info) => {
    const state = await fixture(page, "CUSTOMER");
    const populated = overviewFixture("CUSTOMER").care!;
    const empty = overviewFixture("CUSTOMER", undefined, true).care!;
    state.care = {
      ...empty,
      vehicle: populated.vehicle,
      vehicleSource: "RECENT",
      nextBooking: populated.nextBooking,
    };
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/dashboard");
    const care = page.getByRole("region", { name: "Current vehicle care" });
    await expect(care).toContainText("Routine service");
    await expect(care).toContainText("Requested time; awaiting confirmation.");
    await expect(
      care.getByRole("link", { name: "View vehicle", exact: true }),
    ).toHaveAttribute("href", `/dashboard/vehicles/${populated.vehicle!.id}`);
    await expect(
      care.locator(".care-review,.customer-care-secondary,.care-service"),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`next-care-${width}.png`),
      fullPage: true,
    });
    state.care = { ...empty, quote: populated.quote };
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(care.getByRole("heading", { name: "Issued quotation" })).toBeVisible();
    await expect(care.getByRole("heading", { name: "Payment request" })).toHaveCount(0);
    await expect(
      care.locator(".care-service-column,.customer-care-secondary"),
    ).toHaveCount(0);
    state.care = populated;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(care.locator(".care-timeline li")).toHaveCount(3);
    for (const name of [
      "Current service",
      "Next booking",
      "Issued quotation",
      "Payment request",
      "Latest order",
      "Inspection",
      "Latest update",
    ])
      await expect(care.getByRole("heading", { name, exact: true })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".customer-overview").analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`populated-care-${width}.png`),
      fullPage: true,
    });
  });
}
