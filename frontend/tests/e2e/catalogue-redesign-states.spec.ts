import { expect, test } from "@playwright/test";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";

// Isolated browser responses exercise exceptional states without database writes.
for (const width of [390, 1440]) {
  for (const kind of ["parts", "vehicles", "services"] as const) {
    test(`${kind} loading, error retry and empty recovery at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/api/v1/**", (route) =>
        route.request().method() === "GET" ? route.continue() : route.abort(),
      );
      await page.goto(`/${kind}`);
      let phase: "error" | "empty" | "populated" = "error";
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = false;
      const endpoint =
        kind === "parts"
          ? "/public/catalog/products/discovery"
          : `/public/${kind}/discovery`;
      await page.route(`**${endpoint}?**`, async (route) => {
        const url = new URL(route.request().url());
        const publication =
          kind === "parts" &&
          url.searchParams.get("limit") === "1" &&
          !url.searchParams.has("search");
        started = true;
        await held;
        if (phase === "error" && !publication)
          return route.fulfill({
            status: 503,
            json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
          });
        return route.fulfill({
          json: {
            success: true,
            data: discoveryResponse(
              url,
              publication ? "populated" : phase === "error" ? "empty" : phase,
            ),
            message: "Isolated state fixture",
            meta: { requestId: "redesign-state" },
          },
        });
      });
      const search = page.getByRole("searchbox", {
        name:
          kind === "parts"
            ? "Search products"
            : kind === "vehicles"
              ? "Search vehicles"
              : "Search services",
        exact: true,
      });
      await search.fill("DEMO");
      await search.press("Enter");
      await expect.poll(() => started).toBe(true);
      const results = page.locator(
        kind === "parts"
          ? "#product-results"
          : kind === "vehicles"
            ? "#vehicle-results"
            : ".services-results",
      );
      await expect(results).toHaveAttribute("aria-busy", "true");
      release();
      await expect(
        results.getByRole("button", { name: /Retry|Try again/ }),
      ).toBeVisible();
      phase = "empty";
      await results.getByRole("button", { name: /Retry|Try again/ }).click();
      await expect(results.getByRole("heading", { name: /No matching/ })).toBeVisible();
      phase = "populated";
      await page
        .getByRole("button", {
          name: kind === "services" ? "Clear filter" : "Clear filters",
          exact: true,
        })
        .click();
      await expect(
        page
          .locator(
            kind === "parts"
              ? ".shop-product-card"
              : kind === "vehicles"
                ? ".vehicle-card"
                : ".services-row",
          )
          .first(),
      ).toBeVisible();
      if (kind === "parts") {
        await page.getByRole("button", { name: /Next/, exact: false }).last().click();
        await expect(page).toHaveURL(/cursor=/);
        await page
          .getByRole("button", { name: /Previous/, exact: false })
          .last()
          .click();
        await expect(page).not.toHaveURL(/cursor=/);
      }
      await page.goBack();
      // Back restores the preceding URL rather than resetting the discovery state.
      await expect(page).toHaveURL(kind === "parts" ? /cursor=/ : /search=DEMO/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    });
  }
}

test("failed service photography keeps a labelled image area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
  await page.route("**/*", (route) =>
    route.request().resourceType() === "image" &&
    !new URL(route.request().url()).pathname.startsWith("/_next/static/")
      ? route.abort()
      : route.fallback(),
  );
  await page.goto("/services");
  await expect(
    page.getByRole("img", { name: "Service image unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".services-row")
      .first()
      .getByRole("link", { name: /View service/ }),
  ).toBeVisible();
});

test("a failed draft count never blocks applying valid product filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/v1/**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
  await page.route("**/public/catalog/products/discovery?**", (route) =>
    new URL(route.request().url()).searchParams.get("limit") === "1"
      ? route.fulfill({
          status: 503,
          json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.continue(),
  );
  await page.goto("/parts");
  await page.locator(".product-filter-trigger").click();
  const panel = page.locator("#product-filter-panel");
  await panel.getByLabel("Maximum", { exact: true }).fill("0.01");
  await expect(panel.getByRole("status").last()).toHaveText(
    "Count unavailable. You can still apply filters.",
  );
  await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/maxPriceKobo=1(?:&|$)/);
  await expect(
    page.getByRole("heading", { name: "No matching products", exact: true }),
  ).toBeVisible();
});
