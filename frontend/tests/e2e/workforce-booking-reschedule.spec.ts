import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import {
  workforceBookingConfirmationFixture,
  id,
} from "../fixtures/workforce-booking-confirmation";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request }) => {
  await bookingRuntimeCapabilities(request);
});

async function start(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
  width = 320,
  mode = "normal",
) {
  const f = await workforceBookingConfirmationFixture(page, role);
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Synthetic isolated capabilities",
        meta: { requestId: "managed-reschedule-capabilities" },
        data: {
          scope: "POLICY_SUMMARY",
          serverTime: new Date().toISOString(),
          release: {
            mode: "full",
            customerAccountsEnabled: true,
            enquiriesEnabled: true,
            bookingRequestsEnabled: true,
            inspectionRequestsEnabled: true,
          },
          checkoutEnabled: false,
          vehicleDeposits: { enabled: false },
        },
      },
    }),
  );

  f.booking.status = "CONFIRMED";
  f.booking.version = 1;
  f.booking.confirmedAt = "2040-01-01T08:00:00.000Z";
  const pending = {
    id: id(1900),
    status: "PENDING" as const,
    source: "CUSTOMER" as const,
    branchId: f.booking.branchId,
    slotId: id(1901),
    startsAt: "2040-01-03T09:00:00.000Z",
    reason: "Synthetic later appointment needed",
    createdAt: "2040-01-01T09:00:00.000Z",
    decidedAt: null as string | null,
    decisionReason: null as string | null,
    proposedStaff: f.booking.assignedStaff,
  };
  f.booking.rescheduleRequests = [pending];
  if (mode === "assignment") {
    f.base.access.assignments.push({
      ...f.base.access.assignments[0],
      id: id(1905),
      template: "WORKSHOP_LEAD",
    });
    f.base.access.permissions.push(
      "JOBS_ASSIGN",
      "JOBS_READ",
      "JOBS_UPDATE",
      "QUALITY_APPROVE",
    );
    pending.proposedStaff = {
      id: id(1910),
      firstName: "Synthetic",
      lastName: "Replacement",
    };
  }
  await page.route(
    "**/api/v1/staff/workforce/bookings/*/reschedule-assignees?*",
    (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic scoped choices",
          meta: { requestId: "reschedule-choices" },
          data: {
            items: [pending.proposedStaff],
            jobId: f.booking.id,
            jobVersion: f.booking.version,
            requestId: pending.id,
            branchId: pending.branchId,
            generatedAt: new Date().toISOString(),
            access: f.snapshot(),
          },
        },
      }),
  );
  const writes: { body: Record<string, unknown>; csrf?: string }[] = [];
  await page.route(
    "**/api/v1/staff/workforce/bookings/*/reschedule-decision",
    async (route) => {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      writes.push({ body, csrf: route.request().headers()["x-csrf-token"] });
      if (body.expectedVersion !== f.booking.version || pending.status !== "PENDING")
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      const approved = body.decision === "APPROVE";
      f.booking.version += approved ? 2 : 1;
      if (approved) {
        f.booking.scheduledAt = pending.startsAt;
        if (mode === "assignment") f.booking.assignedStaff = pending.proposedStaff;
      }
      Object.assign(pending, {
        status: approved ? "APPROVED" : "DECLINED",
        decidedAt: new Date().toISOString(),
        decisionReason: body.reason,
      });
      if (mode === "lost") return route.abort("failed");
      return route.fulfill({
        json: {
          success: true,
          message: "Synthetic decision",
          meta: { requestId: "reschedule-fixture" },
          data: {
            id: f.booking.id,
            branchId: f.booking.branchId,
            assignedStaffId: f.booking.assignedStaff!.id,
            status: f.booking.status,
            scheduledAt: f.booking.scheduledAt,
            version: f.booking.version,
            requestId: pending.id,
            requestStatus: pending.status,
            decidedAt: pending.decidedAt,
            performedByUserId: mode === "malformed" ? id(9999) : f.base.access.userId,
          },
        },
      });
    },
  );
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const expected =
      mode === "lost" &&
      message.location().url.includes("reschedule-decision") &&
      /^Failed to load resource:/.test(message.text());
    if (message.type() === "error" && !expected) errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)
    )
      external.push(request.url());
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/admin/workforce/bookings/${f.booking.id}`);
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reschedule awaiting approval" }),
  ).toBeVisible();
  return {
    f,
    writes,
    check: async () => {
      expect(external).toEqual([]);
      await verifyConsole(page, errors, warnings);
    },
  };
}
async function review(page: Page, decline = false) {
  if (decline) await page.getByLabel("Decision", { exact: true }).selectOption("DECLINE");
  else
    await page
      .getByLabel("People and equipment review", { exact: true })
      .fill("Synthetic existing technician and equipment available");
  await page
    .getByLabel("Decision reason (visible to customer)")
    .fill("Synthetic reviewed appointment change");
  await page
    .getByRole("button", { name: "Review reschedule decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 1440])
    test(`${role} approves replacement at ${width}px while retaining original until confirmation`, async ({
      page,
    }) => {
      const { f, writes, check } = await start(page, role, width);
      const original = f.booking.scheduledAt;
      await review(page);
      expect(f.booking.scheduledAt).toBe(original);
      expect(writes).toEqual([]);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Synthetic Technician");
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "STAFF")
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-managed-reschedule-${width}.png`),
        });
      await dialog
        .getByRole("button", { name: "Confirm reschedule decision", exact: true })
        .click();
      await expect(
        page.getByText(
          "Reschedule decision recorded. Review the confirmed appointment and history.",
          { exact: true },
        ),
      ).toBeVisible();
      expect(writes).toHaveLength(1);
      expect(writes[0].csrf).toBeTruthy();
      expect(f.booking.scheduledAt).toBe("2040-01-03T09:00:00.000Z");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Reschedule awaiting approval" }),
      ).toHaveCount(0);
      expect(writes).toHaveLength(1);
      await check();
    });
test("decline preserves original appointment", async ({ page }) => {
  const { f, writes, check } = await start(page);
  const original = f.booking.scheduledAt;
  await review(page, true);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm reschedule decision", exact: true })
    .click();
  await expect(
    page.getByText(
      "Reschedule decision recorded. Review the confirmed appointment and history.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(f.booking.scheduledAt).toBe(original);
  expect(writes).toHaveLength(1);
  expect(writes[0].body.decision).toBe("DECLINE");
  await check();
});
for (const mode of ["lost", "malformed"])
  test(`${mode} response requires history review without resubmission`, async ({
    page,
  }) => {
    const { writes, check } = await start(page, "STAFF", 320, mode);
    await review(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm reschedule decision", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier reschedule decision" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the earlier reschedule decision" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Check current booking", exact: true })
      .click();
    await expect(
      page.getByLabel("I have reviewed the affected booking and its reschedule history."),
    ).toBeVisible();
    await page
      .getByLabel("I have reviewed the affected booking and its reschedule history.")
      .check();
    await page.getByRole("button", { name: "Clear checked recovery reference" }).click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier reschedule decision" }),
    ).toHaveCount(0);
    expect(writes).toHaveLength(1);
    await check();
  });

test("assignment responsibility exposes only scoped named choices", async ({ page }) => {
  const { f, writes, check } = await start(page, "STAFF", 320, "assignment");
  await expect(page.getByLabel("Find a permitted technician")).toBeVisible();
  await expect(page.getByLabel("Staff at the replacement branch")).toHaveValue(id(1910));
  await review(page);
  await expect(page.getByRole("dialog")).toContainText("Synthetic Replacement");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm reschedule decision", exact: true })
    .click();
  await expect(
    page.getByText(
      "Reschedule decision recorded. Review the confirmed appointment and history.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body.assignedStaffId).toBe(id(1910));
  expect(f.booking.assignedStaff!.id).toBe(id(1910));
  await check();
});
test("confirmation grant removed during review prevents submission", async ({ page }) => {
  const { f, writes, check } = await start(page);
  const original = f.booking.scheduledAt;
  await review(page);
  f.base.access.independentCapabilities = [];
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm reschedule decision", exact: true })
    .click();
  await expect(page.getByText(/No decision was sent/)).toBeVisible();
  expect(writes).toEqual([]);
  expect(f.booking.scheduledAt).toBe(original);
  await check();
});
