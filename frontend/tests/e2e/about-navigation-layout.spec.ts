import { expect, test } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`About section navigation fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/about");

    const navigation = page.getByRole("navigation", { name: "On this page" });
    const links = navigation.getByRole("link");
    await expect(links).toHaveCount(5);
    await expect(links.last()).toHaveAttribute("href", "#visit");

    const layout = await navigation.evaluate((nav) => {
      const items = Array.from(nav.querySelectorAll("a"));
      const boxes = items.map((item) => item.getBoundingClientRect());
      return {
        columns: getComputedStyle(nav).gridTemplateColumns.split(" ").length,
        overflow: nav.scrollWidth > nav.clientWidth,
        lastItemFits: boxes.at(-1)!.right <= nav.getBoundingClientRect().right + 1,
      };
    });
    expect(layout.columns).toBe(width <= 760 ? 2 : 5);
    expect(layout.overflow).toBe(false);
    expect(layout.lastItemFits).toBe(true);
  });
}
