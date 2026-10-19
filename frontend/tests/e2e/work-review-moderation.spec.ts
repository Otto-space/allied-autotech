import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workModerationFixture,
  moderationRow,
  bookingId as id,
} from "../fixtures/work-review-moderation";
import { reviewTargets, reviewLabels } from "@/lib/api/review-schemas";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  rows = (p: Page) => p.locator(".wm-reviews>.wm-review"),
  confirm = (p: Page) =>
    p.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function open(p: Page) {
  await p.goto("/admin/reviews");
  await expect(rows(p)).toHaveCount(3);
}
async function select(p: Page) {
  await rows(p)
    .first()
    .getByRole("button", { name: "Review decision", exact: true })
    .click();
  await expect(p).toHaveURL(/selected=/);
  await expect(p.getByLabel("Decision", { exact: true })).toBeVisible();
}
async function review(
  p: Page,
  decision = "REJECTED",
  note = "Exact reviewed customer-visible note\nThe full second line",
) {
  await p.getByLabel("Decision", { exact: true }).selectOption(decision);
  await p.getByLabel("Customer-visible moderation note", { exact: true }).fill(note);
  await btn(p, "Review moderation decision").click();
  await expect(p.getByRole("dialog")).toContainText("Careful diagnosis and clear advice");
  await expect(p.getByRole("dialog")).toContainText("The team explained the diagnosis");
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads complete moderated facts and one deliberate decision form`, async ({
    page,
  }) => {
    await workModerationFixture(page, role);
    await open(page);
    await expect(rows(page).first()).toContainText(id(110000));
    await expect(rows(page).first()).toContainText("Amina Okafor");
    await expect(rows(page).first()).toContainText("09:00:00.123");
    await expect(page.getByLabel("Decision", { exact: true })).toHaveCount(0);
    await select(page);
    await expect(page.getByLabel("Decision", { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).locator("ol"),
    ).toHaveCount(1);
  });
test("ordinary Staff never reads or moderates the administrator queue", async ({
  page,
}) => {
  const f = await workModerationFixture(page, "STAFF");
  await page.goto("/admin/reviews");
  await expect(
    page.getByText("Administrator access is required to moderate reviews.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.moderation.reads).toHaveLength(0);
  expect(f.moderation.directReads).toHaveLength(0);
  expect(f.moderation.writes).toHaveLength(0);
});
test("Customer access redirects without private moderation reads", async ({ page }) => {
  const f = await workModerationFixture(page, "CUSTOMER");
  await page.goto("/admin/reviews");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  expect(f.moderation.reads).toHaveLength(0);
});
for (const mode of ["mismatch", "inactive", "error"])
  test(`${mode} current administrator profile blocks private reads`, async ({ page }) => {
    const f = await workModerationFixture(page);
    f.moderation.profileMode = mode;
    await page.goto("/admin/reviews");
    await expect(page.locator(".work-moderation").getByRole("alert")).toBeVisible();
    expect(f.moderation.reads).toHaveLength(0);
  });
test("held profile prevents premature reads and recovers explicitly", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.profileMode = "hold";
  await page.goto("/admin/reviews");
  await expect(
    page.getByText("Checking moderation access…", { exact: true }),
  ).toBeVisible();
  expect(f.moderation.reads).toHaveLength(0);
  f.moderation.profileMode = "error";
  f.moderation.heldProfile?.();
  await expect(btn(page, "Refresh moderation access")).toBeEnabled();
  f.moderation.profileMode = "normal";
  await btn(page, "Refresh moderation access").click();
  await expect(rows(page)).toHaveCount(3);
});
test("25+3 pages, filters and selected decision survive reload and Back", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.records = Array.from({ length: 28 }, (_, n) => moderationRow(n));
  await page.goto("/admin/reviews");
  await expect(rows(page)).toHaveCount(25);
  const nav = page.getByRole("navigation", { name: "Moderation pages" });
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
  await page.getByLabel("Review reference", { exact: true }).fill(id(110027));
  await page.getByLabel("Review type", { exact: true }).selectOption("BUSINESS");
  await btn(page, "Apply moderation filters").click();
  await expect(page).toHaveURL(/reviewId=/);
  await expect(rows(page)).toHaveCount(1);
  await select(page);
  await page.reload();
  await expect(page.getByLabel("Decision", { exact: true })).toBeVisible();
  expect(f.moderation.reads.at(-1)?.searchParams.get("reviewId")).toBe(id(110027));
});
for (const target of reviewTargets)
  test(`${target} preserves real complete source facts and links`, async ({ page }) => {
    const f = await workModerationFixture(page);
    f.moderation.records = [moderationRow(0, target)];
    await page.goto("/admin/reviews");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(reviewLabels[target]);
    if (target === "BUSINESS")
      await expect(rows(page)).toContainText(
        "Overall experience has no linked purchase reference.",
      );
    if (target === "PRODUCT") {
      await expect(
        rows(page).getByRole("link", { name: "Brake pads", exact: true }),
      ).toHaveAttribute("href", `/admin/products/${id(120000)}`);
      await expect(rows(page)).toContainText(id(130000));
      await expect(
        rows(page).getByRole("link", { name: id(140000), exact: true }),
      ).toHaveAttribute("href", `/admin/orders/${id(140000)}`);
    }
    if (target === "SERVICE") {
      await expect(rows(page)).toContainText("Engine diagnostics");
      await expect(rows(page)).toContainText("09:00:37.123");
      await expect(
        rows(page).getByRole("link", { name: id(160000), exact: true }),
      ).toHaveAttribute("href", `/admin/bookings/${id(160000)}`);
    }
    if (target === "ORDER") await expect(rows(page)).toContainText("SYNTHETIC-ORDER");
    if (target === "VEHICLE_TRANSACTION")
      await expect(rows(page)).toContainText("SYNTHETIC-SALE");
  });
for (const q of ["?status=bad", "?cursor=bad", "?search=feedback"])
  test(`invalid query ${q} sends no queue read`, async ({ page }) => {
    const f = await workModerationFixture(page);
    await page.goto("/admin/reviews" + q);
    await expect(
      page.getByRole("heading", { name: "Moderation filters unavailable" }),
    ).toBeVisible();
    expect(f.moderation.reads).toHaveLength(0);
    await btn(page, "Reset moderation filters").click();
    await expect(rows(page)).toHaveCount(3);
  });
test("rejection requires note; full review cancellation restores focus without another GET", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  await open(page);
  await select(page);
  await page.getByLabel("Decision", { exact: true }).selectOption("REJECTED");
  await btn(page, "Review moderation decision").click();
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toBeFocused();
  await review(page);
  await expect(page.getByRole("dialog")).toContainText(
    "Exact reviewed customer-visible note",
  );
  const before = f.moderation.reads.length;
  await btn(page, "Go back").click();
  await expect(btn(page, "Review moderation decision")).toBeFocused();
  expect(f.moderation.reads).toHaveLength(before);
  expect(f.moderation.directReads).toHaveLength(0);
  expect(f.moderation.writes).toHaveLength(0);
  await btn(page, "Review moderation decision").click();
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".wm-saved")).toContainText(
    "Exact reviewed customer-visible note",
  );
  expect(f.moderation.writes[0].body).toEqual({
    expectedVersion: 0,
    decision: "REJECTED",
    note: "Exact reviewed customer-visible note\nThe full second line",
  });
});
test("held approval is single-flight and explicitly clears an omitted old note", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.records[0].moderationNote = "Old note must not be reused";
  await open(page);
  await select(page);
  await review(page, "APPROVED", "");
  f.moderation.writeMode = "hold";
  await confirm(page).click();
  await expect.poll(() => f.moderation.writes.length).toBe(1);
  await expect(btn(page, "Submitting…")).toBeDisabled();
  f.moderation.writeMode = "normal";
  f.moderation.heldWrite?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".wm-saved")).toContainText("No note recorded");
  expect(f.moderation.writes[0].body).toEqual({
    expectedVersion: 0,
    decision: "APPROVED",
  });
  expect(f.moderation.records[0].moderationNote).toBeNull();
  const drafts = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(
      ([key]) =>
        key.startsWith("aat:form-draft:v1:") && key.includes("review-moderation-form"),
    ),
  );
  expect(drafts).toHaveLength(0);
});
test("external version preserves the draft until explicit moderation field reload", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  await open(page);
  await select(page);
  await page
    .getByLabel("Customer-visible moderation note", { exact: true })
    .fill("Preserved moderation draft");
  f.moderation.records[0].version++;
  await btn(page, "Refresh moderation queue").click();
  await expect(btn(page, "Reload moderation fields")).toBeVisible();
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toHaveValue("Preserved moderation draft");
  await expect(btn(page, "Review moderation decision")).toBeDisabled();
  await btn(page, "Reload moderation fields").click();
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toHaveValue("");
  expect(f.moderation.writes).toHaveLength(0);
});
test("fresh terminal review preflight sends no decision and preserves its current facts", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  await open(page);
  await select(page);
  await review(page);
  Object.assign(f.moderation.records[0], {
    status: "APPROVED",
    version: 1,
    moderationNote: null,
    moderatedAt: "2026-10-18T10:00:37.123Z",
  });
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No decision was sent");
  await btn(page, "Go back").click();
  await expect(page.getByLabel("Decision", { exact: true })).toHaveCount(0);
  expect(f.moderation.writes).toHaveLength(0);
});
for (const mode of [
  "lost",
  "malformed",
  "wrong-note",
  "wrong-review",
  "wrong-source",
  "throttle",
])
  test(`${mode} outcome stays locked through reload; current read never replays`, async ({
    page,
  }) => {
    const f = await workModerationFixture(page);
    f.moderation.writeMode = mode;
    await open(page);
    await select(page);
    await review(page);
    await confirm(page).click();
    await btn(page, "Close & review record").click();
    await expect(btn(page, "Load current review")).toBeVisible();
    await expect(btn(page, "Review moderation decision")).toBeDisabled();
    const markers = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:review-moderation:v1:"),
      ),
    );
    expect(markers).toHaveLength(1);
    expect(markers[0][1]).not.toContain("Exact reviewed");
    await page.reload();
    await expect(btn(page, "Load current review")).toBeVisible();
    await btn(page, "Load current review").click();
    await expect(btn(page, "Load current review")).toHaveCount(0);
    await expect(page.getByText(/Current review loaded/)).toContainText(
      "original request outcome is not proven",
    );
    expect(f.moderation.writes).toHaveLength(1);
    if (mode === "throttle")
      await expect(
        page.getByLabel("Customer-visible moderation note", { exact: true }),
      ).toHaveValue("");
    else {
      await expect(page.locator(".wm-current")).toContainText(
        "Exact reviewed customer-visible note",
      );
      await expect(page.getByLabel("Decision", { exact: true })).toHaveCount(0);
      await btn(page, "Show this review in queue").click();
      await expect(page).toHaveURL(/status=REJECTED/);
      await expect(rows(page)).toHaveCount(1);
    }
  });
test("definite API rejection differs from an unsent preflight and preserves fields", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.writeMode = "reject";
  await open(page);
  await select(page);
  await review(page);
  await confirm(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No decision was sent");
  await btn(page, "Go back").click();
  await expect(btn(page, "Load current review")).toHaveCount(0);
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toHaveValue("Exact reviewed customer-visible note\nThe full second line");
});
test("temporary failure keeps labelled read-only reviews; denial clears and queue retry recovers", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  await open(page);
  await select(page);
  f.moderation.mode = "error";
  await btn(page, "Refresh moderation queue").click();
  await expect(btn(page, "Retry moderation queue")).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(btn(page, "Review moderation decision")).toBeDisabled();
  f.moderation.mode = "denied";
  await btn(page, "Retry moderation queue").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByLabel("Decision", { exact: true })).toHaveCount(0);
  f.moderation.mode = "normal";
  await btn(page, "Retry moderation queue").click();
  await expect(rows(page)).toHaveCount(3);
});
test("denied uncertainty reconciliation clears all private feedback and retains the lock", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.writeMode = "lost";
  await open(page);
  await select(page);
  await review(page);
  await confirm(page).click();
  await btn(page, "Close & review record").click();
  f.moderation.directMode = "denied";
  await btn(page, "Load current review").click();
  await expect(page.locator(".wm-review")).toHaveCount(0);
  await expect(btn(page, "Load current review")).toBeVisible();
  expect(f.moderation.writes).toHaveLength(1);
});
test("blocked pending storage prevents an untracked decision without clearing fields", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:review-moderation:v1:")) throw Error("Blocked");
      return original.call(this, key, value);
    };
  });
  await open(page);
  await select(page);
  await review(page);
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No decision was sent");
  await btn(page, "Go back").click();
  await expect(
    page.getByLabel("Customer-visible moderation note", { exact: true }),
  ).toHaveValue("Exact reviewed customer-visible note\nThe full second line");
  expect(f.moderation.writes).toHaveLength(0);
});
test("long feedback and full review pass seven widths and accessibility", async ({
  page,
}) => {
  const f = await workModerationFixture(page);
  f.moderation.records[0].comment = "C".repeat(2000);
  f.moderation.records[0].title = "T".repeat(120);
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
  await page
    .getByLabel("Customer-visible moderation note", { exact: true })
    .fill("N".repeat(1000));
  await btn(page, "Review moderation decision").click();
  await expect(page.getByRole("dialog")).toContainText("C".repeat(2000));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
