import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workStaffDetailFixture } from "../fixtures/work-staff-detail";
import { staffRevision } from "@/lib/api/staff-admin-schemas";
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`staff account foundation at ${width}`, async ({ page }) => {
    const f = await workStaffDetailFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1050 });
    await page.goto(`/admin/staff/${f.member.id}`);
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb.locator('ol [aria-current="page"]')).toHaveText("Ada Okoro");
    await expect(
      page.getByRole("button", { name: "Review account change" }),
    ).toBeEnabled();
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
for (const mode of ["mismatch", "inactive", "denied"])
  test(`staff account blocks own identity ${mode}`, async ({ page }) => {
    const f = await workStaffDetailFixture(page);
    f.directory.base.profileMode = mode;
    await page.goto(`/admin/staff/${f.member.id}`);
    await expect(
      page.getByRole("button", { name: "Refresh staff access" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Review account change" })).toHaveCount(
      0,
    );
    expect(f.reads).toBe(0);
  });
test("staff account stale refresh disables changes and denied refresh clears identity", async ({
  page,
}) => {
  const f = await workStaffDetailFixture(page);
  await page.goto(`/admin/staff/${f.member.id}`);
  await expect(page.getByRole("button", { name: "Review account change" })).toBeEnabled();
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh staff account", exact: true }).click();
  await expect(page.getByText(/Previously loaded account details/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh staff account", exact: true }).click();
  await expect(page.getByText(/Protected records have been cleared/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ada Okoro", exact: true })).toHaveCount(
    0,
  );
  expect(f.writes).toEqual([]);
});
test("staff account rejects mismatched detail and safely wraps missing-profile identity", async ({
  page,
}) => {
  const f = await workStaffDetailFixture(page);
  f.mode = "mismatch";
  await page.setViewportSize({ width: 320, height: 1050 });
  await page.goto(`/admin/staff/${f.member.id}`);
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review account change" })).toHaveCount(
    0,
  );
  f.mode = "normal";
  f.member.staffProfile = null;
  f.member.email = "long-identity".repeat(7) + "@example.test";
  await page.getByRole("button", { name: "Refresh staff account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: f.member.email, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByText("Account reference", { exact: true }).click();
  await expect(
    page.getByText("No staff profile is recorded for this account."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Account change", { exact: true }).locator('option[value="branch"]'),
  ).toHaveCount(0);
});

test("unknown account change survives reload and needs fresh inspection plus independent reconciliation", async ({
  page,
}) => {
  const f = await workStaffDetailFixture(page),
    writes: unknown[] = [];
  await page.route(`**/api/v1/admin/staff/${f.member.id}/status`, async (r) => {
    writes.push(r.request().postDataJSON());
    await r.abort("failed");
  });
  await page.goto(`/admin/staff/${f.member.id}`);
  await page.getByLabel("New account status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Review account change", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByText(/The outcome could not be confirmed/)).toBeVisible();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("heading", { name: "Check the previous access change" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Finish reconciliation" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Check current access", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finish reconciliation" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I independently reconciled/ }).check();
  await page.getByRole("button", { name: "Finish reconciliation" }).click();
  await expect(page.getByRole("button", { name: "Review account change" })).toBeEnabled();
  expect(writes).toEqual([
    { status: "SUSPENDED", expectedRevision: staffRevision(f.member) },
  ]);
});

test("an uncertain capability result locks every access panel after reload", async ({
  page,
}) => {
  const f = await workStaffDetailFixture(page, "SUPER_ADMIN"),
    writes: unknown[] = [];
  await page.route("**/api/v1/admin/capabilities", async (r) => {
    writes.push(r.request().postDataJSON());
    await r.abort("failed");
  });
  await page.goto(`/admin/staff/${f.member.id}`);
  await page.getByLabel("Permission to grant").selectOption("BOOKING_CONFIRM");
  await page.getByRole("button", { name: "Review permission grant" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByText(/The outcome could not be confirmed/)).toBeVisible();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review permission grant" }),
  ).toBeDisabled();
  await page.getByText("Review legacy access and enroll", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Review enrollment" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh responsibility access" }).click();
  await expect(page.getByRole("button", { name: "Review enrollment" })).toBeDisabled();
  expect(writes).toHaveLength(1);
  const stored = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(([k]) => k.startsWith("aat:staff-change:v1:")),
  );
  expect(stored).toHaveLength(1);
  expect(Object.keys(JSON.parse(stored[0]![1])).sort()).toEqual(["area", "token"]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("unavailable recovery storage stops before any account mutation", async ({
  page,
}) => {
  const f = await workStaffDetailFixture(page);
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("aat:staff-change:v1:"))
        throw Error("Test blocked recovery storage");
      return set.call(this, k, v);
    };
  });
  await page.goto(`/admin/staff/${f.member.id}`);
  await page.getByLabel("New account status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Review account change" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
