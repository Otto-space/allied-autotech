import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workRefundTimingPolicyFixture,
  refundTimingPolicyRow,
  refundTimingSettings,
  id,
} from "../fixtures/work-refund-timing";
const root = "/admin/refund-timing";
const reviewButton = (page: Page) =>
  page.getByRole("button", { name: "Review refund timing", exact: true });
const approval = (page: Page) =>
  page.getByLabel("I confirm that these banking days and holiday dates are approved.", {
    exact: true,
  });
async function fill(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic owner calendar approval");
  await page
    .getByLabel("Written approval or reference", { exact: true })
    .fill("Synthetic written calendar approval for isolated verification.");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2048-01-05T08:30");
  await approval(page).check();
}
async function review(page: Page) {
  await fill(page);
  await reviewButton(page).click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve refund timing", exact: true })
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
  test(`refund calendar and full review at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workRefundTimingPolicyFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    await expect(
      page.getByRole("heading", { name: "Bank refund timing", exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(nav.locator("ol > li")).toHaveCount(2);
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Bank refund timing");
    await expect(page.locator(".refund-timing-current")).toContainText("Revision 2");
    await expect(
      page.locator(".refund-timing-next").first().locator(":scope > summary"),
    ).toContainText("5 Jan 2032");
    await page.getByLabel("Clock starts when", { exact: true }).focus();
    await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveCSS(
      "outline-width",
      "3px",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    await expect(page.getByRole("dialog")).toContainText("10 banking days");
    await page.keyboard.press("Escape");
    await expect(reviewButton(page)).toBeFocused();
    await expect(approval(page)).not.toBeChecked();
    expect(f.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
test("exact calendar approval normalizes holiday dates, retires draft and preserves current", async ({
  page,
}) => {
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await page
    .getByLabel("Excluded holiday dates")
    .fill("2027-12-25, 2027-01-01\n2027-12-25");
  await page
    .getByLabel("Clock starts when", { exact: true })
    .selectOption("TRANSFER_RECORDED");
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Bank refund timing approved", exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "BANK_REFUND_CLOCK",
    expectedVersion: 4,
    effectiveAt: "2048-01-05T07:30:00.000Z",
    settings: {
      ...refundTimingSettings,
      startEvent: "TRANSFER_RECORDED",
      holidays: ["2027-01-01", "2027-12-25"],
    },
  });
  await expect(page.locator(".refund-timing-current")).toContainText("Revision 2");
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
  await expect(approval(page)).not.toBeChecked();
});
test("calendar drafts survive reload without restored approval", async ({ page }) => {
  await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Clock starts when", { exact: true }).selectOption("REQUESTED");
  await page.getByLabel("Sunday", { exact: true }).check();
  await page.reload();
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue(
    "REQUESTED",
  );
  await expect(page.getByLabel("Sunday", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Written approval or reference")).toHaveValue(
    "Synthetic written calendar approval for isolated verification.",
  );
  await expect(approval(page)).not.toBeChecked();
});
test("refresh and newer revision retain unsent fields until explicit reload", async ({
  page,
}) => {
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  await page.getByLabel("Clock starts when", { exact: true }).selectOption("REQUESTED");
  f.history.unshift(refundTimingPolicyRow(5));
  await page.getByRole("button", { name: "Refresh refund timing", exact: true }).click();
  await expect(page.locator(".refund-timing-stale")).toBeVisible();
  await page.reload();
  await expect(page.locator(".refund-timing-stale")).toBeVisible();
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue(
    "REQUESTED",
  );
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue(
    "APPROVED",
  );
  expect(f.writes).toEqual([]);
});
test("empty policy has no invented calendar and supports explicit owner choices", async ({
  page,
}) => {
  const f = await workRefundTimingPolicyFixture(page);
  f.history = [];
  await page.goto(root);
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page
    .getByLabel("Clock starts when", { exact: true })
    .selectOption("TRANSFER_RECORDED");
  await page.getByLabel("Saturday", { exact: true }).check();
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Bank refund timing approved", exact: true }),
  ).toBeVisible();
  expect(f.writes[0]).toMatchObject({
    expectedVersion: 0,
    settings: { bankingDays: [6], holidays: [] },
  });
});
test("calendar validates banking days, real dates, trimmed evidence and future schedule", async ({
  page,
}) => {
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await page.getByLabel(day, { exact: true }).uncheck();
  await reviewButton(page).click();
  await expect(page.getByLabel("Sunday", { exact: true })).toBeFocused();
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Excluded holiday dates").fill("2026-02-30");
  await reviewButton(page).click();
  await expect(page.getByLabel("Excluded holiday dates")).toBeFocused();
  await page.getByLabel("Excluded holiday dates").fill("");
  await page.getByLabel("Written approval or reference").fill(" ".repeat(20));
  await reviewButton(page).click();
  await expect(page.getByLabel("Written approval or reference")).toBeFocused();
  await fill(page);
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2020-01-01T08:00");
  await reviewButton(page).click();
  await expect(
    page.getByLabel("Effective date and time", { exact: false }),
  ).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
test("session change redacts review and draft", async ({ page }) => {
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await review(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Written approval or reference")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
test("definitive rejection never retries automatically", async ({ page }) => {
  const f = await workRefundTimingPolicyFixture(page);
  f.reject = true;
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve refund timing", exact: true }),
  ).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(approval(page)).not.toBeChecked();
  expect(f.writes).toHaveLength(1);
});
test("customer cannot read owner calendar", async ({ page }) => {
  const f = await workRefundTimingPolicyFixture(page);
  f.base.role = "CUSTOMER";
  await page.goto(root);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(f.reads).toBe(0);
  expect(f.writes).toEqual([]);
});
test("maximum holiday calendar remains readable and excess dates cannot be approved", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1050 });
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  const dates = Array.from({ length: 367 }, (_, index) =>
    new Date(Date.UTC(2032, 0, index + 1)).toISOString().slice(0, 10),
  );
  await page.getByLabel("Excluded holiday dates").fill(dates.join("\n"));
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Excluded holiday dates")).toBeFocused();
  await page.getByLabel("Excluded holiday dates").fill(dates.slice(0, 366).join("\n"));
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toContainText(dates[365]!);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await axe(page);
  expect(f.writes).toEqual([]);
});
test("failed refresh preserves draft while approval stays disabled", async ({ page }) => {
  const f = await workRefundTimingPolicyFixture(page);
  await page.goto(root);
  await fill(page);
  f.fail = true;
  await page.getByRole("button", { name: "Refresh refund timing", exact: true }).click();
  await expect(
    page.getByText("The request could not be completed. Please try again shortly.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(reviewButton(page)).toBeDisabled();
  await expect(page.getByLabel("Written approval or reference")).toHaveValue(
    "Synthetic written calendar approval for isolated verification.",
  );
  f.fail = false;
  await page.getByRole("button", { name: "Refresh refund timing", exact: true }).click();
  await expect(reviewButton(page)).toBeEnabled();
  expect(f.writes).toEqual([]);
});
for (const changed of ["version", "identity"])
  test(`fresh ${changed} change blocks publication`, async ({ page }) => {
    const f = await workRefundTimingPolicyFixture(page);
    await page.goto(root);
    await review(page);
    if (changed === "version") f.history.unshift(refundTimingPolicyRow(5));
    else f.base.profileOwner = id(99);
    await confirm(page);
    if (changed === "identity") {
      await expect(
        page.getByText(
          "Bank refund timing requires an active, verified Super Admin account with MFA.",
          { exact: true },
        ),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("dialog")).toContainText(
        "This record has changed or is no longer available.",
      );
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Approve refund timing", exact: true }),
      ).toBeDisabled();
    }
    expect(f.writes).toEqual([]);
  });
for (const outcome of ["drop", "wrongActor"] as const)
  test(`${outcome} receipt stays locked after reload and reconciles without replay`, async ({
    page,
  }) => {
    const f = await workRefundTimingPolicyFixture(page);
    f[outcome] = true;
    await page.goto(root);
    await review(page);
    await confirm(page);
    await expect(page.getByRole("dialog")).toContainText("could not be confirmed");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Approval needs reconciliation", exact: true }),
    ).toBeVisible();
    await expect(reviewButton(page)).toBeDisabled();
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await page.getByLabel("I independently reconciled", { exact: false }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await expect(reviewButton(page)).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });
for (const mode of ["fail", "denied"] as const)
  test(`${mode} read is accessible and blocks actions`, async ({ page }) => {
    const f = await workRefundTimingPolicyFixture(page);
    f[mode] = true;
    await page.goto(root);
    await expect(
      page.getByText(
        mode === "denied"
          ? "Bank refund timing requires an active, verified Super Admin account with MFA."
          : "The request could not be completed. Please try again shortly.",
        { exact: true },
      ),
    ).toBeVisible();
    await axe(page);
    expect(f.writes).toEqual([]);
  });
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot approve bank refund timing`, async ({ page }) => {
    const f = await workRefundTimingPolicyFixture(page);
    f.base.role = role;
    await page.goto(root);
    await expect(
      page.getByText(
        "Bank refund timing requires an active, verified Super Admin account with MFA.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(reviewButton(page)).toHaveCount(0);
    expect(f.writes).toEqual([]);
  });
