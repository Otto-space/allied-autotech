import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workRetentionPolicyFixture,
  retentionPolicyRow,
  id,
} from "../fixtures/work-retention-policy";
const root = "/admin/retention-policy";
async function fill(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic written owner approval");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic written retention policy approval for this version.");
}
async function review(page: Page) {
  await fill(page);
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve retention policy", exact: true })
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
  test(`retention policy responsive and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workRetentionPolicyFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(breadcrumb.locator("ol > li")).toHaveCount(2);
    await expect(breadcrumb.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(breadcrumb.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
      "Retention policy",
    );
    await expect(page.getByRole("region", { name: "Current policy" })).toContainText(
      "Version 2",
    );
    await expect(page.locator(".retention-schedule")).toContainText("Version 3");
    await expect(page.locator(".retention-schedule")).toContainText(
      "Latest recorded version: 4.",
    );
    await page.getByText("Retention policy history", { exact: true }).click();
    await page.locator(".retention-version > summary").first().click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("refresh preserves mounted draft and blocks old base until explicit reload", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page
    .getByLabel("Approved legal basis")
    .fill("Unsent legal basis retained during this refresh");
  f.records.unshift({ ...retentionPolicyRow(4), id: id(230005), version: 5 });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".retention-schedule")).toContainText(
    "Latest recorded version: 5.",
  );
  await expect(page.getByLabel("Approved legal basis")).toHaveValue(
    "Unsent legal basis retained during this refresh",
  );
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await expect(page.getByLabel("Approval source", { exact: true })).toHaveValue("");
  await review(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeFocused();
  expect(f.writes).toEqual([]);
});
test("page reload retains the unsent draft base and blocks a newer policy version", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page
    .getByLabel("Approved legal basis")
    .fill("Unsent legal basis retained across page reload");
  f.records.unshift({ ...retentionPolicyRow(4), id: id(230005), version: 5 });
  await page.reload();
  await expect(page.getByLabel("Approved legal basis")).toHaveValue(
    "Unsent legal basis retained across page reload",
  );
  await expect(page.locator(".retention-draft-source")).toContainText("version 4");
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
for (const change of ["version", "identity"])
  test(`fresh ${change} preflight prevents publication`, async ({ page }) => {
    const f = await workRetentionPolicyFixture(page);
    await page.goto(root);
    await review(page);
    if (change === "version")
      f.records.unshift({ ...retentionPolicyRow(4), id: id(230005), version: 5 });
    if (change === "identity") f.base.profileMode = "mismatch";
    await confirm(page);
    if (change === "identity") {
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
      await expect(page.locator(".retention-current")).toHaveCount(0);
    } else
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Approve retention policy", exact: true }),
      ).toBeDisabled();
    expect(f.writes).toEqual([]);
  });
test("successful receipt records exact settings and clears approval metadata", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Retention policy recorded" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "RETENTION",
    expectedVersion: 4,
    settings: {
      destructiveExecutionEnabled: false,
      records: [
        {
          recordType: "INVOICE",
          retentionMonths: 84,
          startEvent: "Synthetic invoice issue date",
          disposition: "RETAIN",
          legalBasis: "Synthetic approved accounting retention basis for testing only.",
        },
      ],
    },
  });
  await expect(page.getByLabel("Approval source", { exact: true })).toHaveValue("");
});
test("confirmed approval survives a failed refresh without offering an older draft base", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  f.outcome = "refresh-error";
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Retention policy recorded" }),
  ).toBeVisible();
  await expect(page.locator(".retention-draft-source")).toContainText("version 5");
  await expect(page.getByRole("button", { name: "Reload action fields" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  f.mode = "normal";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".retention-schedule")).toContainText(
    "Latest recorded version: 5.",
  );
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeEnabled();
  expect(f.writes).toHaveLength(1);
});
for (const outcome of ["lost", "wrong-actor"])
  test(`${outcome} receipt stays locked after reload until independent reconciliation`, async ({
    page,
  }) => {
    const f = await workRetentionPolicyFixture(page);
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
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear reconciled approval lock" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /I independently reconciled/ }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await expect(
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });
test("unavailable recovery storage prevents a write", async ({ page }) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await review(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("aat:retention-policy:"))
        throw new DOMException("Unavailable", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await confirm(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve retention policy", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
for (const mode of ["empty", "error", "denied"])
  test(`${mode} state remains accessible`, async ({ page }) => {
    const f = await workRetentionPolicyFixture(page);
    f.mode = mode;
    await page.goto(root);
    if (mode === "empty")
      await expect(
        page.getByText("No retention policy is effective at this check."),
      ).toBeVisible();
    else if (mode === "denied")
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Refresh", exact: true }),
      ).toBeVisible();
    await axe(page);
    expect(f.writes).toEqual([]);
  });
test("ordinary Admin cannot read or approve the policy", async ({ page }) => {
  const f = await workRetentionPolicyFixture(page, "ADMIN");
  await page.goto(root);
  await expect(page.locator(".retention-current")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toHaveCount(0);
  expect(f.reads).toEqual([]);
});

async function rule(
  page: Page,
  index: number,
  category: string,
  months: string,
  start: string,
  basis: string,
) {
  await page
    .getByLabel("Record category", { exact: true })
    .nth(index)
    .selectOption(category);
  await page
    .getByLabel("Retention period (months)", { exact: true })
    .nth(index)
    .fill(months);
  await page.getByLabel("Period starts from", { exact: true }).nth(index).fill(start);
  await page
    .getByLabel("Disposition after the period", { exact: true })
    .nth(index)
    .selectOption("REVIEW_DELETION");
  await page.getByLabel("Approved legal basis", { exact: true }).nth(index).fill(basis);
}
test("added and removed rules preserve full drafts through reindex and reload, then publish once", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  const add = page.getByRole("button", { name: "Add retention rule", exact: true });
  await add.click();
  await rule(
    page,
    1,
    "SUPPORT",
    "12",
    "Synthetic support closure",
    "Synthetic approved support legal basis retained across reload.",
  );
  await add.click();
  await rule(
    page,
    2,
    "ACCOUNT",
    "24",
    "Synthetic account closure",
    "Synthetic approved account legal basis retained across reload.",
  );
  await page.getByRole("button", { name: "Remove rule 1", exact: true }).click();
  await expect(add).toBeFocused();
  await expect(page.getByLabel("Record category", { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("Record category", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Record category", { exact: true }).nth(0)).toHaveValue(
    "SUPPORT",
  );
  await expect(page.getByLabel("Record category", { exact: true }).nth(1)).toHaveValue(
    "ACCOUNT",
  );
  await expect(
    page.getByLabel("Approved legal basis", { exact: true }).nth(1),
  ).toHaveValue("Synthetic approved account legal basis retained across reload.");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Deletion and anonymization remain disabled.",
  );
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Retention policy recorded" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "RETENTION",
    expectedVersion: 4,
    settings: {
      destructiveExecutionEnabled: false,
      records: [
        {
          recordType: "SUPPORT",
          retentionMonths: 12,
          startEvent: "Synthetic support closure",
          disposition: "REVIEW_DELETION",
          legalBasis: "Synthetic approved support legal basis retained across reload.",
        },
        {
          recordType: "ACCOUNT",
          retentionMonths: 24,
          startEvent: "Synthetic account closure",
          disposition: "REVIEW_DELETION",
          legalBasis: "Synthetic approved account legal basis retained across reload.",
        },
      ],
    },
  });
});

test("a structure-only edit retains its original version across reload", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.goto(root);
  await page.getByRole("button", { name: "Add retention rule", exact: true }).click();
  f.records.unshift({ ...retentionPolicyRow(4), id: id(230005), version: 5 });
  await page.reload();
  await expect(page.getByLabel("Record category", { exact: true })).toHaveCount(2);
  await expect(page.locator(".retention-draft-source")).toContainText("version 4");
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload action fields", exact: true }).click();
  await expect(page.getByLabel("Record category", { exact: true })).toHaveCount(1);
  expect(f.writes).toEqual([]);
});

test("rule limits and long legal text remain usable on a narrow screen", async ({
  page,
}) => {
  const f = await workRetentionPolicyFixture(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(root);
  await expect(
    page.getByRole("button", { name: "Remove rule 1", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Approved legal basis", { exact: true }).fill("L".repeat(1000));
  const add = page.getByRole("button", { name: "Add retention rule", exact: true });
  for (let i = 1; i < 20; i++) await add.click();
  await expect(page.getByLabel("Record category", { exact: true })).toHaveCount(20);
  await expect(add).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  for (let i = 20; i > 1; i--)
    await page.getByRole("button", { name: `Remove rule ${i}`, exact: true }).click();
  await expect(page.getByLabel("Approved legal basis", { exact: true })).toHaveValue(
    "L".repeat(1000),
  );
  await fill(page);
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await axe(page);
  expect(
    await page.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  expect(f.writes).toEqual([]);
});
