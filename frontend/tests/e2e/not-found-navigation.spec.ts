import { expect, test } from "@playwright/test";

test("old shop links reach the parts catalogue", async ({ page }) => {
  await page.goto("/shop");
  await expect(page).toHaveURL(/\/parts$/);
  await expect(
    page.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`a missing page stays usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/a-page-that-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "We couldn’t find that page." }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("link", { name: "Visit the Help Centre" }).click();
    await expect(page).toHaveURL(/\/help$/);
    expect(errors).toEqual([]);
  });
