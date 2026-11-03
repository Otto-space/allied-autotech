import { test, expect } from "@playwright/test";
import { purchaseFixture } from "../fixtures/purchase-guest";
import { id, branch } from "../fixtures/public-account-actions";

test("account cookies retain the existing guarded cart and checkout destinations", async ({
  request,
}) => {
  for (const name of ["aat_session", "__Host-aat_session"]) {
    const headers = { Cookie: `${name}=synthetic-route-selection-only` };
    const cart = await request.get("/cart", { headers, maxRedirects: 0 });
    expect(cart.status()).toBe(307);
    expect(cart.headers().location).toBe("/dashboard/cart");
    const checkout = await request.get("/checkout", { headers, maxRedirects: 0 });
    expect(checkout.status()).toBe(307);
    expect(checkout.headers().location).toBe("/dashboard/cart#cart-checkout-form");
  }
});

test("an open gateway authorization expires without allowing navigation or a second initialization", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  await page.goto(`/purchase/payments/${id(83)}`);
  await page
    .getByRole("button", { name: "Prepare Paystack checkout", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue to Paystack", exact: true }),
  ).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(601_000);
  await expect(page.getByText(/This checkout link expired/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to Paystack", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Prepare .* checkout/ })).toHaveCount(0);
  expect(state.writes.filter((v) => v.path.endsWith("/checkout"))).toHaveLength(1);
});

test("collection review works with touch emulation at 390px", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    const state = await purchaseFixture(page);
    await page.goto("http://127.0.0.1:3103/cart");
    await page.getByLabel("Your name", { exact: true }).fill("Synthetic touch buyer");
    await page.getByLabel("Contact phone", { exact: true }).fill("+2348000000000");
    await page.getByLabel("Collection branch", { exact: true }).selectOption(branch.id);
    await page
      .getByRole("button", { name: "Review collection details", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", { name: "Review before saving" }),
    ).toBeVisible();
    expect(state.writes.some((v) => v.path === "/purchase/orders")).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
