import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workBookingDetailFixture, bookingId } from "../fixtures/work-booking-detail";
const route = `/admin/bookings/${bookingId(1)}`;

test("temporary background access failure preserves drafts while blocking review", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page);
  await page.goto(route);
  await page.getByLabel("Internal staff notes").fill("Unsaved inspection note.");
  state.accessMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Booking may be out of date. Refresh before making changes."),
  ).toBeVisible();
  await expect(page.getByLabel("Internal staff notes")).toHaveValue(
    "Unsaved inspection note.",
  );
  await expect(page.getByRole("button", { name: "Review status change" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review draft work order" }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test("long service and line descriptions remain readable on mobile", async ({ page }) => {
  const { state } = await workBookingDetailFixture(page);
  state.record.service.name = "Advanced diagnostics ".repeat(12);
  state.record.customerNotes = "A long customer concern. ".repeat(70);
  state.record.workOrder = {
    id: bookingId(800),
    workOrderNumber: "WO-2026-0008",
    status: "DRAFT",
    version: 1,
    diagnosis: "Review diagnostic codes.",
    internalNotes: "Confirm equipment availability.",
    items: [
      {
        id: bookingId(801),
        type: "LABOUR",
        productId: null,
        description: "Detailed diagnostic investigation ".repeat(18),
        quantity: 2,
        unitPriceKobo: "1500000",
        subtotalKobo: "3000000",
      },
    ],
  };
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "WO-2026-0008" })).toBeVisible();
  await expect(page.locator('.service-line-table td[data-label="Subtotal"]')).toHaveText(
    /30,000/,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Mark approved" })).toBeEnabled();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});

test("held read shows a loading state without action forms", async ({ page }) => {
  const { state } = await workBookingDetailFixture(page);
  state.mode = "hold";
  await page.goto(route);
  await expect(page.getByText("Checking booking...", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Next status")).toHaveCount(0);
  state.mode = "normal";
  state.held?.();
  await expect(page.getByLabel("Next status")).toBeVisible();
});

test("a different booking identifier in the response fails closed", async ({ page }) => {
  const { state } = await workBookingDetailFixture(page);
  state.record.id = bookingId(99);
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "Booking unavailable" })).toBeVisible();
  await expect(page.locator(".booking-detail-summary")).toHaveCount(0);
});

test("session invalidation removes the booking and open review", async ({ page }) => {
  await workBookingDetailFixture(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Review assignment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".booking-detail-summary")).toHaveCount(0);
});

for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} without a staff profile can change work records but cannot author quotations`, async ({
    page,
  }) => {
    const { state } = await workBookingDetailFixture(page, role);
    state.profile = false;
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "Review draft work order" }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Create quotation" })).toHaveCount(0);
    await expect(
      page.getByText("A staff profile is required to create or replace a draft."),
    ).toBeVisible();
  });

for (const width of [320, 360, 390, 430, 768, 844, 1024, 1280, 1440, 1505, 1920]) {
  test(`workshop detail retains complete records and actions at ${width}px`, async ({
    page,
  }) => {
    await workBookingDetailFixture(page);
    await page.setViewportSize({ width, height: width === 844 ? 390 : 1045 });
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Vehicle diagnostics", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review assignment", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator('[aria-current="page"]').filter({ hasText: "Vehicle diagnostics" }),
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByText("Business-caused disruption", { exact: true }).click();
    await expect(page.getByLabel("Disruption reason")).toBeVisible();
    if ([320, 768, 1505].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
  });
}
test("unassigned staff can self-assign but cannot operate another staff member's booking", async ({
  page,
}) => {
  const { state, list } = await workBookingDetailFixture(page, "STAFF");
  state.assigned = false;
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Review assignment" })).toBeEnabled();
  await expect(page.getByLabel("Next status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review draft work order" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Create quotation" })).toHaveCount(0);
  await expect(page.getByText("Business-caused disruption", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Assigned staff member")).toHaveValue(bookingId(601));
  await page.getByRole("button", { name: "Review assignment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Review assignment" }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByLabel("Next status")).toBeVisible();
  expect(state.writes[0].body).toEqual({
    assignedStaffId: bookingId(601),
    expectedVersion: 1,
  });
  expect(list.reads.filter((x) => x.pathname.includes("/admin/"))).toEqual([]);
});
test("confirmation capability permits unassigned staff confirmation but no other status", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page, "STAFF");
  state.assigned = false;
  state.capability = true;
  state.record.status = "REQUESTED";
  await page.goto(route);
  await expect(page.getByLabel("Next status")).toContainText("CONFIRMED");
  await expect(
    page.getByLabel("Next status").locator('option[value="CANCELLED"]'),
  ).toHaveCount(0);
  await page.getByLabel("Next status").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Review status change" }).click();
  await expect(
    page.getByLabel("People and equipment review (required for confirmation)"),
  ).toBeFocused();
  await expect(
    page.getByLabel("People and equipment review (required for confirmation)"),
  ).toHaveAttribute("aria-invalid", "true");
  expect(state.writes).toEqual([]);
  await page
    .getByLabel("People and equipment review (required for confirmation)")
    .fill("Available technician and diagnostic equipment reviewed.");
  await page.getByRole("button", { name: "Review status change" }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.locator(".booking-detail-status")).toHaveText("CONFIRMED");
  expect(state.writes).toHaveLength(1);
});
test("cancellation reason is associated with its field and a reviewed change uses the version", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page);
  await page.goto(route);
  await page.getByLabel("Next status").selectOption("CANCELLED");
  await page.getByRole("button", { name: "Review status change" }).click();
  const reason = page.getByLabel("Reason (required for cancellation)", { exact: true });
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-describedby", "booking-validation");
  await reason.fill("Customer agreed to cancel this appointment.");
  await page.getByRole("button", { name: "Review status change" }).click();
  await expect(page.getByRole("dialog")).toContainText("Customer agreed to cancel");
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.locator(".booking-detail-status")).toHaveText("CANCELLED");
  expect(state.writes[0].body.expectedVersion).toBe(1);
});
for (const outcome of ["uncertain", "conflict"])
  test(`${outcome} mutation cannot be replayed in the same review`, async ({ page }) => {
    const { state } = await workBookingDetailFixture(page);
    state.outcome = outcome;
    await page.goto(route);
    await page.getByLabel("Next status").selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Review status change" }).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    await page
      .getByRole("button", {
        name: outcome === "uncertain" ? "Close & review record" : "Go back",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => state.reads).toBeGreaterThan(1);
    expect(state.writes).toHaveLength(1);
  });
for (const mode of ["error", "denied", "malformed"])
  test(`${mode} detail read hides records and permits recovery`, async ({ page }) => {
    const { state } = await workBookingDetailFixture(page);
    state.mode = mode;
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Booking unavailable" }),
    ).toBeVisible();
    await expect(page.getByLabel("Next status")).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry booking", exact: true }).click();
    await expect(page.getByLabel("Next status")).toBeVisible();
    expect(state.writes).toEqual([]);
  });
test("background error discloses retained data and manual failure removes it", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page);
  await page.goto(route);
  await expect(page.getByLabel("Next status")).toBeVisible();
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Booking may be out of date. Refresh before making changes."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review status change" })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Vehicle diagnostics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Booking unavailable" })).toBeVisible();
  await expect(page.locator(".booking-detail-summary")).toHaveCount(0);
});
test("profile failure keeps readable booking but hides privileged forms", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page);
  state.accessMode = "error";
  await page.goto(route);
  await expect(page.getByText(/Booking access could not be checked/)).toBeVisible();
  await expect(page.getByLabel("Next status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review draft work order" })).toHaveCount(
    0,
  );
  state.accessMode = "normal";
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review draft work order" }),
  ).toBeEnabled();
});
test("disruption uses review and displays the recorded pending outcome", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page);
  await page.goto(route);
  await page.getByText("Business-caused disruption", { exact: true }).click();
  await page
    .getByLabel("Disruption reason")
    .fill("The diagnostic equipment requires repair.");
  await page.getByRole("button", { name: "Review disruption" }).click();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Business disruption recorded" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review disruption" })).toHaveCount(0);
  expect(state.writes[0].body).toEqual({
    expectedVersion: 1,
    reason: "The diagnostic equipment requires repair.",
  });
});
test("draft work order persists reviewed public and internal notes", async ({ page }) => {
  const { state } = await workBookingDetailFixture(page);
  await page.goto(route);
  await page
    .getByLabel("Diagnosis (customer-visible)")
    .fill("Diagnostic inspection requested.");
  await page.getByLabel("Internal work-order notes").fill("Use bay two.");
  await page.getByRole("button", { name: "Review draft work order" }).click();
  await expect(page.getByRole("dialog")).toContainText("Use bay two.");
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("heading", { name: "WO-2026-0008" })).toBeVisible();
  expect(state.writes[0].body).toEqual({
    expectedBookingVersion: 1,
    diagnosis: "Diagnostic inspection requested.",
    internalNotes: "Use bay two.",
    items: [],
  });
});
