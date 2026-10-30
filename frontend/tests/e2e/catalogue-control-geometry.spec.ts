import { test, expect } from "@playwright/test";
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Filter geometry and cancellation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/vehicles?bodyType=SUV&maxPriceKobo=500000000");
    const search = page.getByRole("searchbox", { name: "Search vehicles", exact: true });
    await expect(search).toBeEnabled();
    const corners = (element: Element) => {
      const s = getComputedStyle(element);
      return [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomLeftRadius,
        s.borderBottomRightRadius,
      ];
    };
    const reference = await search.evaluate(corners);
    expect(reference).toEqual(["6px", "6px", "6px", "6px"]);
    for (const button of await page.locator(".vehicle-body-shortcuts button").all()) {
      expect(await button.evaluate(corners)).toEqual(reference);
      await button.hover();
      expect(await button.evaluate(corners)).toEqual(reference);
      await button.focus();
      expect(await button.evaluate(corners)).toEqual(reference);
    }
    await page.getByRole("button", { name: "All types", exact: true }).click();
    await expect(page).not.toHaveURL(/bodyType=/);
    await expect(page).toHaveURL(/maxPriceKobo=500000000/);
    if (width < 1024) await page.getByRole("button", { name: /^Filters/ }).click();
    const panel = page.locator(".vehicle-filter-panel[open]");
    const radio = panel.getByRole("radio", { name: "Used", exact: true });
    await radio.check();
    await expect(radio).toBeChecked();
    const bounds = await radio.boundingBox();
    expect(bounds?.width).toBe(20);
    expect(bounds?.height).toBe(20);
    expect(
      await radio.locator("..").evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await expect(page).not.toHaveURL(/conditions=/);
    await panel.getByRole("button", { name: "Close filters", exact: true }).click();
    await expect(page).not.toHaveURL(/conditions=/);
    await page.screenshot({ path: info.outputPath(`vehicles-${width}.png`) });
    await page.goto("/parts");
    const vehicle = page.getByRole("radio", { name: "By vehicle", exact: true });
    const product = page.getByRole("radio", { name: "By product", exact: true });
    for (const radio of [vehicle, product]) {
      await expect(radio).toBeVisible();
      const label = radio.locator("..");
      expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(
        await label.evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
    }
    await vehicle.check();
    await expect(vehicle).toBeChecked();
    await product.check();
    await expect(product).toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`shop-${width}.png`) });
    expect(errors).toEqual([]);
  });
}
