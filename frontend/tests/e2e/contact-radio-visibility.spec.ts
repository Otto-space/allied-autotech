import { expect, test } from "@playwright/test";
// The full Contact form is launch-gated. Run against the local fixture configuration;
// these cases never submit a form or enable a production feature.
for (const width of [320, 390, 1440]) {
  test(`Contact radio selection remains visible without colour at ${width}`, async ({
    page,
  }, info) => {
    const writes: string[] = [];
    await page.route("**/api/v1/**", (route) => {
      if (route.request().method() !== "GET") {
        writes.push(route.request().url());
        return route.abort();
      }
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "ISOLATED_RADIO_CHECK" } },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.goto("/contact#enquiry");
    const group = page.getByRole("group", { name: "Contact reason", exact: true });
    await expect(group).toBeVisible();
    const enquiry = group.getByRole("radio", { name: "Enquiry", exact: true });
    const complaint = group.getByRole("radio", { name: "Complaint", exact: true });
    const first = enquiry.locator("..").locator("span"),
      second = complaint.locator("..").locator("span");
    await expect(enquiry).toBeChecked();
    await expect(first.locator("svg")).toBeVisible();
    await expect(second.locator("svg")).toBeHidden();
    const initial = await first.boundingBox();
    await enquiry.press("ArrowRight");
    await expect(complaint).toBeChecked();
    await expect(second.locator("svg")).toBeVisible();
    await expect(first.locator("svg")).toBeHidden();
    await expect(second).toHaveCSS("outline-style", "solid");
    expect((await first.boundingBox())!.width).toBe(initial!.width);
    expect((await second.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`contact-radio-${width}.png`) });
    expect(writes).toEqual([]);
  });
}
