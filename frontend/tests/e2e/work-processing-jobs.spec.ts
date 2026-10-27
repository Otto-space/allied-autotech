import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workJobsFixture, jobRow } from "../fixtures/work-processing-jobs";
async function openFirst(page: Page) {
  await page
    .locator(".wj-row")
    .first()
    .getByRole("button", { name: /Inspect job/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Current job details", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await page
    .getByLabel("Job retry reason", { exact: true })
    .fill("Prior delivery and operational records reconciled");
  await page.getByRole("button", { name: "Review job retry", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`processing jobs directory and inspection at ${width}`, async ({ page }) => {
    const f = await workJobsFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/admin/processing-jobs");
    await expect(page.locator(".wj-row")).toHaveCount(3);
    for (const selected of [false, true]) {
      if (selected) {
        await openFirst(page);
        await page.getByText("References", { exact: true }).click();
      }
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
    }
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("source/status and signed cursor history survive reload, selection and Back", async ({
  page,
}) => {
  const f = await workJobsFixture(page);
  f.rows = Array.from({ length: 28 }, (_, n) => jobRow(n));
  await page.goto("/admin/processing-jobs");
  await expect(page.locator(".wj-row")).toHaveCount(25);
  await page.getByLabel("Job status", { exact: true }).selectOption("FAILED");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".wj-row")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".wj-row")).toHaveCount(3);
  await openFirst(page);
  await expect(page).toHaveURL(/selected=outbox/);
  await page.getByRole("button", { name: "Close inspection", exact: true }).click();
  await expect(page.locator(".wj-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".wj-row")).toHaveCount(25);
  expect(f.writes).toEqual([]);
});
test("a reviewed zero-attempt retry sends the exact revision and receives a queued-only outcome", async ({
  page,
}) => {
  const f = await workJobsFixture(page);
  f.rows = [jobRow(1)];
  await page.goto("/admin/processing-jobs");
  await openFirst(page);
  await page.getByRole("button", { name: "Review job retry", exact: true }).click();
  await expect(page.getByLabel("Job retry reason", { exact: true })).toBeFocused();
  const before = { ...f.rows[0] };
  await review(page);
  expect(f.writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toContainText("Recorded attempts");
  await confirm(page).click();
  await expect(page.getByText("Retry queued.", { exact: false })).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0].body).toEqual({
    expectedAttempts: 0,
    expectedUpdatedAt: before.updatedAt,
    reason: "Prior delivery and operational records reconciled",
  });
  await expect(
    page.getByRole("button", { name: "Review job retry", exact: true }),
  ).toHaveCount(0);
});
for (const mode of ["lost", "wrong-receipt"])
  test(`${mode} retry stays locked across reload and reconciles without replay`, async ({
    page,
  }) => {
    const f = await workJobsFixture(page);
    await page.setViewportSize({ width: 430, height: 1050 });
    await page.goto("/admin/processing-jobs");
    await openFirst(page);
    f.mode = mode;
    await review(page);
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record" })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Reconcile the earlier retry" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Inspect current job", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Current inspection", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel(
        "I independently reconciled the earlier retry using authorized operational records.",
      )
      .check();
    await page
      .getByRole("button", { name: "Acknowledge reconciliation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Reconcile the earlier retry" }),
    ).toHaveCount(0);
    expect(f.writes).toHaveLength(1);
  });
test("fresh changed job preserves the reason and sends no retry", async ({ page }) => {
  const f = await workJobsFixture(page);
  await page.goto("/admin/processing-jobs");
  await openFirst(page);
  await review(page);
  f.rows[0].updatedAt = "2026-10-19T09:00:00.000Z";
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No retry request was sent");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await expect(page.getByLabel("Job retry reason", { exact: true })).toHaveValue(
    "Prior delivery and operational records reconciled",
  );
  await expect(page.getByRole("button", { name: "Reload action fields" })).toBeVisible();
  expect(f.writes).toEqual([]);
});
test("denied refresh clears the selected job and prevents another private read", async ({
  page,
}) => {
  const f = await workJobsFixture(page);
  await page.goto("/admin/processing-jobs");
  await openFirst(page);
  f.mode = "denied";
  await page
    .getByRole("button", { name: "Refresh processing jobs", exact: true })
    .click();
  await expect(
    page.getByText("Protected records have been cleared.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current job details" })).toHaveCount(0);
  expect(f.writes).toEqual([]);
});

test("unavailable recovery storage prevents a retry request", async ({ page }) => {
  const f = await workJobsFixture(page);
  await page.goto("/admin/processing-jobs");
  await openFirst(page);
  await review(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:job-retry:v1:"))
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No retry request was sent");
  expect(f.writes).toEqual([]);
});

test("revoked current access clears the review before any retry request", async ({
  page,
}) => {
  const f = await workJobsFixture(page);
  await page.goto("/admin/processing-jobs");
  await openFirst(page);
  await review(page);
  f.base.profileMode = "inactive";
  await confirm(page).click();
  await expect(
    page.getByText("Protected records have been cleared.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current job details" })).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
