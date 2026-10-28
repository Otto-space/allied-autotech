import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";
import { savedFixture } from "../fixtures/saved-items";

for (const width of [390, 1440]) {
  test(`customer history preserves care, dates and existing records at ${width}`, async ({
    page,
  }, info) => {
    const state = await fixture(page, "CUSTOMER");
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/dashboard");
    const care = page.locator(".customer-care");
    await expect(care).toBeVisible();
    const careText = await care.innerText();
    const summary = page.locator(".customer-history > summary");
    await expect(page.locator(".overview-metrics")).not.toBeVisible();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".overview-metrics")).toBeVisible();
    await expect(page.locator(".overview-orders")).toContainText("ORD-TEST-0101");
    await page.getByLabel("From", { exact: true }).fill("2000-01-01");
    await page.getByLabel("To", { exact: true }).fill("2000-01-02");
    await summary.click();
    await summary.focus();
    await page.keyboard.press("Space");
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("2000-01-01");
    state.mode = "period_empty";
    await page.getByRole("button", { name: "Apply dates", exact: true }).click();
    await expect(page.getByText(/No recorded activity in this period/)).toBeVisible();
    await expect(page.locator(".overview-metric,.overview-chart")).toHaveCount(0);
    await expect(care).toHaveText(careText, { useInnerText: true });
    expect(state.reads.at(-1)?.searchParams.get("from")).toBe("2000-01-01");
    await page.getByLabel("To", { exact: true }).fill("1999-12-31");
    // Native min validation prevents an invalid submission before any request.
    const reads = state.reads.length;
    await page.getByRole("button", { name: "Apply dates", exact: true }).click();
    expect(state.reads.length).toBe(reads);
    await page.getByLabel("To", { exact: true }).fill("2000-01-02");
    expect(
      (await new AxeBuilder({ page }).include(".customer-overview").analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`customer-history-${width}.png`),
      fullPage: true,
    });
  });

  test(`empty and unavailable customer history stay distinct at ${width}`, async ({
    page,
  }, info) => {
    const state = await fixture(page, "CUSTOMER");
    state.mode = "error";
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your overview" }),
    ).toBeVisible();
    await expect(page.getByText(/No recorded activity in this period/)).toHaveCount(0);
    state.mode = "empty";
    await page.getByRole("button", { name: "Retry overview" }).click();
    await expect(page.getByText("No service in progress", { exact: true })).toBeVisible();
    await expect(page.locator(".customer-history")).not.toHaveAttribute("open");
    await page.locator(".customer-history > summary").click();
    await expect(page.getByText(/No recorded activity in this period/)).toBeVisible();
    await expect(page.locator(".overview-metric,.overview-chart")).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`customer-empty-${width}.png`),
      fullPage: true,
    });
  });

  test(`saved empty collections have one browse action and retain error recovery at ${width}`, async ({
    page,
  }, info) => {
    const state = await savedFixture(page);
    state.parts = [];
    state.vehicles = [];
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/dashboard/saved");
    await expect(
      page.getByRole("heading", { name: "Your shortlist starts here" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse Shop", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Browse Shop", exact: true }),
    ).toHaveAttribute("href", "/parts");
    await page.getByRole("tab", { name: "Favourite products" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Saved vehicles" })).toBeFocused();
    await expect(
      page.getByRole("link", { name: "Browse vehicles", exact: true }),
    ).toHaveCount(1);
    await page.keyboard.press("Home");
    state.partError = true;
    await page.getByRole("button", { name: "Refresh favourite products" }).click();
    await expect(page.locator('.saved-page [role="alert"]')).toBeVisible();
    await expect(page.locator(".saved-empty")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Browse Shop", exact: true }),
    ).toHaveCount(1);
    state.partError = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".saved-empty")).toBeVisible();
    expect(state.writes).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include(".saved-page").analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`saved-empty-${width}.png`),
      fullPage: true,
    });
  });
}
