import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { drawerFixture, drawerProduct, openDrawer } from "../fixtures/cart-drawer";
import type { Product } from "../../lib/api/commerce-schemas";
test.skip(
  process.env.RUN_CART_DRAWER_TESTS !== "true",
  "Requires the isolated local catalogue API and matching frontend origin",
);
let product: Product;
test.beforeAll(async () => {
  product = await drawerProduct();
});
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`cart confirmation fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await drawerFixture(page, product),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openDrawer(page, product);
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
    const rect = await dialog.boundingBox();
    expect(Math.round(rect!.width)).toBeLessThanOrEqual(Math.min(width, 460));
    for (const control of await dialog.locator("button,a").all())
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(dialog).toContainText("Quantity 2");
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toEqual({ quantity: 2 });
    expect(state.writes[0].csrf).toBe("s".repeat(64));
    expect(errors).toEqual([]);
  });
for (const width of [390, 768, 1440])
  test(`drawer accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await drawerFixture(page, product);
    await openDrawer(page, product);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("Escape restores the cart button, scrolling and quantity without another mutation", async ({
  page,
}) => {
  const state = await drawerFixture(page, product);
  await openDrawer(page, product);
  await expect(page.getByRole("button", { name: "Close cart summary" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.getByRole("dialog").evaluate((n) => n.contains(document.activeElement)),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Continue shopping" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close cart summary" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save quantity to cart" })).toBeFocused();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("2");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(state.writes).toHaveLength(1);
});
test("continue shopping closes; repeated save replaces rather than increments quantity", async ({
  page,
}) => {
  const state = await drawerFixture(page, product);
  await openDrawer(page, product);
  await page.getByRole("button", { name: "Continue shopping" }).click();
  await expect(page.getByRole("button", { name: "Save quantity to cart" })).toBeFocused();
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.getByRole("dialog")).toContainText("Quantity 2");
  expect(state.writes.map((w) => w.body)).toEqual([{ quantity: 2 }, { quantity: 2 }]);
  await expect(page.locator(".toast")).toHaveCount(0);
});
test("review cart opens the existing account cart and does not initiate checkout", async ({
  page,
}) => {
  const state = await drawerFixture(page, product);
  await openDrawer(page, product);
  await page.getByRole("dialog").getByRole("link", { name: "Review cart" }).click();
  await expect(page).toHaveURL(/\/dashboard\/cart$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
for (const corruption of ["subtotal", "line", "quantity", "target", "duplicate"])
  test(`invalid ${corruption} never opens a success drawer`, async ({ page }) => {
    const state = await drawerFixture(page, product);
    state.corrupt = corruption;
    await page.goto("/parts/" + product.id);
    await page.getByRole("button", { name: "Save quantity to cart" }).click();
    await expect(
      page.getByRole("heading", { name: "Update not confirmed" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".toast")).toHaveCount(0);
  });
test("failed update retains an honest recovery path without a drawer", async ({
  page,
}) => {
  const state = await drawerFixture(page, product);
  state.fail = true;
  await page.goto("/parts/" + product.id);
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.getByRole("heading", { name: "Update not confirmed" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review cart", exact: true }),
  ).toHaveAttribute("href", "/dashboard/cart");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("session change clears an open drawer and all cart details", async ({ page }) => {
  const state = await drawerFixture(page, product);
  await openDrawer(page, product);
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Saved cart part 2", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
test("late response after account change never opens the drawer", async ({ page }) => {
  const state = await drawerFixture(page, product);
  state.delay = true;
  await page.goto("/parts/" + product.id);
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  state.release?.();
  await expect(
    page.getByText("A customer account is required to use the cart and favourites."),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
for (const height of [420, 600, 844])
  test(`long cart stays reachable at 320 by ${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height });
    const state = await drawerFixture(page, product);
    state.items = 24;
    state.large = true;
    await openDrawer(page, product);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("link", { name: "Review cart" }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("link", { name: "Review cart" })).toBeInViewport();
    await dialog
      .getByRole("button", { name: "Continue shopping" })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Continue shopping" }),
    ).toBeInViewport();
    expect(await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Save quantity to cart" }),
    ).toBeFocused();
  });
test("approved images render and unavailable thumbnails remain honest", async ({
  page,
}) => {
  const state = await drawerFixture(page, product);
  state.photos = true;
  await openDrawer(page, product);
  const images = page.getByRole("dialog").locator("img");
  await expect(images).toHaveCount(2);
  await expect
    .poll(() => images.first().evaluate((n) => (n as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});
test("reduced motion disables the entry animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await drawerFixture(page, product);
  await openDrawer(page, product);
  expect(
    await page.getByRole("dialog").evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
});
for (const width of [320, 390, 1440])
  test(`favourite toast is actionable and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await drawerFixture(page, product);
    await page.goto("/parts/" + product.id);
    await page.getByRole("button", { name: "Save to favourites" }).click();
    const toast = page.locator(".toast");
    await expect(toast).toContainText("Product saved to your favourites.");
    await expect(toast.getByRole("link", { name: "View favourites" })).toHaveAttribute(
      "href",
      "/dashboard/saved",
    );
    expect(
      (await toast.getByRole("button", { name: "Dismiss notification" }).boundingBox())
        ?.height,
    ).toBeGreaterThanOrEqual(44);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".toast-region")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await toast.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(toast).toHaveCount(0);
  });
