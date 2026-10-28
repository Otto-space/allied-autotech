import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceOverviewFixture } from "../fixtures/workforce-overview";
import { notificationResponsibilities } from "../fixtures/workforce-notifications";
const work = (page: Page) => page.getByRole("region", { name: "Your work", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh overview", exact: true });
async function ready(page: Page) {
  const state = await workforceOverviewFixture(page);
  await page.goto("/admin");
  await expect(
    work(page).getByRole("link", { name: /All bookings in your scope/ }),
  ).toBeVisible();
  return state;
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`workforce overview layout and access ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Position vacant", { exact: true })).toHaveCount(2);
    await expect(page.locator(".wfo-responsibilities")).toContainText(
      "Stadium Road workshop",
    );
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await refresh(page).focus();
    await expect(refresh(page)).toBeFocused();
    expect(errors).toEqual([]);
  });
for (const template of Object.keys(notificationResponsibilities) as Array<
  keyof typeof notificationResponsibilities
>)
  test(`${template} sees only permitted work destinations`, async ({ page }) => {
    const state = await workforceOverviewFixture(page, template);
    if (template === "OPERATIONS") state.notifications.role = "ADMIN";
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Active responsibilities", exact: true }),
    ).toBeVisible();
    const expected = Object.keys(state.overview.counts).map(
      (key) => `/admin/workforce/${key}`,
    );
    if (template === "ACCOUNTANT") expected.push("/admin/workforce/finance");
    expect(
      await work(page)
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(expected);
    expect(state.requests).not.toContain("/staff/overview");
    expect(state.requests).not.toContain("/staff/payments");
    if (template === "ACCOUNTANT") {
      await expect(work(page)).toContainText("View records");
      await expect(work(page).locator(".wfo-count")).toHaveCount(0);
    }
  });
test("zero counts remain real work links and refresh updates the server timestamp and totals", async ({
  page,
}) => {
  const state = await ready(page);
  state.overview.counts.bookings = 0;
  state.overview.generatedAt = "2026-10-19T10:50:00.000Z";
  await refresh(page).click();
  await expect(
    work(page).getByRole("link", { name: /All bookings in your scope/ }),
  ).toContainText("0");
  await expect(page.locator(".wfo-refresh time")).toHaveAttribute(
    "datetime",
    state.overview.generatedAt,
  );
  expect(state.overviewReads).toBeGreaterThan(1);
});
test("foreground failure hides old totals and successful retry restores them", async ({
  page,
}) => {
  const state = await ready(page);
  state.failOverview = true;
  await refresh(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Overview could not be refreshed",
  );
  await expect(work(page).locator("a")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Active responsibilities", exact: true }),
  ).toHaveCount(0);
  state.failOverview = false;
  await refresh(page).click();
  await expect(work(page).locator("a")).toHaveCount(4);
});
test("background failure cannot leave old totals presented as current", async ({
  page,
}) => {
  const state = await ready(page);
  state.failOverview = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Overview could not be refreshed",
  );
  await expect(work(page).locator("a")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Personal account tools" }),
  ).toBeVisible();
});
test("loading and denied reads expose no counters", async ({ page }) => {
  const state = await workforceOverviewFixture(page);
  state.holdOverview = true;
  await page.goto("/admin");
  await expect(
    page.getByText("Checking permitted queues…", { exact: true }),
  ).toBeVisible();
  await expect(work(page).locator("a")).toHaveCount(0);
  state.holdOverview = false;
  state.deniedOverview = true;
  state.releaseOverview?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Overview access unavailable",
  );
  await expect(work(page).locator("a")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("no active responsibilities gives useful personal access without operational links", async ({
  page,
}) => {
  const state = await workforceOverviewFixture(page);
  state.access.assignments = [];
  state.access.permissions = [];
  state.overview.counts = {};
  state.overview.branches = [];
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "No work queues available" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No active responsibilities" }),
  ).toBeVisible();
  await expect(work(page).locator("a")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Personal account tools" })
    .getByRole("link", { name: /^Notifications(?:, \d+ unread updates)?$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
});
test("another account or a changed access version never renders operational details", async ({
  page,
}) => {
  const state = await workforceOverviewFixture(page);
  state.overview.access = structuredClone(state.access);
  state.overview.access.version++;
  await page.goto("/admin");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your responsibilities changed",
  );
  await expect(work(page).locator("a")).toHaveCount(0);
  state.overview.access = state.access;
  await refresh(page).click();
  await expect(work(page).locator("a")).toHaveCount(4);
});
test("unexpected counter keys cannot produce undefined or unauthorized links", async ({
  page,
}) => {
  const state = await workforceOverviewFixture(page);
  state.overview.counts.payments = 40;
  await page.goto("/admin");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Overview could not be refreshed",
  );
  await expect(work(page).locator("a")).toHaveCount(0);
});
test("long branch labels and reasons remain readable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await workforceOverviewFixture(page);
  state.overview.branches[0].name = "W".repeat(240);
  state.access.assignments[0].reason = "R".repeat(1000);
  await page.goto("/admin");
  await expect(
    page.getByText(state.access.assignments[0].reason, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("overview alias keeps one breadcrumb and the same verified work", async ({
  page,
}) => {
  await workforceOverviewFixture(page);
  await page.goto("/admin/workforce");
  await expect(work(page).locator("a")).toHaveCount(4);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
});
test("revoked responsibilities remove queues and branch details on revalidation", async ({
  page,
}) => {
  const state = await ready(page);
  state.access.version++;
  state.access.assignments = [];
  state.access.permissions = [];
  state.overview.counts = {};
  state.overview.branches = [];
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "No work queues available" }),
  ).toBeVisible();
  await expect(work(page).locator("a")).toHaveCount(0);
  await expect(page.locator(".wfo-responsibilities")).not.toContainText(
    "Stadium Road workshop",
  );
  await expect(
    page.getByRole("navigation", { name: "Personal account tools" }),
  ).toBeVisible();
});
test("large valid counters remain readable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const state = await workforceOverviewFixture(page);
  state.overview.counts.bookings = Number.MAX_SAFE_INTEGER;
  await page.goto("/admin");
  await expect(
    work(page).getByRole("link", { name: /All bookings in your scope/ }),
  ).toContainText("9,007,199,254,740,991");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("temporary assignment expiry rechecks access without user interaction", async ({
  page,
}) => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  await page.clock.install({ time: now });
  const state = await workforceOverviewFixture(page);
  state.access.assignments.forEach((assignment) => {
    assignment.temporary = true;
    assignment.expiresAt = new Date(now.getTime() + 10000).toISOString();
  });
  await page.goto("/admin");
  await expect(work(page).locator("a")).toHaveCount(4);
  state.access.assignments = [];
  state.access.permissions = [];
  state.overview.branches = [];
  state.overview.counts = {};
  await page.clock.fastForward(10100);
  await expect(
    page.getByRole("heading", { name: "No active responsibilities" }),
  ).toBeVisible();
  await expect(work(page).locator("a")).toHaveCount(0);
});
