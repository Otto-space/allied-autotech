import { test, expect } from "@playwright/test";
import { product, id } from "../fixtures/public-account-actions";

const productId = "89fd9258-c580-43e9-9040-c7e52623e82d";
const productPath = `/parts/${productId}`;

for (const width of [390, 1440]) {
  test(`favourite survives product refresh and reflects removal at ${width}`, async ({
    page,
  }, info) => {
    let saved = false;
    let failed = false;
    const writes: string[] = [];
    const reads: string[] = [];
    const ok = (data: unknown) => ({
      success: true,
      message: "Isolated favourite fixture",
      data,
      meta: { requestId: "favourite-fixture" },
    });
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.endsWith("/auth/session"))
        return route.fulfill({ json: ok({ user: { id: id(90), role: "CUSTOMER" } }) });
      if (url.pathname.endsWith("/auth/csrf"))
        return route.fulfill({
          json: ok({ csrfToken: "fixture-favourite-token-".repeat(3) }),
        });
      if (url.pathname.endsWith("/public/fitment/makes"))
        return route.fulfill({ json: ok({ items: [] }) });
      if (url.pathname.endsWith("/customers/favourites") && req.method() === "GET") {
        reads.push(url.search);
        if (failed)
          return route.fulfill({
            status: 503,
            json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
          });
        // A saved item on a later page must still be recognised after reload.
        if (!url.searchParams.has("cursor"))
          return route.fulfill({
            json: ok({
              items: [{ id: id(200), product: { ...product, id: id(2) } }],
              nextCursor: id(200),
            }),
          });
        return route.fulfill({
          json: ok({
            items: saved ? [{ id: id(201), product: { ...product, id: productId } }] : [],
          }),
        });
      }
      if (
        url.pathname.endsWith(`/customers/favourites/${productId}`) &&
        req.method() === "PUT"
      ) {
        writes.push(url.pathname);
        saved = true;
        return route.fulfill({ json: ok({ product: { ...product, id: productId } }) });
      }
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "ISOLATED_UNMATCHED_REQUEST" } },
      });
    });
    await page.setViewportSize({ width, height: 936 });
    await page.goto(productPath);
    await page.getByRole("button", { name: "Save to favourites", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Saved to favourites", exact: true }),
    ).toBeDisabled();
    expect(writes).toHaveLength(1);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Saved to favourites", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save to favourites", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "View favourites", exact: true }),
    ).toHaveAttribute("href", "/dashboard/saved");
    expect(reads.some((query) => query.includes("cursor="))).toBe(true);
    await page.screenshot({ path: info.outputPath(`saved-after-refresh-${width}.png`) });
    saved = false; // Simulate an authorised removal from the account's Saved items page.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Save to favourites", exact: true }),
    ).toBeEnabled();
    failed = true;
    await page.reload();
    await expect(
      page.getByText("We could not check whether this product is saved."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save to favourites", exact: true }),
    ).toHaveCount(0);
    failed = false;
    saved = true;
    await page
      .getByRole("button", { name: "Retry favourites check", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Saved to favourites", exact: true }),
    ).toBeDisabled();
    expect(writes).toHaveLength(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
