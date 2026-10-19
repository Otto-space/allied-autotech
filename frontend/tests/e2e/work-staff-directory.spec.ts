import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workStaffDirectoryFixture, id } from "../fixtures/work-staff-directory";
const root = "/admin/staff";
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`staff directory responsive and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workStaffDirectoryFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    await expect(
      page.getByRole("link", { name: "View account for Ada Okoro" }).first(),
    ).toBeVisible();
    await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
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
test("cursor paging persists on reload and restores Previous and browser history", async ({
  page,
}) => {
  const f = await workStaffDirectoryFixture(page);
  await page.goto(root);
  await page
    .getByRole("navigation", { name: "Staff directory pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  expect(f.writes).toEqual([]);
});
test("search requires explicit submit, combines filters and clears cursor", async ({
  page,
}) => {
  const f = await workStaffDirectoryFixture(page);
  await page.goto(root);
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  const before = f.reads.length;
  await page.getByLabel("Search name or email").fill("team.01");
  expect(f.reads).toHaveLength(before);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 on this page", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("cursor")).toBe(false);
  await page.getByLabel("Account role", { exact: true }).selectOption("STAFF");
  await page.getByLabel("Account status", { exact: true }).selectOption("ACTIVE");
  await page.getByLabel("Branch", { exact: true }).selectOption(id(101));
  await expect.poll(() => f.reads.at(-1)?.searchParams.toString()).toContain("branchId=");
  await page.reload();
  await expect(page.getByLabel("Search name or email")).toHaveValue("team.01");
  await expect(page.getByText("1 on this page", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear staff filters" }).click();
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  expect(f.writes).toEqual([]);
});
for (const mode of ["error", "denied", "empty"])
  test(`${mode} state is accurate and accessible`, async ({ page }) => {
    const f = await workStaffDirectoryFixture(page);
    f.mode = mode;
    await page.goto(root);
    if (mode === "denied")
      await expect(page.getByText(/Protected records have been cleared/)).toBeVisible();
    else if (mode === "empty")
      await expect(
        page.getByRole("heading", { name: "No matching staff accounts" }),
      ).toBeVisible();
    else
      await expect(page.getByText("Staff accounts could not be loaded.")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("a failed refresh labels prior facts and disables paging; denial then clears account links", async ({
  page,
}) => {
  const f = await workStaffDirectoryFixture(page);
  await page.goto(root);
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh staff directory" }).click();
  await expect(page.getByText(/Previously loaded accounts are shown/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh staff directory" }).click();
  await expect(page.getByText(/Protected records have been cleared/)).toBeVisible();
  await expect(page.getByRole("link", { name: /View account for/ })).toHaveCount(0);
  await expect(
    page
      .locator(".work-staff-directory")
      .getByRole("link", { name: "Promotions & invitations", exact: true }),
  ).toHaveCount(0);
});
for (const mode of ["mismatch", "inactive", "denied"])
  test(`own-profile ${mode} blocks private directory requests`, async ({ page }) => {
    const f = await workStaffDirectoryFixture(page);
    f.base.profileMode = mode;
    await page.goto(root);
    await expect(
      page.getByRole("button", { name: "Refresh staff access" }),
    ).toBeVisible();
    expect(f.reads).toEqual([]);
  });
test("invalid URL and short query are explained without a directory request", async ({
  page,
}) => {
  const f = await workStaffDirectoryFixture(page);
  await page.goto(root + "?role=CUSTOMER");
  await expect(page.getByText(/unsupported or invalid filters/)).toBeVisible();
  expect(f.reads).toEqual([]);
  await page.getByRole("button", { name: "Clear staff filters" }).click();
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  const reads = f.reads.length;
  await page.getByLabel("Search name or email").fill("a");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByLabel("Search name or email")).toBeFocused();
  await expect(page.getByLabel("Search name or email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(f.reads).toHaveLength(reads);
});
test("long identity and branch wrap while null profile uses email and no branch fact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1050 });
  const f = await workStaffDirectoryFixture(page);
  f.rows[0].staffProfile!.firstName = "LongUnbrokenStaffIdentity".repeat(6);
  f.rows[0].staffProfile!.branch!.name = "LongBranchReference".repeat(7);
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: f.rows[0].staffProfile!.firstName + " Okoro" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.getByRole("heading", { name: "team.07@example.test" })).toBeVisible();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "team.07@example.test" }) }),
  ).toContainText("No branch assigned");
});
test("Staff role never requests administrator directory data", async ({ page }) => {
  const f = await workStaffDirectoryFixture(page, "STAFF");
  await page.goto(root);
  await expect(page.getByText(/Administrator access is required/)).toBeVisible();
  expect(f.reads).toEqual([]);
});

test("clear discards an unsubmitted search and valid keyboard search focuses results", async ({
  page,
}) => {
  await workStaffDirectoryFixture(page, "SUPER_ADMIN");
  await page.goto(root);
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  await page.getByLabel("Search name or email").fill("not submitted");
  await page.getByRole("button", { name: "Clear staff filters" }).click();
  await expect(page.getByLabel("Search name or email")).toHaveValue("");
  await page.getByLabel("Search name or email").fill("team.01");
  await page.getByLabel("Search name or email").press("Enter");
  await expect(page.getByText("1 on this page", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staff accounts" })).toBeFocused();
});
