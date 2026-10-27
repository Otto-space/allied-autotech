import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workCapacityFixture,
  capacityRow,
  capacityId,
} from "../fixtures/work-booking-capacity";
const root = `/admin/booking-capacity?branch=${capacityId(1)}`;
const reviewButton = (page: Page) =>
  page.getByRole("button", { name: "Review capacity approval", exact: true });
async function fill(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic written workshop approval");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic signed capacity approval for isolated verification only.");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2048-01-05T08:30");
}
async function review(page: Page) {
  await fill(page);
  await reviewButton(page).click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve capacity", exact: true })
    .click();
}
async function axe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`capacity accessible and responsive at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workCapacityFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    const nav = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(nav.locator("ol > li")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Booking capacity");
    await expect(
      page.getByRole("region", { name: "Current capacity", exact: true }),
    ).toContainText("Version 2");
    await expect(page.locator(".capacity-schedule")).toContainText("Version 3");
    await expect(page.locator(".capacity-schedule")).toContainText(
      "Latest recorded version: 4.",
    );
    await page.getByText("Capacity policy history", { exact: true }).click();
    await page.locator(".capacity-version > summary").first().click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    await expect(
      page.getByRole("dialog").getByText("Synthetic workshop", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(reviewButton(page)).toBeFocused();
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("empty branch has no invented defaults and publishes one reviewed exact policy", async ({
  page,
}) => {
  const f = await workCapacityFixture(page);
  f.history = [];
  await page.goto("/admin/booking-capacity");
  await page.getByLabel("Workshop branch").selectOption(capacityId(1));
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("");
  await expect(page.getByLabel("Monday", { exact: true })).not.toBeChecked();
  await page.getByLabel("Maximum confirmed bookings per day").fill("4");
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Tuesday", { exact: true }).check();
  await page
    .getByLabel("Closed dates (optional)")
    .fill("2048-04-02\n2048-01-01\n2048-01-01");
  await review(page);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(f.writes).toEqual([]);
  await reviewButton(page).click();
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Booking capacity recorded" }),
  ).toBeFocused();
  await expect(
    page.getByText("Latest recorded version: 1.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toEqual([
    {
      kind: "BRANCH_CAPACITY",
      branchId: capacityId(1),
      expectedVersion: 0,
      effectiveAt: "2048-01-05T07:30:00.000Z",
      source: "Synthetic written workshop approval",
      approvalEvidence:
        "Synthetic signed capacity approval for isolated verification only.",
      settings: {
        dailyLimit: 4,
        openingDays: [1, 2],
        opensAt: "08:00",
        closesAt: "18:00",
        holidays: ["2048-01-01", "2048-04-02"],
        timezone: "Africa/Lagos",
      },
    },
  ]);
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
});
test("unsent drafts stay isolated by branch across navigation and reload", async ({
  page,
}) => {
  const f = await workCapacityFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Maximum confirmed bookings per day").fill("17");
  await page.getByLabel("Workshop branch").selectOption(capacityId(9));
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("8");
  await expect(page.getByLabel("Approval source", { exact: true })).toHaveValue("");
  await page.getByLabel("Maximum confirmed bookings per day").fill("23");
  await page.getByLabel("Workshop branch").selectOption(capacityId(1));
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("17");
  await page.reload();
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("17");
  expect(f.writes).toEqual([]);
});
test("refresh preserves draft and stale base until explicit reload", async ({ page }) => {
  const f = await workCapacityFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Maximum confirmed bookings per day").fill("17");
  f.history.unshift(capacityRow(5));
  await page.getByRole("button", { name: "Refresh capacity policy" }).click();
  await expect(page.locator(".capacity-schedule")).toContainText(
    "Latest recorded version: 5.",
  );
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("17");
  await expect(reviewButton(page)).toBeDisabled();
  await page.reload();
  await expect(reviewButton(page)).toBeDisabled();
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("17");
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await expect(reviewButton(page)).toBeEnabled();
  expect(f.writes).toEqual([]);
});
for (const change of ["version", "identity", "inactive", "branch update"])
  test(`fresh ${change} prevents publication`, async ({ page }) => {
    const f = await workCapacityFixture(page);
    await page.goto(root);
    await review(page);
    if (change === "version") f.history.unshift(capacityRow(5));
    if (change === "identity") f.profileOwner = capacityId(99);
    if (change === "inactive") f.branch.isActive = false;
    if (change === "branch update") f.branch.updatedAt = "2026-10-19T09:00:00Z";
    await confirm(page);
    if (change === "identity")
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
    else
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Approve capacity", exact: true }),
      ).toBeDisabled();
    expect(f.writes).toEqual([]);
  });
for (const outcome of ["lost", "wrong actor"])
  test(`${outcome} locks only that branch after reload without replay`, async ({
    page,
  }) => {
    const f = await workCapacityFixture(page);
    f.drop = outcome === "lost";
    f.wrongActor = outcome === "wrong actor";
    await page.goto(root);
    await review(page);
    await confirm(page);
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(reviewButton(page)).toBeDisabled();
    await page.getByLabel("Workshop branch").selectOption(capacityId(9));
    await expect(reviewButton(page)).toBeEnabled();
    await page.getByLabel("Workshop branch").selectOption(capacityId(1));
    await expect(reviewButton(page)).toBeDisabled();
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear reconciled approval lock" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /I independently reconciled/ }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await expect(reviewButton(page)).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });
test("server rejection prevents automatic replay", async ({ page }) => {
  const f = await workCapacityFixture(page);
  await page.route("**/api/v1/admin/policies", (r) =>
    r.fulfill({ status: 409, json: { success: false, error: { code: "CONFLICT" } } }),
  );
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve capacity", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
test("calendar validation focuses missing weekdays and malformed dates", async ({
  page,
}) => {
  const f = await workCapacityFixture(page);
  await page.goto(root);
  await fill(page);
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await page.getByLabel(day, { exact: true }).uncheck();
  await reviewButton(page).click();
  await expect(page.getByLabel("Sunday", { exact: true })).toBeFocused();
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Closed dates (optional)").fill("2048-02-30");
  await reviewButton(page).click();
  await expect(page.getByLabel("Closed dates (optional)")).toBeFocused();
  expect(f.writes).toEqual([]);
});
for (const state of ["error", "denied", "inactive", "empty"])
  test(`${state} state stays accessible`, async ({ page }) => {
    const f = await workCapacityFixture(page);
    if (state === "error") f.fail = true;
    if (state === "denied") f.denied = true;
    if (state === "inactive") f.branch.isActive = false;
    if (state === "empty") f.history = [];
    await page.goto(root);
    if (state === "denied")
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
    else if (state === "error") {
      await expect(
        page.getByRole("button", { name: "Refresh capacity policy" }),
      ).toBeVisible();
      await expect(page.locator(".capacity-current")).toHaveCount(0);
    } else if (state === "inactive") await expect(reviewButton(page)).toBeDisabled();
    else
      await expect(
        page.getByText("No capacity policy is effective at this check."),
      ).toBeVisible();
    await axe(page);
    expect(f.writes).toEqual([]);
  });
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot inspect or approve capacity`, async ({ page }) => {
    const f = await workCapacityFixture(page);
    f.role = role;
    await page.goto(root);
    await expect(
      page.getByText(
        "Capacity policy requires an active, verified Super Admin account with MFA.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Workshop branch")).toHaveCount(0);
    expect(f.writes).toEqual([]);
  });
