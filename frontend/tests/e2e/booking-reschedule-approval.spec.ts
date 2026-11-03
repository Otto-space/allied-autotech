import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  bookingDetailFixture,
  detailId,
  future,
} from "../fixtures/customer-booking-detail";
import { workBookingDetailFixture, bookingId } from "../fixtures/work-booking-detail";
import type { BookingRescheduleRequest } from "@/lib/api/booking-schemas";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request }) => {
  await bookingRuntimeCapabilities(request);
});

const pending = (): BookingRescheduleRequest => ({
  id: bookingId(650),
  status: "PENDING",
  source: "CUSTOMER",
  branchId: bookingId(101),
  slotId: bookingId(504),
  startsAt: future(96),
  reason: "Customer needs another day",
  createdAt: new Date().toISOString(),
  decidedAt: null,
  decisionReason: null,
});
for (const width of [320, 768, 1440]) {
  test(`customer request preserves the appointment and can be withdrawn at ${width}px`, async ({
    page,
  }, info) => {
    const state = await bookingDetailFixture(page);
    const original = state.record.scheduledAt;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/bookings/${detailId}`);
    await page
      .getByRole("button", { name: "Reschedule appointment", exact: true })
      .click();
    await page.locator(".booking-slot").click();
    await expect(
      page.getByRole("button", { name: "Review reschedule", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Reason for rescheduling", { exact: true })
      .fill("Customer needs another day");
    await page.getByRole("button", { name: "Review reschedule", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "original appointment stays confirmed",
    );
    expect(state.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    const section = page.getByRole("region", {
      name: "Reschedule awaiting approval",
      exact: true,
    });
    await expect(section).toContainText("Your original appointment remains confirmed");
    expect(state.record.scheduledAt).toBe(original);
    expect(state.record.customerRescheduleCount).toBe(0);
    await expect(
      page.getByRole("button", { name: "Reschedule appointment", exact: true }),
    ).toHaveCount(0);
    expect(
      (await new AxeBuilder({ page }).include(".customer-booking-detail").analyze())
        .violations,
    ).toEqual([]);
    await section.screenshot({ path: info.outputPath(`pending-${width}.png`) });
    await section
      .getByLabel("Reason for withdrawing this request")
      .fill("Original time now works");
    await section.getByRole("button", { name: "Review withdrawal", exact: true }).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(section).toHaveCount(0);
    await page.getByText("Reschedule history", { exact: true }).click();
    await expect(
      page.getByRole("list", { name: "Recent reschedule decisions" }),
    ).toContainText("Withdrawn");
    expect(state.record.scheduledAt).toBe(original);
    expect(state.writes).toHaveLength(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
  test(`staff confirms an explicit resource-reviewed replacement once at ${width}px`, async ({
    page,
  }, info) => {
    const { state } = await workBookingDetailFixture(page);
    state.capability = true;
    state.record.scheduledAt = future(72);
    state.record.rescheduleRequests = [pending()];
    const originalVersion = state.record.version,
      replacement = state.record.rescheduleRequests[0]!.startsAt;
    const calls: { body: unknown; csrf?: string }[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/reschedule-decision"))
        calls.push({
          body: request.postDataJSON(),
          csrf: request.headers()["x-csrf-token"],
        });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/admin/bookings/${bookingId(1)}`);
    const section = page.getByRole("region", {
      name: "Reschedule awaiting approval",
      exact: true,
    });
    await section
      .getByLabel("Staff at the replacement branch")
      .selectOption(bookingId(601));
    await section
      .getByLabel("People and equipment review")
      .fill("Synthetic mechanic and bay capacity checked");
    await section
      .getByLabel("Decision reason (visible to customer)")
      .fill("Replacement agreed with customer");
    await section.screenshot({ path: info.outputPath(`staff-review-${width}.png`) });
    await section
      .getByRole("button", { name: "Review reschedule decision", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Only a successful approval switches",
    );
    expect(calls).toHaveLength(0);
    await page
      .getByRole("button", { name: "Confirm reschedule decision", exact: true })
      .click();
    await expect(section).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.csrf).toBeTruthy();
    expect(calls[0]!.body).toMatchObject({
      requestId: bookingId(650),
      expectedVersion: originalVersion,
      decision: "APPROVE",
      assignedStaffId: bookingId(601),
    });
    expect(state.record.scheduledAt).toBe(replacement);
    expect(state.record.version).toBe(originalVersion + 2);
    await page.getByText("Reschedule history", { exact: true }).click();
    await expect(
      page.getByRole("list", { name: "Recent reschedule decisions" }),
    ).toContainText("Approved");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
test("a staff member without confirmation capability sees the pending change without decision controls", async ({
  page,
}) => {
  const { state } = await workBookingDetailFixture(page, "STAFF");
  state.record.rescheduleRequests = [pending()];
  await page.goto(`/admin/bookings/${bookingId(1)}`);
  await expect(
    page.getByRole("heading", { name: "Reschedule awaiting approval" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reschedule decision", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
