import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInspectionsFixture, bookingId } from "../fixtures/work-inspections";
const button = (page: Page, name: string) =>
    page.getByRole("button", { name, exact: true }),
  first = (page: Page) => page.locator(".wi-card").first();
async function open(page: Page, query = "") {
  await page.goto(`/admin/inspections${query}`);
  await expect(first(page)).toBeVisible();
}
async function cancel(page: Page) {
  const card = first(page);
  await card.getByText("Manage inspection progress", { exact: true }).click();
  await card.getByLabel("Next inspection status").selectOption("CANCELLED");
  await card
    .getByLabel("Inspection cancellation reason")
    .fill("Reviewed synthetic cancellation");
  await card
    .getByRole("button", { name: "Review inspection change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} sees complete named requests and supported scope`, async ({ page }) => {
    const f = await workInspectionsFixture(page, role);
    await open(page);
    await expect(page.locator(".wi-card")).toHaveCount(25);
    await expect(first(page)).toContainText("Toyota Camry SE");
    await expect(first(page)).toContainText("Amina Okafor");
    await expect(first(page)).toContainText("10:00:37.123");
    await expect(first(page)).toContainText(bookingId(8000));
    await expect(page.getByLabel("Branch filter", { exact: true })).toHaveCount(
      role === "STAFF" ? 0 : 1,
    );
    expect(f.inspections.writes).toHaveLength(0);
  });
test("profile gate prevents reads and retries current access", async ({ page }) => {
  const f = await workInspectionsFixture(page);
  f.state.profileMode = "hold";
  await page.goto("/admin/inspections");
  await expect(
    page.getByText("Checking inspection access…", { exact: true }),
  ).toBeVisible();
  expect(f.inspections.reads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(button(page, "Retry inspection access")).toBeVisible();
  f.state.profileMode = "normal";
  await button(page, "Retry inspection access").click();
  await expect(first(page)).toBeVisible();
});
for (const query of [
  "?status=bad",
  "?search=Camry",
  "?status=REQUESTED&status=COMPLETED",
  "?cursor=bad",
])
  test(`invalid query ${query} sends no collection read`, async ({ page }) => {
    const f = await workInspectionsFixture(page);
    await page.goto("/admin/inspections" + query);
    await expect(
      page.getByRole("heading", { name: "Inspection filters unavailable" }),
    ).toBeVisible();
    expect(f.inspections.reads).toHaveLength(0);
    await button(page, "Clear inspection filters").click();
    await expect(first(page)).toBeVisible();
  });
test("Staff foreign branch link and response fail closed", async ({ page }) => {
  const f = await workInspectionsFixture(page, "STAFF");
  await page.goto(`/admin/inspections?branchId=${bookingId(103)}`);
  await expect(
    page.getByRole("heading", { name: "Inspection filters unavailable" }),
  ).toBeVisible();
  expect(f.inspections.reads).toHaveLength(0);
  f.inspections.mode = "foreign";
  f.inspections.records[0].vehicleListing.branchId = bookingId(103);
  await button(page, "Clear inspection filters").click();
  await expect(button(page, "Retry inspection records")).toBeVisible();
  await expect(page.locator(".wi-card")).toHaveCount(0);
});
test("URL cursor paging, reload, back and filters preserve exact current scope", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  await open(page);
  const nav = page.getByRole("navigation", {
    name: "Staff inspections pages",
    exact: true,
  });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".wi-card")).toHaveCount(3);
  await expect(page).toHaveURL(/cursor=/);
  await page.reload();
  await expect(page.locator(".wi-card")).toHaveCount(3);
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".wi-card")).toHaveCount(25);
  await page.getByLabel("Branch filter", { exact: true }).selectOption(bookingId(101));
  await button(page, "Apply filters").click();
  await expect
    .poll(() => f.inspections.reads.at(-1)?.searchParams.get("branchId"))
    .toBe(bookingId(101));
  expect(f.inspections.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
  await page.getByLabel("Inspection status filter").selectOption("COMPLETED");
  await button(page, "Apply filters").click();
  await expect(
    page.getByRole("heading", { name: "No inspections match these filters" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator(".wi-card")).toHaveCount(25);
});
test("Admin confirms a full Lagos interval and eligible assignment with one write", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  await open(page);
  const card = first(page);
  await card.getByText("Manage inspection progress", { exact: true }).click();
  await card.getByLabel("Inspection starts (Lagos time)").fill("2026-10-21T12:00");
  await card.getByLabel("Inspection ends (Lagos time)").fill("2026-10-21T13:00");
  await card.getByLabel("Inspection assignee").selectOption(bookingId(601));
  await card
    .getByRole("button", { name: "Review inspection change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Ada James");
  await button(page, "Go back").click();
  expect(f.inspections.writes).toHaveLength(0);
  await card
    .getByRole("button", { name: "Review inspection change", exact: true })
    .click();
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.inspections.writes).toEqual([
    {
      status: "CONFIRMED",
      expectedVersion: 0,
      assignedStaffId: bookingId(601),
      scheduledStartAt: "2026-10-21T12:00:00+01:00",
      scheduledEndAt: "2026-10-21T13:00:00+01:00",
    },
  ]);
  await expect(card.locator(".status")).toHaveText("Confirmed");
});
test("preflight concurrency preserves the draft and requires explicit reload", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  await open(page);
  await cancel(page);
  f.inspections.records[0].version = 1;
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No change was sent");
  expect(f.inspections.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(first(page).getByLabel("Inspection cancellation reason")).toHaveValue(
    "Reviewed synthetic cancellation",
  );
  await first(page)
    .getByRole("button", { name: "Reload inspection fields", exact: true })
    .click();
  await expect(first(page).getByLabel("Next inspection status")).toHaveValue("CONFIRMED");
});
for (const mode of ["lost", "malformed", "mismatch", "throttle"])
  test(`${mode} response stays locked through reload without replay`, async ({
    page,
  }) => {
    const f = await workInspectionsFixture(page);
    f.inspections.writeMode = mode;
    await open(page);
    await cancel(page);
    await button(page, "Confirm change").click();
    await expect(button(page, "Close & review record")).toBeVisible();
    await button(page, "Close & review record").click();
    await expect(button(page, "Load current inspection page")).toBeVisible();
    await page.reload();
    await expect(button(page, "Load current inspection page")).toBeVisible();
    await button(page, "Load current inspection page").click();
    await expect(button(page, "Load current inspection page")).toHaveCount(0);
    await expect(page.locator(".work-inspections")).toContainText(
      "previous request outcome is not proven",
    );
    expect(f.inspections.writes).toHaveLength(1);
  });
test("a definitive rejection clears only recovery state and preserves the draft", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  f.inspections.writeMode = "reject";
  await open(page);
  await cancel(page);
  await button(page, "Confirm change").click();
  await expect(button(page, "Go back")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No change was sent");
  await button(page, "Go back").click();
  await expect(button(page, "Load current inspection page")).toHaveCount(0);
  await expect(first(page).getByLabel("Inspection cancellation reason")).toHaveValue(
    "Reviewed synthetic cancellation",
  );
  expect(f.inspections.writes).toHaveLength(1);
});
for (const mode of ["malformed", "duplicate", "denied"])
  test(`${mode} collection renders no private cards`, async ({ page }) => {
    const f = await workInspectionsFixture(page);
    f.inspections.mode = mode;
    await page.goto("/admin/inspections");
    await expect(button(page, "Retry inspection records")).toBeVisible();
    await expect(page.locator(".wi-card")).toHaveCount(0);
  });
test("temporary failures disable existing forms; denial removes facts", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  await open(page);
  await first(page).getByText("Manage inspection progress", { exact: true }).click();
  f.inspections.mode = "error";
  await button(page, "Refresh inspection records").click();
  await expect(button(page, "Retry inspection records")).toBeVisible();
  await expect(first(page)).toContainText("Amina Okafor");
  await expect(
    first(page).getByRole("button", { name: "Review inspection change", exact: true }),
  ).toBeDisabled();
  f.inspections.mode = "denied";
  await button(page, "Retry inspection records").click();
  await expect(page.locator(".wi-card")).toHaveCount(0);
});
test("responsive cards, filters and review are accessible without overflow", async ({
  page,
}) => {
  const f = await workInspectionsFixture(page);
  f.inspections.records = f.inspections.records.slice(0, 2);
  await open(page);
  for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await cancel(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
