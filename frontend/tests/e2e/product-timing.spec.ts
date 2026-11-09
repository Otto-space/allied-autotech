import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { id } from "../fixtures/public-account-actions";

const control = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
test.skip(!control, "Requires the existing loopback production-build fixture");

test.beforeEach(async ({ page, request }) => {
  const origin = new URL(control!);
  expect(origin.origin).toBe("http://127.0.0.1:5024");
  const configured = await request.post(`${origin.origin}/__capabilities`, {
    data: { mode: "browse_enquiries" },
  });
  expect(configured.ok()).toBe(true);
  await page.route("**/api/v1/**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/v1/public/")) {
      const response = await route.fetch({
        url: `${origin.origin}${url.pathname}${url.search}`,
      });
      return route.fulfill({ response });
    }
    return route.fulfill({
      status: 401,
      json: { success: false, error: { code: "UNAUTHENTICATED" } },
    });
  });
});

for (const width of [320, 768, 1440]) {
  test(`recorded product estimates remain readable at ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/parts/${id(90140)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Synthetic recorded timing part",
    );
    const estimates = page.getByRole("region", {
      name: "Sourcing and preparation estimates",
    });
    await expect(estimates).toContainText("3–7 calendar days");
    await expect(estimates).toContainText("60 minutes");
    await expect(estimates).toContainText("These are estimates");
    await expect(
      page.getByRole("button", { name: "Add to cart", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("#product-information")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await estimates.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`product-estimates-${width}.png`) });
    expect(errors).toEqual([]);
  });
}

test("unknown product times do not become promises or stock confirmation", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/parts/${id(90141)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Synthetic unknown timing part",
  );
  await expect(
    page.getByRole("region", { name: "Sourcing and preparation estimates" }),
  ).toHaveCount(0);
  await expect(page.getByText("Photos not available", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Branch availability" })).toContainText(
    "Availability not listed",
  );
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("product-estimates-unknown-320.png") });
});
