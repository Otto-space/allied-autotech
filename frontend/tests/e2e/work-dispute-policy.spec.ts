import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workDisputePolicyFixture,
  disputePolicyRow,
  id,
} from "../fixtures/work-dispute-policy";
const root = "/admin/dispute-policy";
async function fill(page: Page) {
  await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(310));
  await expect(page.locator('input[name="backupUserId"]')).toHaveValue(id(311));
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic written owner approval");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic written dispute policy approval for this version.");
  await page.getByLabel("I confirm that this schedule").check();
}
async function review(page: Page) {
  await fill(page);
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve dispute policy", exact: true })
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
  test(`dispute policy responsive and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workDisputePolicyFixture(page),
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
      "Dispute policy",
    );
    await expect(page.getByRole("region", { name: "Current policy" })).toContainText(
      "Version 2",
    );
    await expect(page.locator(".dispute-schedule")).toContainText("Version 3");
    await expect(page.locator(".dispute-schedule")).toContainText(
      "Latest recorded version: 4.",
    );
    await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(310));
    await page.getByText("Dispute policy history", { exact: true }).click();
    await page.locator(".dispute-version > summary").first().click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("contact search and paging preserve selection; only explicit review publishes", async ({
  page,
}) => {
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(310));
  await page
    .getByRole("navigation", { name: "Policy contacts pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.locator("#policy-primaryUserId")).toContainText("Chidi");
  await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(310));
  await page.getByLabel("Search staff contacts").fill("Chidi");
  await page.getByRole("button", { name: "Search contacts", exact: true }).click();
  await expect
    .poll(() =>
      f.contactReads.some(
        (u) => u.searchParams.get("q") === "Chidi" && !u.searchParams.has("cursor"),
      ),
    )
    .toBe(true);
  await page.getByLabel("Search staff contacts").fill("x");
  await page.getByLabel("Search staff contacts").press("Enter");
  await expect(
    page.getByText("Enter 2–100 characters, or clear the search."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByLabel("Search staff contacts").fill("missing");
  await page.getByRole("button", { name: "Search contacts", exact: true }).click();
  await expect(page.getByText(/No eligible contacts on this page/)).toBeVisible();
  await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(310));
  expect(f.writes).toEqual([]);
});
test("refresh preserves mounted draft and blocks old base until explicit reload", async ({
  page,
}) => {
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Excluded holiday dates (optional)").fill("2035-01-01");
  f.records.unshift({ ...disputePolicyRow(4), id: id(230005), version: 5 });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".dispute-schedule")).toContainText(
    "Latest recorded version: 5.",
  );
  await expect(page.getByLabel("Excluded holiday dates (optional)")).toHaveValue(
    "2035-01-01",
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
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Excluded holiday dates (optional)").fill("2035-01-02");
  f.records.unshift({ ...disputePolicyRow(4), id: id(230005), version: 5 });
  await page.reload();
  await expect(page.getByLabel("Excluded holiday dates (optional)")).toHaveValue(
    "2035-01-02",
  );
  await expect(page.locator(".dispute-draft-source")).toContainText("version 4");
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
for (const change of ["version", "contact", "identity", "grant"])
  test(`fresh ${change} preflight prevents publication`, async ({ page }) => {
    const f = await workDisputePolicyFixture(page);
    await page.goto(root);
    await review(page);
    if (change === "version")
      f.records.unshift({ ...disputePolicyRow(4), id: id(230005), version: 5 });
    if (change === "contact") f.contactMode = "inactive";
    if (change === "grant") f.grantMode = "revoked";
    if (change === "identity") f.base.profileMode = "mismatch";
    await confirm(page);
    if (change === "identity") {
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
      await expect(page.locator(".dispute-current")).toHaveCount(0);
    } else
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Approve dispute policy", exact: true }),
      ).toBeDisabled();
    expect(f.writes).toEqual([]);
  });
test("successful receipt records exact settings and clears approval metadata", async ({
  page,
}) => {
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Dispute policy recorded" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "DISPUTES",
    expectedVersion: 4,
    settings: {
      primaryUserId: id(310),
      backupUserId: id(311),
      days: [1, 2, 3, 4, 5],
      openMinute: 480,
      closeMinute: 1080,
    },
  });
  await expect(page.getByLabel("Approval source", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("I confirm that this schedule")).not.toBeChecked();
});
test("confirmed approval survives a failed refresh without offering an older draft base", async ({
  page,
}) => {
  const f = await workDisputePolicyFixture(page);
  f.outcome = "refresh-error";
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Dispute policy recorded" }),
  ).toBeVisible();
  await expect(page.locator(".dispute-draft-source")).toContainText("version 5");
  await expect(page.getByRole("button", { name: "Reload action fields" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeDisabled();
  f.mode = "normal";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".dispute-schedule")).toContainText(
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
    const f = await workDisputePolicyFixture(page);
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
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await review(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("aat:dispute-policy:"))
        throw new DOMException("Unavailable", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await confirm(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve dispute policy", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
for (const mode of ["empty", "error", "denied"])
  test(`${mode} state remains accessible`, async ({ page }) => {
    const f = await workDisputePolicyFixture(page);
    f.mode = mode;
    await page.goto(root);
    if (mode === "empty")
      await expect(
        page.getByText("No dispute policy is effective at this check."),
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
  const f = await workDisputePolicyFixture(page, "ADMIN");
  await page.goto(root);
  await expect(page.locator(".dispute-current")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toHaveCount(0);
  expect(f.reads).toEqual([]);
  expect(f.contactReads).toEqual([]);
});

test("failed background grant refresh removes eligible contacts and blocks review", async ({
  page,
}) => {
  const f = await workDisputePolicyFixture(page);
  await page.goto(root);
  await fill(page);
  f.grantMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator('input[name="backupUserId"]')).toHaveValue("");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Primary contact", { exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
