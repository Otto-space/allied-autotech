import { expect, test } from "@playwright/test";

// Run with the existing read-only discovery fixture (no account or database writes).
for (const [route, kind, bodyClass] of [
  ["parts", "product", "product-filter-fields"],
  ["vehicles", "vehicle", "vehicle-filter-body"],
]) {
  for (const [width, height] of [
    [1440, 900],
    [1024, 600],
    [390, 844],
  ]) {
    test(`${route} filter scrolling stays isolated at ${width}x${height}`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height });
      await page.goto(`/${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      const panel = page.locator(`#${kind}-filter-panel`);
      const trigger = page.locator(`.${kind}-filter-trigger`);
      if (width < 1024) await trigger.click();
      await expect(panel).toBeVisible();
      const body = panel.locator(`.${bodyClass}`);
      if (width >= 1024) {
        const initial = (await panel.boundingBox())!;
        expect(initial.height).toBeLessThanOrEqual(641);
        await page.evaluate((y) => window.scrollTo(0, y), initial.y + 100);
        await expect
          .poll(() => panel.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
          .toBe(
            await panel.evaluate((el) =>
              Math.round(parseFloat(getComputedStyle(el).top)),
            ),
          );
        const pinned = (await panel.boundingBox())!;
        const scrollTop = await body.evaluate((el) => el.scrollTop);
        await page.mouse.move(width - 80, height / 2);
        await page.mouse.wheel(0, 180);
        await expect
          .poll(() => page.evaluate(() => scrollY))
          .toBeGreaterThan(initial.y + 150);
        expect(Math.abs((await panel.boundingBox())!.y - pinned.y)).toBeLessThan(2);
        expect(await body.evaluate((el) => el.scrollTop)).toBe(scrollTop);
      }
      await expect(
        panel.getByRole("button", { name: "Apply filters", exact: true }),
      ).toBeInViewport();
      expect(
        await panel.evaluate((el) => el.scrollHeight - el.clientHeight),
      ).toBeLessThanOrEqual(1);
      expect(await body.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe(
        "none",
      );
      if (kind === "product") {
        await panel.getByText("More product details", { exact: true }).click();
        await body.evaluate((el) => {
          el.scrollTop = 0;
        });
      }
      const pageY = await page.evaluate(() => scrollY);
      const box = (await body.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 250);
      await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(pageY);
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => scrollY)).toBe(pageY);
      await expect(
        panel.getByRole("button", { name: "Apply filters", exact: true }),
      ).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("filter-scroll.png") });
      if (width < 1024) {
        await page.keyboard.press("Escape");
        await expect(panel).not.toBeVisible();
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
          "hidden",
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
