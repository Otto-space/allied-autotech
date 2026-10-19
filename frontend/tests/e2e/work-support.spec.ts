import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workSupportFixture, bookingId } from "../fixtures/work-support";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  rows = (p: Page) => p.locator(".wsu-record");
async function open(p: Page, q = "") {
  await p.goto("/admin/support" + q);
  await expect(rows(p)).toHaveCount(25);
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} reads complete named queue, scope, contact and assignment facts`, async ({
    page,
  }) => {
    const f = await workSupportFixture(page, role);
    await open(page);
    await expect(rows(page).first()).toContainText("Service estimate request");
    await expect(rows(page).first()).toContainText("Amina Okafor");
    await expect(rows(page).first()).toContainText("Ada Okoro");
    await expect(rows(page).first()).toContainText("10:00:00.123");
    await expect(rows(page).first()).toContainText(bookingId(50000));
    await expect(
      page.getByRole("link", { name: "Service estimate request", exact: true }),
    ).toHaveAttribute("href", `/admin/support/enquiries/${bookingId(50000)}`);
    await expect(page.getByLabel("Branch filter", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    if (role === "STAFF") expect(f.support.pickerReads).toHaveLength(0);
    expect(f.support.writes).toHaveLength(0);
  });
test("profile gate defers private collection reads and recovers access outage", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  f.state.profileMode = "hold";
  await page.goto("/admin/support");
  await expect(page.getByText("Checking support access…", { exact: true })).toBeVisible();
  expect(f.support.reads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry support access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry support access").click();
  await expect(rows(page)).toHaveCount(25);
});
for (const query of [
  "?kind=bad",
  "?kind=complaints&type=GENERAL",
  "?priority=HIGH",
  "?status=bad",
  "?cursor=bad",
  "?search=engine",
  "?status=OPEN&status=CLOSED",
])
  test(`invalid link ${query} performs no collection read`, async ({ page }) => {
    const f = await workSupportFixture(page);
    await page.goto("/admin/support" + query);
    await expect(
      page.getByRole("heading", { name: "Support filters unavailable" }),
    ).toBeVisible();
    expect(f.support.reads).toHaveLength(0);
    await btn(page, "Clear support filters").click();
    await expect(rows(page)).toHaveCount(25);
  });
test("foreign Staff branch links and responses fail closed, including reassignment", async ({
  page,
}) => {
  const f = await workSupportFixture(page, "STAFF");
  await page.goto(`/admin/support?branchId=${bookingId(102)}`);
  await expect(
    page.getByRole("heading", { name: "Support filters unavailable" }),
  ).toBeVisible();
  expect(f.support.reads).toHaveLength(0);
  await btn(page, "Clear support filters").click();
  await expect(rows(page)).toHaveCount(25);
  f.support.mode = "mismatch";
  f.support.records.enquiries[0].branchId = bookingId(102);
  f.support.records.enquiries[0].branch!.id = bookingId(102);
  await btn(page, "Refresh support records").click();
  await expect(btn(page, "Retry support records")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});
test("25+3 paging and category history survive reload and Back", async ({ page }) => {
  await workSupportFixture(page);
  await open(page);
  await btn(page, "Next").click();
  await expect(rows(page)).toHaveCount(3);
  await page.reload();
  await expect(rows(page)).toHaveCount(3);
  await btn(page, "Complaints").click();
  await expect(rows(page)).toHaveCount(25);
  await expect(page).toHaveURL(/kind=complaints/);
  await page.goBack();
  await expect(rows(page)).toHaveCount(3);
  await expect(btn(page, "Enquiries")).toHaveAttribute("aria-pressed", "true");
  await btn(page, "Previous").click();
  await expect(rows(page)).toHaveCount(25);
});
test("filters apply explicitly and reset paging without a required assignee", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  await open(page);
  f.support.records.enquiries[0].status = "IN_PROGRESS";
  const before = f.support.reads.length;
  await page.getByLabel("Record status", { exact: true }).selectOption("IN_PROGRESS");
  await page.getByLabel("Enquiry type", { exact: true }).selectOption("SERVICE");
  expect(f.support.reads.length).toBe(before);
  await btn(page, "Apply support filters").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/status=IN_PROGRESS/);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("SERVICE");
  await btn(page, "Clear support filters").click();
  await expect(rows(page)).toHaveCount(25);
});
test("complaint priority and saved acknowledgement/escalation dates remain factual", async ({
  page,
}) => {
  await workSupportFixture(page);
  await page.goto("/admin/support?kind=complaints&priority=HIGH");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Acknowledgement due");
  await expect(rows(page).first()).toContainText("Acknowledged");
  await expect(rows(page).first()).toContainText("10:00:37.123");
  await expect(page.getByLabel("Complaint priority", { exact: true })).toHaveValue(
    "HIGH",
  );
});
test("branch changes clear assignee drafts and historical branches remain selectable", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  await open(page);
  await page
    .getByLabel("Assigned staff filter", { exact: true })
    .selectOption(bookingId(601));
  await page.getByLabel("Branch filter", { exact: true }).selectOption(bookingId(102));
  await expect(page.getByLabel("Assigned staff filter", { exact: true })).toHaveValue("");
  const record = f.support.records.enquiries[0];
  record.branchId = bookingId(102);
  record.branch!.id = bookingId(102);
  record.branch!.name = "Previous workshop";
  await btn(page, "Apply support filters").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Previous workshop");
});
test("picker outages keep the readable queue and allow unassigned filters", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  f.support.pickerMode = "error";
  await open(page);
  await page.getByLabel("Record status", { exact: true }).selectOption("OPEN");
  await btn(page, "Apply support filters").click();
  await expect(page).toHaveURL(/status=OPEN/);
  await expect(rows(page)).toHaveCount(25);
  expect(f.support.writes).toHaveLength(0);
});
test("off-page saved assignee remains visible without being silently cleared", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  for (const r of f.support.records.enquiries) r.assignedStaffId = bookingId(699);
  for (const r of f.support.records.enquiries)
    r.assignedStaff = r.assignedStaffId
      ? { id: bookingId(699), firstName: "Saved", lastName: "Operator" }
      : null;
  await open(page, `?assignedStaffId=${bookingId(699)}`);
  await expect(page.getByLabel("Assigned staff filter", { exact: true })).toHaveValue(
    bookingId(699),
  );
  await expect(
    page.getByText(`Selected staff reference: ${bookingId(699)}`, { exact: true }),
  ).toBeVisible();
  await btn(page, "Apply support filters").click();
  await expect(rows(page)).toHaveCount(25);
});
for (const mode of ["malformed", "duplicate", "bad-cursor"])
  test(`${mode} support page reveals no contacts`, async ({ page }) => {
    const f = await workSupportFixture(page);
    f.support.mode = mode;
    await page.goto("/admin/support");
    await expect(btn(page, "Retry support records")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });
test("outage keeps labelled old records and blocks paging; denial clears contacts", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  await open(page);
  f.support.mode = "error";
  await btn(page, "Refresh support records").click();
  await expect(btn(page, "Retry support records")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(btn(page, "Next")).toBeDisabled();
  await expect(
    page.getByText("Previously loaded support records are shown.", { exact: false }),
  ).toBeVisible();
  f.support.mode = "denied";
  await btn(page, "Retry support records").click();
  await expect(rows(page)).toHaveCount(0);
});
test("named conversation and Back retain the current filters after reload", async ({
  page,
}) => {
  await workSupportFixture(page);
  await open(page);
  await page.getByLabel("Record status", { exact: true }).selectOption("OPEN");
  await btn(page, "Apply support filters").click();
  await expect(rows(page)).toHaveCount(25);
  await expect(page).toHaveURL(/status=OPEN/);
  await page.reload();
  await expect(rows(page)).toHaveCount(25);
  await page.getByRole("link", { name: "Service estimate request", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/support/enquiries/${bookingId(50000)}$`),
  );
  await page.goBack();
  await expect(page).toHaveURL(/status=OPEN/);
  await expect(rows(page)).toHaveCount(25);
});
test("seven responsive widths and long complete records pass accessibility", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  f.support.records.complaints = f.support.records.complaints.slice(0, 2);
  const r = f.support.records.complaints[0];
  r.subject = "S".repeat(160);
  r.email = "e".repeat(100) + "@example.test";
  r.description = "D".repeat(4000);
  await page.goto("/admin/support?kind=complaints");
  await expect(rows(page)).toHaveCount(2);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
});
