import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workBranchesFixture, branchRow, id } from "../fixtures/work-branches";
import type { Page } from "@playwright/test";
async function selectBranch(page: Page) {
  await page.goto(`/admin/branches?branch=${id(290000)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Stadium Road workshop",
  );
}
async function confirm(page: Page, create = false) {
  await page
    .getByRole("button", {
      name: create ? "Review new branch" : "Review branch changes",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
}
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`branch workspace foundation at ${width}`, async ({ page }) => {
    const f = await workBranchesFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/admin/branches");
    await expect(
      page.getByRole("heading", { name: "Branches", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Stadium Road workshop", exact: true }),
    ).toBeVisible();
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
for (const width of [430, 1440])
  test(`selected branch editor and history at ${width}`, async ({ page }) => {
    const f = await workBranchesFixture(page);
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/admin/branches");
    await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
    const listReads = f.reads.filter((u) => u.pathname.endsWith("/branches")).length;
    await page
      .getByRole("button", { name: "Stadium Road workshop", exact: true })
      .click();
    await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
      "133 Stadium Road, beside Kilimanjaro",
    );
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Stadium Road workshop",
    );
    expect(f.reads.filter((u) => u.pathname.endsWith("/branches")).length).toBe(
      listReads,
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
    await page.reload();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Stadium Road workshop",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Stadium Road workshop",
    );
    expect(f.writes).toEqual([]);
  });
test("branch search retains input focus and composes with status and paging", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  f.rows = Array.from({ length: 28 }, (_, n) => ({
    ...branchRow(0),
    id: id(290000 + n),
    name: `Workshop ${n + 1}`,
  }));
  await page.goto("/admin/branches");
  const search = page.getByLabel("Search branches", { exact: true });
  await search.fill("Workshop");
  await expect(page).toHaveURL(/q=Workshop/);
  await expect(search).toBeFocused();
  await page.getByLabel("Branch status", { exact: true }).selectOption("true");
  await page
    .getByRole("navigation", { name: "Branches pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  await expect(search).toHaveValue("Workshop");
  await expect(page.getByLabel("Branch status", { exact: true })).toHaveValue("true");
  expect(f.writes).toEqual([]);
});
test("invalid branch query and stale own identity stop private reads", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  await page.goto("/admin/branches?isActive=invalid");
  await expect(
    page.getByRole("button", { name: "Clear branch filters", exact: true }),
  ).toBeVisible();
  expect(f.reads).toEqual([]);
  f.base.profileMode = "mismatch";
  await page.goto("/admin/branches");
  await expect(
    page.getByRole("button", { name: "Refresh branch access", exact: true }),
  ).toBeVisible();
  expect(f.reads).toEqual([]);
});

test("reviewed branch update preserves unchanged facts and clears optional contacts", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  await selectBranch(page);
  await page.getByLabel("Name", { exact: true }).fill("Stadium Road service centre");
  await page.getByLabel("Public phone (optional)", { exact: true }).fill("");
  await confirm(page);
  await expect(page.getByText("Branch changes saved.", { exact: true })).toBeVisible();
  expect(f.writes).toEqual([
    {
      method: "PATCH",
      path: `/api/v1/admin/branches/${id(290000)}`,
      body: {
        name: "Stadium Road service centre",
        phone: null,
        expectedRevision: branchRow().updatedAt,
      },
    },
  ]);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Stadium Road service centre",
  );
  await page.reload();
  await expect(page.getByLabel("Public phone (optional)", { exact: true })).toHaveValue(
    "",
  );
  expect(f.rows[0]!.address).toBe(branchRow().address);
});

test("new branch validates fields then saves the complete normalized contract", async ({
  page,
}) => {
  const f = await workBranchesFixture(page, "SUPER_ADMIN");
  await page.goto("/admin/branches?create=1");
  await page.getByRole("button", { name: "Review new branch", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(f.writes).toEqual([]);
  for (const [label, value] of Object.entries({
    "Branch code": "br-new",
    Name: "New workshop",
    "Street address": "Synthetic address",
    City: "Port Harcourt",
    State: "Rivers State",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await confirm(page, true);
  await expect(page.getByText("Branch created.", { exact: true })).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]!.body).toEqual({
    code: "BR-NEW",
    name: "New workshop",
    address: "Synthetic address",
    city: "Port Harcourt",
    state: "Rivers State",
    country: "Nigeria",
    timezone: "Africa/Lagos",
    phone: null,
    email: null,
    isActive: true,
  });
  await expect(page).toHaveURL(new RegExp(`branch=${id(290100)}`));
});

test("stale branch and changed actor prevent a write", async ({ page }) => {
  const f = await workBranchesFixture(page);
  await selectBranch(page);
  await page.getByLabel("Name", { exact: true }).fill("My retained draft");
  f.rows[0] = {
    ...f.rows[0]!,
    name: "Another administrator's edit",
    updatedAt: "2026-10-19T08:00:00.000Z",
  };
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("My retained draft");
  await page
    .getByRole("button", { name: "Load current branch details", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Another administrator's edit",
  );
  await page.getByLabel("Name", { exact: true }).fill("Next draft");
  f.base.profileMode = "mismatch";
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Refresh branch access", exact: true }),
  ).toBeVisible();
  expect(f.writes).toEqual([]);
});

test("rejected deactivation retains the draft without leaving an uncertain lock", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  f.mutationMode = "reject";
  await selectBranch(page);
  await page.getByLabel("Active branch", { exact: false }).uncheck();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Active branch", { exact: false })).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: "Check the previous branch change" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.rows[0]!.isActive).toBe(true);
});

for (const mode of ["lost", "malformed"])
  test(`${mode} branch response locks writes across reload until inspection and independent reconciliation`, async ({
    page,
  }) => {
    const f = await workBranchesFixture(page);
    f.mutationMode = mode;
    await selectBranch(page);
    await page.getByLabel("Name", { exact: true }).fill("Saved but unconfirmed");
    await confirm(page);
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the previous branch change" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review branch changes", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Check current branch information", exact: true })
      .click();
    const finish = page.getByRole("button", {
      name: "Finish reconciliation",
      exact: true,
    });
    await expect(finish).toBeDisabled();
    await page
      .getByLabel(
        "I independently reconciled the previous change and am ready to review a new action.",
        { exact: true },
      )
      .check();
    await finish.click();
    await expect(
      page.getByRole("heading", { name: "Check the previous branch change" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Saved but unconfirmed",
    );
    expect(f.writes).toHaveLength(1);
  });

test("unavailable recovery storage prevents branch submission", async ({ page }) => {
  const f = await workBranchesFixture(page);
  await selectBranch(page);
  await page.getByLabel("Name", { exact: true }).fill("Cannot be sent");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:branch-change:")) throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});

test("lost creation inspects its exact public code after reload without replaying creation", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  f.mutationMode = "lost";
  await page.goto("/admin/branches?create=1");
  for (const [label, value] of Object.entries({
    "Branch code": "br-new",
    Name: "Recovery workshop",
    "Street address": "Synthetic address",
    City: "Port Harcourt",
    State: "Rivers State",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await confirm(page, true);
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Check current branch information", exact: true })
    .click();
  await expect(
    page.getByText(
      "A branch with code BR-NEW is currently recorded. Independently confirm the original request.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(f.reads.some((url) => url.searchParams.get("code") === "BR-NEW")).toBe(true);
  await expect(
    page.getByRole("button", { name: "Review new branch", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toHaveLength(1);
});

test("temporary list failures can be retried and denied branch records are cleared", async ({
  page,
}) => {
  const f = await workBranchesFixture(page);
  await page.goto("/admin/branches");
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh branches", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh branches", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Stadium Road workshop", exact: true }),
  ).toHaveCount(0);
  f.mode = "normal";
  await page.getByRole("button", { name: "Refresh branches", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stadium Road workshop", exact: true }),
  ).toBeEnabled();
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh branches", exact: true }).click();
  await expect(
    page.getByText("Branch access is unavailable. Protected records have been cleared.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".wb-row")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
