import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workDisputeHandlingFixture,
  disputeHandlingRow,
  id,
} from "../fixtures/work-dispute-handling";
const root = "/admin/payment-disputes/work",
  note = "Synthetic operator acknowledgement reviewed carefully.";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function open(p: Page, n = 0) {
  await p.goto(`${root}?selected=${id(220000 + n)}`);
  await expect(p.locator(".wh-identity")).toBeVisible();
}
async function reviewAck(p: Page) {
  await p.getByLabel("Acknowledgement note", { exact: true }).fill(note);
  await button(p, "Review acknowledgement").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
async function confirm(p: Page) {
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} uses scoped current handling facts`, async ({ page }) => {
    const f = await workDisputeHandlingFixture(page, role);
    await open(page, role === "STAFF" ? 1 : 0);
    await expect(page.locator(".wh-record")).toHaveCount(role === "STAFF" ? 1 : 2);
    await expect(page.getByLabel("Primary operator", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    expect(f.writes).toHaveLength(0);
  });
test("missing capability prevents protected reads", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  f.base.grants = [];
  await page.goto(root);
  await expect(page.locator("main").getByRole("alert")).toContainText("grant");
  expect(f.reads).toHaveLength(0);
});
for (const mode of ["denied", "inactive", "mismatch", "error"])
  test(`profile ${mode} stops reads`, async ({ page }) => {
    const f = await workDisputeHandlingFixture(page);
    f.base.base.profileMode = mode;
    await page.goto(root);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
  });
test("selection preserves queue and draft on close; cancel restores focus", async ({
  page,
}) => {
  const f = await workDisputeHandlingFixture(page);
  await open(page);
  const count = f.reads.filter((u) => u.pathname.endsWith("/disputes")).length;
  await reviewAck(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await expect(button(page, "Review acknowledgement")).toBeFocused();
  await button(page, "Close").click();
  await page.locator(".wh-record").first().getByRole("button").click();
  await expect(page.getByLabel("Acknowledgement note", { exact: true })).toHaveValue(
    note,
  );
  expect(f.reads.filter((u) => u.pathname.endsWith("/disputes"))).toHaveLength(count);
  expect(f.writes).toHaveLength(0);
});
test("filters and cursor survive reload and browser history", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  f.records = Array.from({ length: 28 }, (_, n) => ({
    ...disputeHandlingRow(n),
    resolvedAt: null,
  }));
  await page.goto(root);
  await expect(page.locator(".wh-record")).toHaveCount(25);
  await button(page, "Next").click();
  await expect(page.locator(".wh-record")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".wh-record")).toHaveCount(3);
  await button(page, "Previous").click();
  await expect(page.locator(".wh-record")).toHaveCount(25);
  await page.getByLabel("Dispute history", { exact: true }).selectOption("all");
  await expect(page).toHaveURL(/openOnly=false/);
  await page.goBack();
  await expect(page.getByLabel("Dispute history", { exact: true })).toHaveValue("open");
});
test("acknowledgement sends one conditional request and preserves provider outcome", async ({
  page,
}) => {
  const f = await workDisputeHandlingFixture(page);
  await open(page);
  await reviewAck(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Dispute action recorded" }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0].body).toEqual({
    note,
    expectedUpdatedAt: "2026-10-18T10:00:37.123Z",
  });
  expect(f.records[0].status).toBe("AWAITING_RESPONSE");
  await expect(page.getByLabel("Acknowledgement note", { exact: true })).toHaveCount(0);
});
test("fresh record conflict sends no mutation", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  await open(page);
  await reviewAck(page);
  f.records[0].updatedAt = "2026-10-18T10:00:38.123Z";
  await confirm(page);
  await expect(page.getByRole("dialog")).toContainText(
    "No dispute change request was sent",
  );
  expect(f.writes).toHaveLength(0);
});
test("revoked capability during review clears protected facts", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  await open(page);
  await reviewAck(page);
  f.base.grants = [];
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Dispute access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".wh-identity")).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("lost acknowledgement persists across reload and requires a fresh recovery read", async ({
  page,
}) => {
  const f = await workDisputeHandlingFixture(page);
  f.mutationMode = "lost";
  await open(page);
  await reviewAck(page);
  await confirm(page);
  await expect(page.getByRole("dialog")).toContainText("outcome could not be confirmed");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Check the earlier dispute change" }),
  ).toBeVisible();
  await expect(button(page, "Review dispute assignment")).toBeDisabled();
  await button(page, "Read current dispute").first().click();
  await expect(
    page.getByRole("heading", { name: "Current dispute checked" }),
  ).toBeVisible();
  await expect(button(page, "Clear local recovery lock")).toBeDisabled();
  await page.getByLabel("I have independently reconciled", { exact: false }).check();
  await button(page, "Clear local recovery lock").click();
  await expect(
    page.getByRole("heading", { name: "Check the earlier dispute change" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
test("closed history keeps evidence access without handling forms", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  await open(page, 2);
  await expect(page.locator(".wh-history")).toBeVisible();
  await expect(button(page, "Review dispute assignment")).toHaveCount(0);
  await button(page, "Load private dispute evidence").click();
  await expect(
    page.getByRole("link", { name: "Open dispute evidence in a new tab" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
test("an older recovery read cannot unlock a later uncertain action", async ({
  page,
}) => {
  const f = await workDisputeHandlingFixture(page);
  f.mutationMode = "lost";
  await open(page);
  await reviewAck(page);
  await confirm(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await button(page, "Read current dispute").first().click();
  await page.getByLabel("I have independently reconciled", { exact: false }).check();
  await button(page, "Clear local recovery lock").click();
  await page.getByLabel("Primary operator", { exact: true }).selectOption(id(302));
  await page.getByLabel("Backup operator", { exact: true }).selectOption(id(303));
  await button(page, "Review dispute assignment").click();
  await confirm(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Current dispute checked" }),
  ).toHaveCount(0);
  f.currentMode = "error";
  await button(page, "Read current dispute").first().click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be checked",
  );
  await expect(button(page, "Clear local recovery lock")).toHaveCount(0);
  expect(f.writes).toHaveLength(2);
});
test("invalid view does not fetch dispute data", async ({ page }) => {
  const f = await workDisputeHandlingFixture(page);
  await page.goto(root + "?openOnly=wrong");
  await expect(page.locator("main").getByRole("alert")).toContainText("unsupported");
  expect(f.reads).toHaveLength(0);
});
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`handling workspace accessible at ${width}`, async ({ page }) => {
    const f = await workDisputeHandlingFixture(page);
    f.records[0].providerDisputeId = "SYNTHETIC-LONG-DISPUTE-REFERENCE-".repeat(4);
    f.records[0].amountKobo = "9223372036854775807";
    await page.setViewportSize({ width, height: 1050 });
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const scan = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      scan.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
  });
