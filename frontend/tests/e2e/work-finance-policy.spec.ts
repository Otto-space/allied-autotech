import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workFinancePolicyFixture,
  financePolicyRow,
} from "../fixtures/work-finance-policy";
const root = "/admin/finance-policy";
async function fill(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic signed accountant approval");
  await page
    .getByLabel("Written accounting approval or reference")
    .fill("Synthetic accounting evidence for the exact proposed settings.");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2040-01-05T08:30");
}
async function review(page: Page) {
  await fill(page);
  await page.getByRole("button", { name: "Review financial approval" }).click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve financial policy", exact: true })
    .click();
}
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`financial policy responsive and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workFinancePolicyFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    await expect(page.getByLabel("Invoice business name", { exact: true })).toBeEnabled();
    await expect(page.getByRole("region", { name: "Current policy" })).toContainText(
      "Version 2",
    );
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
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("effective, scheduled and latest are distinct; refresh retains draft and review cancellation restores focus", async ({
  page,
}) => {
  const f = await workFinancePolicyFixture(page);
  await page.goto(root);
  await expect(page.locator(".finance-schedule")).toContainText("Version 3");
  await expect(page.locator(".finance-schedule")).toContainText(
    "Latest recorded version: 4.",
  );
  await page
    .getByLabel("Invoice business name", { exact: true })
    .fill("Unsent invoice name");
  f.records.unshift({
    ...financePolicyRow(4),
    version: 5,
    id: "e4000000-0000-4000-8000-000000230005",
  });
  await page
    .getByRole("button", { name: "Refresh financial policy", exact: true })
    .click();
  await expect(
    page.getByText("Latest recorded version: 5.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Invoice business name", { exact: true })).toHaveValue(
    "Unsent invoice name",
  );
  await review(page);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review financial approval" }),
  ).toBeFocused();
  expect(f.writes).toEqual([]);
});
test("fresh version preflight prevents sending an obsolete approval", async ({
  page,
}) => {
  const f = await workFinancePolicyFixture(page);
  await page.goto(root);
  await review(page);
  f.records.unshift({
    ...financePolicyRow(4),
    version: 5,
    id: "e4000000-0000-4000-8000-000000230005",
  });
  await confirm(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve financial policy", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
test("live grant loss closes privileged facts before publication", async ({ page }) => {
  const f = await workFinancePolicyFixture(page);
  await page.goto(root);
  await review(page);
  f.grants = [];
  await confirm(page);
  await expect(page.getByRole("button", { name: "Refresh permission" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current policy" })).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
for (const outcome of ["lost", "wrong-actor"])
  test(`${outcome} receipt locks after reload; current read and independent reconciliation are required`, async ({
    page,
  }) => {
    const f = await workFinancePolicyFixture(page);
    f.outcome = outcome;
    await page.goto(root);
    await review(page);
    await confirm(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record" })
      .click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Review financial approval" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Approval needs reconciliation" }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(1);
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear reconciled approval lock" }),
    ).toBeDisabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("checkbox", { name: /I independently reconciled/ }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await expect(
      page.getByRole("button", { name: "Review financial approval" }),
    ).toBeEnabled();
    expect(f.writes).toHaveLength(1);
    await review(page);
    await confirm(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record" })
      .click();
    await expect(
      page.getByRole("checkbox", { name: /I independently reconciled/ }),
    ).toHaveCount(0);
    expect(f.writes).toHaveLength(2);
  });
for (const mode of ["empty", "error", "denied"])
  test(`${mode} state is accessible and contains no fabricated policy`, async ({
    page,
  }) => {
    const f = await workFinancePolicyFixture(page);
    f.mode = mode;
    await page.goto(root);
    if (mode === "empty")
      await expect(
        page.getByText("No financial policy is effective at this check."),
      ).toBeVisible();
    else if (mode === "denied")
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Refresh financial policy", exact: true }),
      ).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(f.writes).toEqual([]);
  });
