import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workAuditFixture, auditRow, id } from "../fixtures/work-audit";
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`audit history and expanded inspection at ${width}`, async ({ page }) => {
    const f = await workAuditFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/admin/audit");
    await expect(page.getByText("3 on this page", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Update · Branch", exact: true }),
    ).toBeVisible();
    const reads = f.reads.length;
    await page
      .locator(".wa-event")
      .first()
      .getByText("Event details", { exact: true })
      .click();
    await page
      .locator(".wa-event")
      .first()
      .getByText("Recorded values", { exact: true })
      .click();
    await expect(page.getByRole("region", { name: "After", exact: true })).toContainText(
      '"active": true',
    );
    expect(f.reads).toHaveLength(reads);
    for (const advanced of [false, true]) {
      if (advanced)
        await page.getByText("Reference and date filters", { exact: true }).click();
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
    expect(errors).toEqual([]);
    expect(f.writes).toEqual([]);
  });
test("private filters and cursor pages preserve exact submitted scope without URL references", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = Array.from({ length: 28 }, (_, n) => ({
    ...auditRow(n),
    action: "UPDATE",
    entityType: "BRANCH",
    userId: id(302),
    user: { role: "ADMIN" },
  }));
  await page.goto("/admin/audit");
  await expect(page.getByText("25 on this page", { exact: false })).toBeVisible();
  await page.getByText("Reference and date filters", { exact: true }).click();
  await page.getByLabel("Action", { exact: true }).selectOption("UPDATE");
  await page.getByLabel("Record type", { exact: true }).selectOption("BRANCH");
  await page.getByLabel("User reference (optional)").fill(id(302));
  await page.getByLabel("From date and time (Lagos)").fill("2026-10-19T09:00");
  await page.getByRole("button", { name: "Apply audit filters", exact: true }).click();
  await expect(page.getByText("Filtered view", { exact: false })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Audit log pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("3 on this page", { exact: false })).toBeVisible();
  expect(Object.fromEntries(f.reads.at(-1)!.searchParams)).toEqual({
    limit: "25",
    action: "UPDATE",
    entityType: "BRANCH",
    userId: id(302),
    from: "2026-10-19T09:00:00+01:00",
    cursor: id(300024),
  });
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("25 on this page", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Clear audit filters", exact: true }).click();
  await expect(page.getByLabel("User reference (optional)")).toHaveValue("");
  expect(f.writes).toEqual([]);
});
test("invalid hidden reference expands and focuses before making another request", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  await page.goto("/admin/audit");
  await expect(page.getByText("3 on this page", { exact: false })).toBeVisible();
  await page.getByText("Reference and date filters", { exact: true }).click();
  await page.getByLabel("User reference (optional)").fill("invalid");
  await page.getByText("Reference and date filters", { exact: true }).click();
  const reads = f.reads.length;
  await page.getByRole("button", { name: "Apply audit filters", exact: true }).click();
  await expect(page.getByLabel("User reference (optional)")).toBeFocused();
  await expect(page.getByLabel("User reference (optional)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(f.reads).toHaveLength(reads);
});
test("identity mismatch prevents reads and denied refresh clears expanded events", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.base.profileMode = "mismatch";
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("button", { name: "Refresh audit access", exact: true }),
  ).toBeVisible();
  expect(f.reads).toEqual([]);
  f.base.profileMode = "normal";
  await page.getByRole("button", { name: "Refresh audit access", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(3);
  await page
    .locator(".wa-event")
    .first()
    .getByText("Event details", { exact: true })
    .click();
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh audit log", exact: true }).click();
  await expect(
    page.getByText("Audit access is unavailable. Protected records have been cleared.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".wa-event")).toHaveCount(0);
});
