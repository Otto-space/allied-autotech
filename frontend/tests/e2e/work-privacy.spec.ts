import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workPrivacyFixture,
  privacyRow,
  bookingId as id,
} from "../fixtures/work-privacy";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  rows = (p: Page) => p.locator(".wpr-record"),
  save = (p: Page, name = "Save privacy review") =>
    p.getByRole("dialog").getByRole("button", { name, exact: true });
async function open(p: Page) {
  await p.goto("/admin/privacy");
  await expect(rows(p)).toHaveCount(3);
}
async function select(p: Page) {
  await rows(p)
    .first()
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await expect(p).toHaveURL(/request=/);
  await expect(p.getByLabel("Response visible to the customer")).toBeVisible();
  await expect(p.getByLabel("Protected records")).toBeVisible();
}
async function review(p: Page) {
  await p.getByLabel("New request status").selectOption("UNDER_REVIEW");
  await p
    .getByLabel("Response visible to the customer")
    .fill("Exact reviewed customer response\nWith the full second line");
  await btn(p, "Review response").click();
  await expect(p.getByRole("dialog")).toContainText("Exact reviewed customer response");
}
async function hold(p: Page) {
  await p.getByLabel("Protected records").selectOption("ALL");
  await p
    .getByLabel("Reason for protection")
    .fill("Exact private protection reason for the selected account");
  await btn(p, "Review new hold").click();
  await expect(p.getByRole("dialog")).toContainText("Exact private protection reason");
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} granted reviewer reads complete facts and opens scoped workspace`, async ({
    page,
  }) => {
    await workPrivacyFixture(page, role);
    await open(page);
    await expect(rows(page).first()).toContainText(id(96000));
    await expect(rows(page).first()).toContainText(id(97000));
    await expect(rows(page).first()).toContainText("09:00:59.123");
    await select(page);
    await expect(page.getByText(/Latest 100 holds/)).toBeVisible();
    await expect(page.getByText(/Approval does not delete/)).toBeVisible();
  });
  test(`${role} without explicit grant never reads private requests`, async ({
    page,
  }) => {
    const f = await workPrivacyFixture(page, role);
    f.privacy.granted = false;
    await page.goto("/admin/privacy");
    await expect(page.getByText(/Privacy review requires an active/)).toBeVisible();
    expect(f.privacy.reads).toHaveLength(0);
    expect(f.privacy.holdReads).toHaveLength(0);
  });
}
for (const mode of ["mismatch", "inactive"])
  test(`${mode} own identity blocks private reads`, async ({ page }) => {
    const f = await workPrivacyFixture(page);
    f.privacy.profileMode = mode;
    await page.goto("/admin/privacy");
    await expect(page.getByText(/Privacy review requires an active/)).toBeVisible();
    expect(f.privacy.reads).toHaveLength(0);
  });
test("held profile gate sends no premature private request and recovers", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  f.privacy.profileMode = "hold";
  await page.goto("/admin/privacy");
  await expect(
    page.getByText("Checking your privacy review permission…", { exact: true }),
  ).toBeVisible();
  expect(f.privacy.reads).toHaveLength(0);
  f.privacy.profileMode = "error";
  f.privacy.heldProfile?.();
  await expect(btn(page, "Refresh privacy permission")).toBeEnabled();
  f.privacy.profileMode = "normal";
  await btn(page, "Refresh privacy permission").click();
  await expect(rows(page)).toHaveCount(3);
});
test("25+3 pages, selected review and exact filters persist through reload and Back", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  f.privacy.records = Array.from({ length: 28 }, (_, n) => privacyRow(n));
  await page.goto("/admin/privacy");
  await expect(rows(page)).toHaveCount(25);
  const nav = page.getByRole("navigation", { name: "Privacy requests pages" });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(rows(page)).toHaveCount(3);
  await page.reload();
  await expect(rows(page)).toHaveCount(3);
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(page).toHaveURL(/cursor=/);
  await expect(rows(page)).toHaveCount(3);
  await nav.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(rows(page)).toHaveCount(25);
  await page.getByLabel("Request type", { exact: true }).selectOption("DELETION");
  await page.getByLabel("Review status", { exact: true }).selectOption("REQUESTED");
  await page.getByLabel("Account reference", { exact: true }).fill(id(97000));
  await btn(page, "Apply privacy filters").click();
  await expect(page).toHaveURL(/userId=/);
  await expect(rows(page)).toHaveCount(1);
  await rows(page)
    .first()
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await expect(page).toHaveURL(/request=/);
  await page.reload();
  await expect(page.getByLabel("Response visible to the customer")).toBeVisible();
  await expect(page.getByLabel("Account reference", { exact: true })).toHaveValue(
    id(97000),
  );
  expect(f.privacy.reads.at(-1)?.searchParams.get("userId")).toBe(id(97000));
});
for (const q of ["?status=bad", "?cursor=bad", "?search=private"])
  test(`invalid link ${q} sends no private queue read`, async ({ page }) => {
    const f = await workPrivacyFixture(page);
    await page.goto("/admin/privacy" + q);
    await expect(
      page.getByRole("heading", { name: "Privacy filters unavailable" }),
    ).toBeVisible();
    expect(f.privacy.reads).toHaveLength(0);
    await btn(page, "Reset privacy filters").click();
    await expect(rows(page)).toHaveCount(3);
  });
test("cancel sends nothing; held exact review disables all writes and saves once", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  await review(page);
  await btn(page, "Go back").click();
  expect(f.privacy.writes).toHaveLength(0);
  await btn(page, "Review response").click();
  f.privacy.writeMode = "hold";
  await save(page).click();
  await expect.poll(() => f.privacy.writes.length).toBe(1);
  await expect(btn(page, "Review new hold")).toBeDisabled();
  f.privacy.writeMode = "normal";
  f.privacy.heldWrite?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rows(page).first().locator(".wpr-saved-response")).toContainText(
    "Exact reviewed customer response",
  );
  expect(f.privacy.writes[0].body).toEqual({
    status: "UNDER_REVIEW",
    note: "Exact reviewed customer response\nWith the full second line",
    expectedReviewedAt: null,
  });
  await expect(page.getByLabel("Response visible to the customer")).toHaveValue("");
});
test("hold creation, guarded approval and audited release retain independent forms", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  await hold(page);
  await save(page, "Confirm hold change").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "All records · Active hold" }),
  ).toBeVisible();
  await expect(page.getByLabel("Reason for protection")).toHaveValue("");
  await page.getByLabel("New request status").selectOption("APPROVED_PENDING_POLICY");
  await page
    .getByLabel("Response visible to the customer")
    .fill("Exact proposed approval response with existing protection");
  await btn(page, "Review response").click();
  await save(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await btn(page, "Go back").click();
  await page
    .getByLabel("Release justification")
    .fill("Exact documented protection clearance for the selected account");
  await btn(page, "Review hold release").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Exact documented protection clearance",
  );
  await save(page, "Confirm hold change").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "All records · Released" }),
  ).toBeVisible();
  await expect(page.getByLabel("Response visible to the customer")).toHaveValue(
    "Exact proposed approval response with existing protection",
  );
  expect(f.privacy.writes).toHaveLength(3);
});
test("concurrent review preserves the old draft until explicit response-field reload", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  await page
    .getByLabel("Response visible to the customer")
    .fill("Preserved unsaved response");
  Object.assign(f.privacy.records[0], {
    status: "UNDER_REVIEW",
    reviewedAt: "2026-10-18T10:00:37.123Z",
    reviewNote: "Other reviewer response",
  });
  await btn(page, "Refresh privacy requests").click();
  await expect(btn(page, "Reload response fields")).toBeVisible();
  await expect(page.getByLabel("Response visible to the customer")).toHaveValue(
    "Preserved unsaved response",
  );
  await expect(btn(page, "Review response")).toBeDisabled();
  await btn(page, "Reload response fields").click();
  await expect(page.getByLabel("Response visible to the customer")).toHaveValue("");
  expect(f.privacy.writes).toHaveLength(0);
});
test("fresh permission revocation blocks reviewed changes without sending", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  await review(page);
  f.privacy.granted = false;
  await save(page).click();
  await expect(page.getByText(/Privacy review requires an active/)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  expect(f.privacy.writes).toHaveLength(0);
});
for (const [operation, mode] of [
  ["review", "lost"],
  ["hold", "lost"],
  ["release", "lost"],
  ["review", "malformed"],
  ["review", "wrong-account"],
  ["review", "throttle"],
])
  test(`${operation} ${mode} stays locked through reload and reconciles without replay`, async ({
    page,
  }) => {
    const f = await workPrivacyFixture(page);
    if (operation === "release")
      f.privacy.holds = [
        {
          id: id(98000),
          userId: id(97000),
          recordType: "ALL",
          recordId: null,
          reason: "Synthetic existing account protection",
          createdAt: "2026-10-18T09:00:00.123Z",
          releasedAt: null,
        },
      ];
    f.privacy.writeMode = mode;
    await open(page);
    await select(page);
    if (operation === "review") await review(page);
    else if (operation === "hold") await hold(page);
    else {
      await page
        .getByLabel("Release justification")
        .fill("Exact release explanation for interrupted response");
      await btn(page, "Review hold release").click();
    }
    await save(
      page,
      operation === "review" ? "Save privacy review" : "Confirm hold change",
    ).click();
    await btn(page, "Close & review record").click();
    await expect(btn(page, "Load current privacy records")).toBeVisible();
    await expect(btn(page, "Review response")).toBeDisabled();
    const markers = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:privacy-review:v1:"),
      ),
    );
    expect(markers).toHaveLength(1);
    expect(markers[0][1]).not.toContain("Exact");
    await page.reload();
    await expect(btn(page, "Load current privacy records")).toBeVisible();
    await btn(page, "Load current privacy records").click();
    await expect(btn(page, "Load current privacy records")).toHaveCount(0);
    await expect(
      page.getByText(/Current privacy requests and applicable account holds loaded/),
    ).toContainText("previous request outcome is not proven");
    expect(f.privacy.writes).toHaveLength(1);
    await expect(page.getByLabel("Response visible to the customer")).toHaveValue("");
  });
test("definite rejection keeps draft without an uncertainty marker", async ({ page }) => {
  const f = await workPrivacyFixture(page);
  f.privacy.writeMode = "reject";
  await open(page);
  await select(page);
  await review(page);
  await save(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(btn(page, "Load current privacy records")).toHaveCount(0);
  await expect(page.getByLabel("Response visible to the customer")).toHaveValue(
    "Exact reviewed customer response\nWith the full second line",
  );
});
test("temporary queue failure keeps labelled facts read-only; denial clears records", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  f.privacy.mode = "error";
  await btn(page, "Refresh privacy requests").click();
  await expect(btn(page, "Retry privacy requests")).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(btn(page, "Review response")).toBeDisabled();
  f.privacy.mode = "denied";
  await btn(page, "Retry privacy requests").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByLabel("Response visible to the customer")).toHaveCount(0);
});
test("denied account protection clears all private requests", async ({ page }) => {
  const f = await workPrivacyFixture(page);
  await open(page);
  await select(page);
  f.privacy.holdsMode = "denied";
  await btn(page, "Refresh retention holds").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByLabel("Response visible to the customer")).toHaveCount(0);
});
test("seven responsive widths, full long explanation and review pass accessibility", async ({
  page,
}) => {
  const f = await workPrivacyFixture(page);
  f.privacy.records[0].reason = "R".repeat(2000);
  await open(page);
  await select(page);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await review(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
