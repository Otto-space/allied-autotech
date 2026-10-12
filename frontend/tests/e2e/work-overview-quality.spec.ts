import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workOverviewFixture } from "../fixtures/work-overview";
const openMonitoring = async (page: import("@playwright/test").Page) => {
  await page.getByText("Processing queues & payment monitoring", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Worker health", exact: true }),
  ).toBeVisible();
};
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} monitoring is lazy, complete and read-only`, async ({ page }) => {
    const state = await workOverviewFixture(page, role);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Workshop overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Organisation-wide activity in your selected period.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(state.operationsReads).toBe(0);
    await openMonitoring(page);
    const panel = page.locator(".work-operations-body");
    await expect(panel.getByText("Recent success", { exact: true })).toBeVisible();
    await expect(panel.getByText("Overdue", { exact: true })).toBeVisible();
    await expect(panel.getByText("Not reported", { exact: true })).toBeVisible();
    await expect(panel.getByText("A synthetic payment requires review.")).toBeVisible();
    await expect(panel).not.toContainText("private-key-not-rendered");
    await expect(panel).toContainText("Recorded differences: 0");
    await expect(
      panel.getByRole("link", { name: "Review exceptions", exact: true }),
    ).toHaveAttribute("href", "/admin/payment-exceptions");
    const initialOverviewReads = state.overviewReads.length;
    const initialOperationsReads = state.operationsReads;
    await page.getByLabel("Overview date preset").selectOption("7");
    await expect.poll(() => state.overviewReads.length).toBe(initialOverviewReads + 1);
    expect(state.operationsReads).toBe(initialOperationsReads);
    await page.getByRole("button", { name: "Refresh operations", exact: true }).click();
    await expect.poll(() => state.operationsReads).toBe(initialOperationsReads + 1);
    expect(state.writes).toEqual([]);
  });
test("staff has branch scope without finance or monitoring requests", async ({
  page,
}) => {
  const state = await workOverviewFixture(page, "STAFF");
  await page.goto("/admin");
  await expect(
    page.getByText("Stadium Road workshop · Your branch at a glance."),
  ).toBeVisible();
  await expect(page.getByText("Stock added", { exact: true })).toBeVisible();
  await expect(page.getByText("Payments collected", { exact: true })).toHaveCount(0);
  await expect(page.locator(".overview-operations")).toHaveCount(0);
  expect(state.operationsReads).toBe(0);
});
for (const mode of ["range", "scope", "branch", "finance"])
  test(`unverified ${mode} cannot expose metrics`, async ({ page }) => {
    const state = await workOverviewFixture(
      page,
      mode === "branch" || mode === "finance" ? "STAFF" : "ADMIN",
    );
    state.overviewMode = mode;
    await page.goto("/admin");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be verified",
    );
    await expect(page.locator(".overview-metric")).toHaveCount(0);
    state.overviewMode = "normal";
    await page.getByRole("button", { name: "Retry overview" }).click();
    await expect(page.locator(".overview-metric")).toHaveCount(5);
  });
test("background overview and monitoring failures are visible and refresh recovers", async ({
  page,
}) => {
  const state = await workOverviewFixture(page);
  await page.goto("/admin");
  await openMonitoring(page);
  state.overviewMode = "error";
  state.operationsMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Overview may be out of date. Refresh to check current figures.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Operations may be out of date. Refresh operations to check current status.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".overview-metric")).toHaveCount(5);
  await expect(page.getByText("A synthetic payment requires review.")).toBeVisible();
  state.overviewMode = "normal";
  state.operationsMode = "normal";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Refresh operations", exact: true }).click();
  await expect(page.getByText(/may be out of date/)).toHaveCount(0);
});
for (const mode of ["empty", "legacy", "invalid", "error", "denied"])
  test(`monitoring ${mode} never invents healthy status`, async ({ page }) => {
    const state = await workOverviewFixture(page);
    state.operationsMode = mode;
    await page.goto("/admin");
    await page
      .getByText("Processing queues & payment monitoring", { exact: true })
      .click();
    if (mode === "empty") {
      await expect(page.getByText("No workers were reported.")).toBeVisible();
      await expect(page.getByText("No unresolved alerts were returned.")).toBeVisible();
    } else if (mode === "legacy")
      await expect(
        page.getByText(
          "Worker status was not supplied. Refresh operations to check again.",
        ),
      ).toBeVisible();
    else
      await expect(
        page.locator(".work-operations-body").getByRole("alert"),
      ).toBeVisible();
    await expect(page.getByText("Recent success", { exact: true })).toHaveCount(0);
  });
test("failed manual monitoring hides old values and recovers", async ({ page }) => {
  const state = await workOverviewFixture(page);
  await page.goto("/admin");
  await openMonitoring(page);
  state.operationsMode = "error";
  await page.getByRole("button", { name: "Refresh operations", exact: true }).click();
  await expect(page.locator(".work-operations-body").getByRole("alert")).toBeVisible();
  await expect(page.getByText("A synthetic payment requires review.")).toHaveCount(0);
  state.operationsMode = "normal";
  await page.getByRole("button", { name: "Refresh operations", exact: true }).click();
  await expect(page.getByText("A synthetic payment requires review.")).toBeVisible();
});
test("background permission loss removes retained private monitoring", async ({
  page,
}) => {
  const state = await workOverviewFixture(page);
  await page.goto("/admin");
  await openMonitoring(page);
  state.operationsMode = "denied";
  state.overviewMode = "denied";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".work-operations-body").getByRole("alert")).toBeVisible();
  await expect(page.getByText("A synthetic payment requires review.")).toHaveCount(0);
  await expect(page.locator(".overview-metric")).toHaveCount(0);
});

test("session invalidation unmounts open monitoring and aggregate data", async ({
  page,
}) => {
  await workOverviewFixture(page);
  await page.goto("/admin");
  await openMonitoring(page);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  await expect(page.getByText("A synthetic payment requires review.")).toHaveCount(0);
  await expect(page.locator(".overview-metric")).toHaveCount(0);
});

for (const width of [320, 375, 390, 768, 844, 1024, 1280, 1434, 1920])
  test(`readable work overview and monitoring at ${width}px`, async ({ page }) => {
    const state = await workOverviewFixture(page);
    state.overviewMode = "long";
    await page.setViewportSize({ width, height: width === 844 ? 390 : 1097 });
    await page.goto("/admin");
    await openMonitoring(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const booking = page.getByRole("link", { name: /View booking .* Comprehensive/ });
    await booking.scrollIntoViewIfNeeded();
    await expect(booking).toBeVisible();
    const box = await booking.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if ([375, 768, 1434].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
  });
