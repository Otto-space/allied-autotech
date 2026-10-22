import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workStaffInvitationsFixture,
  invitationRow,
  id,
} from "../fixtures/work-staff-invitations";
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`invitation workspace foundation at ${width}`, async ({ page }) => {
    const f = await workStaffInvitationsFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/admin/staff/invite");
    await expect(
      page.getByRole("heading", { name: "Promotions & invitations", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("4 on this page", { exact: true })).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb.locator('ol [aria-current="page"]')).toHaveText(
      "Promotions & invitations",
    );
    await expect(page.locator('.wsi-row input[type="password"]:visible')).toHaveCount(0);
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
  test(`invitation private reads require current identity: ${mode}`, async ({ page }) => {
    const f = await workStaffInvitationsFixture(page);
    f.base.profileMode = mode;
    await page.goto("/admin/staff/invite");
    await expect(page.getByRole("button", { name: "Refresh team access" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search account" })).toHaveCount(0);
    expect(f.reads).toEqual([]);
  });
test("selected candidate has named facts and password clears and re-hides before review", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  f.candidateRole = "STAFF";
  await page.goto("/admin/staff/invite");
  await page.getByLabel("Account email", { exact: true }).fill("ada.okoro@example.test");
  await page.getByRole("button", { name: "Search account" }).click();
  await expect(
    page.getByRole("heading", { name: "Ada Okoro", exact: true }),
  ).toBeVisible();
  const password = page.getByLabel("Your current password", { exact: true });
  await password.fill("synthetic password proof");
  const form = page.locator(".wsi-proof");
  await expect(password).toHaveAttribute("type", "password");
  await form.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveValue("synthetic password proof");
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Review administrator invitation" }).click();
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("dialog")).not.toContainText("synthetic password proof");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(f.writes).toEqual([]);
});
test("revocation proof is disclosed per invitation and clears before review", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  await page.goto("/admin/staff/invite");
  const row = page.locator(".wsi-row").filter({
    has: page.getByRole("heading", { name: "ada.okoro@example.test", exact: true }),
  });
  await row.getByText("Revoke invitation", { exact: true }).click();
  const password = row.getByLabel(
    "Your current password to revoke ada.okoro@example.test",
    { exact: true },
  );
  await password.fill("synthetic revocation proof");
  await row.getByRole("button", { name: "Show password", exact: true }).click();
  await row.getByRole("button", { name: "Review revocation", exact: true }).click();
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("dialog")).not.toContainText("synthetic revocation proof");
  expect(f.writes).toEqual([]);
});

test("invitation status and cursor history survive reload and browser Back", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  f.rows = Array.from({ length: 28 }, (_, n) => ({
    ...invitationRow(),
    id: id(260000 + n),
    email: `recipient-${n}@example.test`,
  }));
  await page.goto("/admin/staff/invite");
  await page.getByLabel("Invitation status filter").selectOption("PENDING");
  await expect(page).toHaveURL(/status=PENDING/);
  await page
    .getByRole("navigation", { name: "Invitations pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/cursor=/);
  await page.reload();
  await expect(page.getByText("3 on this page", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Invitation status filter")).toHaveValue("PENDING");
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("25 on this page", { exact: true })).toBeVisible();
  expect(f.writes).toEqual([]);
});

test("invalid filters do not fetch invitations and can be cleared", async ({ page }) => {
  const f = await workStaffInvitationsFixture(page);
  await page.goto("/admin/staff/invite?status=ACTIVE");
  await expect(
    page.getByRole("button", { name: "Clear invitation filters" }),
  ).toBeVisible();
  expect(f.reads.filter((url) => url.pathname.endsWith("/invitations"))).toEqual([]);
  await page.getByRole("button", { name: "Clear invitation filters" }).click();
  await expect(page.getByText("4 on this page", { exact: true })).toBeVisible();
});

test("a foreign invitation cannot be rendered as an administrator's record", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  f.rows[0]!.invitedById = id(999);
  await page.goto("/admin/staff/invite");
  await expect(
    page.getByText("We could not read this information. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".wsi-row")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});

for (const mode of ["lost", "malformed"])
  test(`an invitation with ${mode} response stays locked across reload and requires reconciliation`, async ({
    page,
  }) => {
    const f = await workStaffInvitationsFixture(page);
    f.candidateRole = "STAFF";
    f.writeMode = mode;
    await page.goto("/admin/staff/invite");
    await page
      .getByLabel("Account email", { exact: true })
      .fill("ada.okoro@example.test");
    await page.getByRole("button", { name: "Search account", exact: true }).click();
    await page
      .getByLabel("Your current password", { exact: true })
      .fill("synthetic password proof");
    await page.getByRole("button", { name: "Review administrator invitation" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Close & review record" }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(1);
    const stored = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:invitation-change:"),
      ),
    );
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain("synthetic password proof");
    expect(JSON.stringify(stored)).not.toContain("ada.okoro");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the previous access change" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Search account", exact: true }),
    ).toBeDisabled();
    expect(f.writes).toHaveLength(1);
    await page.getByLabel("Affected account email").fill("ada.okoro@example.test");
    await page.getByRole("button", { name: "Check current access", exact: true }).click();
    await expect(
      page.getByText("Current account role: Staff.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finish reconciliation" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: "I independently reconciled" }).check();
    await page.getByRole("button", { name: "Finish reconciliation" }).click();
    await expect(
      page.getByRole("button", { name: "Search account", exact: true }),
    ).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });

test("changed candidate eligibility and changed actor both stop the write before submission", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  f.candidateRole = "STAFF";
  await page.goto("/admin/staff/invite");
  await page.getByLabel("Account email", { exact: true }).fill("ada.okoro@example.test");
  await page.getByRole("button", { name: "Search account", exact: true }).click();
  await page
    .getByLabel("Your current password", { exact: true })
    .fill("synthetic password proof");
  await page.getByRole("button", { name: "Review administrator invitation" }).click();
  f.candidateMode = "empty";
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(
    page.getByText("This record has changed. Refresh it and review the latest details.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.writes).toEqual([]);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  f.candidateMode = "normal";
  await page.getByRole("button", { name: "Search account", exact: true }).click();
  await page
    .getByLabel("Your current password", { exact: true })
    .fill("synthetic password proof");
  await page.getByRole("button", { name: "Review administrator invitation" }).click();
  f.base.profileMode = "mismatch";
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Refresh team access" })).toBeVisible();
  expect(f.writes).toEqual([]);
});

test("temporary list failures can be retried and denied list records are cleared", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  await page.goto("/admin/staff/invite");
  await expect(page.getByText("4 on this page", { exact: true })).toBeVisible();
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh invitations", exact: true }).click();
  await expect(page.locator(".wsi-row")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refresh invitations", exact: true }),
  ).toBeEnabled();
  f.mode = "normal";
  await page.getByRole("button", { name: "Refresh invitations", exact: true }).click();
  await expect(page.getByText("4 on this page", { exact: true })).toBeVisible();
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh invitations", exact: true }).click();
  await expect(
    page.getByText(
      "Invitation access is unavailable. Protected records have been cleared.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".wsi-row")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});

test("failed account lookup permits a corrected exact-email search", async ({ page }) => {
  const f = await workStaffInvitationsFixture(page);
  f.candidateMode = "error";
  await page.goto("/admin/staff/invite");
  await page
    .getByLabel("Account email", { exact: true })
    .fill("unavailable@example.test");
  await page.getByRole("button", { name: "Search account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry account search" })).toBeVisible();
  f.candidateMode = "normal";
  f.candidateRole = "STAFF";
  await page.getByLabel("Account email", { exact: true }).fill("ada.okoro@example.test");
  await page.getByRole("button", { name: "Search account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ada Okoro", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(f.writes).toEqual([]);
});

test("unavailable recovery storage prevents a mutation before it is sent", async ({
  page,
}) => {
  const f = await workStaffInvitationsFixture(page);
  f.candidateRole = "STAFF";
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:invitation-change:"))
        throw Error("Synthetic storage failure");
      return original.call(this, key, value);
    };
  });
  await page.goto("/admin/staff/invite");
  await page.getByLabel("Account email", { exact: true }).fill("ada.okoro@example.test");
  await page.getByRole("button", { name: "Search account", exact: true }).click();
  await page
    .getByLabel("Your current password", { exact: true })
    .fill("synthetic password proof");
  await page.getByRole("button", { name: "Review administrator invitation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeEnabled();
  expect(f.writes).toEqual([]);
});
