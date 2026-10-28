import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoProducts } from "../fixtures/discovery-demo.mjs";

// Public product SSR is real; identity and every mutation are isolated fixtures.
for (const width of [390, 1440]) {
  test(`product enquiry, collection and account utilities at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 936 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let role = "ANONYMOUS";
    const writes: string[] = [];
    const unexpected: string[] = [];
    const ok = (data: unknown) => ({
      success: true,
      data,
      message: "Isolated product audit fixture",
      meta: { requestId: "product-audit" },
    });
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname.endsWith("/auth/csrf"))
        return route.fulfill({
          json: ok({ csrfToken: "isolated-product-audit-".repeat(3) }),
        });
      if (url.pathname.endsWith("/public/fitment/makes"))
        return route.fulfill({ json: ok({ items: [] }) });
      if (url.pathname.endsWith("/auth/session"))
        return role === "ANONYMOUS"
          ? route.fulfill({
              status: 401,
              json: { success: false, error: { code: "UNAUTHORIZED" } },
            })
          : route.fulfill({ json: ok({ user: { role } }) });
      if (req.method() === "PUT" && url.pathname.includes("/customers/favourites/")) {
        writes.push(url.pathname);
        return route.fulfill({
          json: ok({
            product: { ...demoProducts[0], id: url.pathname.split("/").at(-1) },
          }),
        });
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) {
        unexpected.push(url.pathname);
        return route.abort();
      }
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "ISOLATED_UNMATCHED_REQUEST" } },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/parts");
    const href = await page
      .locator('.shop-product-card a[href^="/parts/"]')
      .first()
      .getAttribute("href");
    expect(
      href,
      "A published public product is required for this SSR acceptance case",
    ).toBeTruthy();
    await page.goto(href!);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .getByRole("link", { name: "Shop", exact: true }),
    ).toBeVisible();
    const actions = page.locator(".pd-actions");
    const enquiry = actions.getByRole("link", { name: "Send an enquiry", exact: true });
    await expect(enquiry).toHaveAttribute("href", /productId=/);
    const signIn = actions.getByRole("link", {
      name: "Sign in to save this product",
      exact: true,
    });
    await expect(signIn).toBeVisible();
    await expect(signIn).not.toHaveClass(/button/);
    expect(
      new URL(
        (await signIn.getAttribute("href"))!,
        "https://test.invalid",
      ).searchParams.get("next"),
    ).toBe(href);
    await expect(
      actions.getByRole("link", { name: "Ask our team", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Choose or update my vehicle", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".product-configuration-fitment")
        .getByRole("link", { name: "Browse products", exact: true }),
    ).toHaveAttribute("href", "/parts#products");
    await expect(
      page.getByRole("link", { name: "Ask about compatibility", exact: true }),
    ).toHaveCount(0);
    const empty = page.locator(".pd-photo-missing");
    if (await empty.count())
      expect((await empty.boundingBox())!.height).toBeLessThanOrEqual(180);
    const section = page.getByRole("navigation", { name: "Product sections" });
    await expect(
      section.getByRole("link", { name: "Delivery", exact: true }),
    ).toHaveCount(0);
    await section.getByRole("link", { name: "Collection", exact: true }).click();
    await expect(page).toHaveURL(/#product-delivery$/);
    await expect(
      page.getByText(
        "Visit only after our team confirms availability and collection arrangements. Delivery is unavailable.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByText("Can this product be delivered?", { exact: true }).click();
    await expect(
      page.getByText(
        "We currently offer workshop collection only. Confirm availability with our team before visiting.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ask about collection", exact: true }),
    ).toHaveAttribute("href", /productId=/);
    await expect(
      page.getByRole("heading", { name: "Enquire and collect" }),
    ).toBeInViewport();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await enquiry.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await enquiry.hover();
    await expect(enquiry).toBeFocused();
    expect(await enquiry.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      "none",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({ path: info.outputPath(`product-viewport-${width}.png`) });
    await page.screenshot({
      path: info.outputPath(`product-${width}.png`),
      fullPage: true,
    });
    role = "CUSTOMER";
    await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
    await page.getByRole("button", { name: "Save to favourites", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Saved to favourites", exact: true }),
    ).toBeDisabled();
    expect(writes).toHaveLength(1);
    role = "STAFF";
    await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
    await expect(page.getByRole("button", { name: /favourites/ })).toHaveCount(0);
    await expect(enquiry).toBeVisible();
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
