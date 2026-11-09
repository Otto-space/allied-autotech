import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  workforceBookingConfirmationFixture,
  id,
} from "../fixtures/workforce-booking-confirmation";
import { bookingDetailFixture, detailId } from "../fixtures/customer-booking-detail";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";
import type { WorkReviewOptions } from "../../lib/api/booking-work-review-schemas";

test.beforeEach(async ({ request, page }) => {
  await bookingRuntimeCapabilities(request, page);
});
async function start(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
  width = 320,
  mode = "normal",
) {
  const f = await workforceBookingConfirmationFixture(page, role);
  f.booking.status = "IN_PROGRESS";
  f.booking.confirmedAt = "2040-01-01T08:00:00.000Z";
  f.booking.startedAt = "2040-01-01T09:00:00.000Z";
  const options: WorkReviewOptions = {
    bookingId: f.booking.id,
    version: f.booking.version,
    scheduleVersion: f.booking.scheduleVersion,
    status: f.booking.status,
    branchId: f.booking.branchId,
    serviceId: id(1040),
    staffId: f.booking.assignedStaff!.id,
    startedAt: f.booking.startedAt,
    canReview: true,
    resourcePolicyVersionId: id(1041),
    cleanupMinutes: 15,
    requirements: [{ pool: "bay", quantity: 1 }],
    resources: [
      {
        id: id(1042),
        name: "Synthetic inspection bay",
        kind: "SPACE",
        status: "AVAILABLE",
        pools: ["bay"],
      },
    ],
    current: null,
  };
  const writes: { body: Record<string, unknown>; csrf?: string }[] = [];
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  await page.route("**/api/v1/staff/workforce/bookings/*/work-review", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          success: true,
          message: "Synthetic work-review options",
          meta: { requestId: "work-review-options" },
          data: options,
        },
      });
    const body = route.request().postDataJSON();
    writes.push({ body, csrf: route.request().headers()["x-csrf-token"] });
    expect(body.expectedVersion).toBe(f.booking.version);
    if (mode === "not-saved") return route.abort("failed");
    f.booking.version++;
    const review = {
      id: id(1043),
      bookingVersion: f.booking.version,
      resourcePolicyVersionId: body.resourcePolicyVersionId,
      reviewedAt: "2040-01-01T10:00:00.000Z",
      remainingMinutes: body.remainingMinutes,
      cleanupMinutes: body.cleanupMinutes,
      expectedWorkEndsAt: "2040-01-01T10:45:00.000Z",
      resourceIds: body.resourceIds,
      resourceNames: ["Synthetic inspection bay"],
      reason: body.reason,
      performedByUserId: f.base.access.userId,
    };
    options.version = f.booking.version;
    options.current = review;
    f.booking.workEstimate = {
      reviewedAt: review.reviewedAt,
      remainingMinutes: review.remainingMinutes,
      estimatedWorkEndsAt: review.expectedWorkEndsAt,
    };
    if (mode === "lost") return route.abort("failed");
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic work-review receipt",
        meta: { requestId: "work-review-receipt" },
        data: {
          id: f.booking.id,
          branchId: options.branchId,
          serviceId: options.serviceId,
          staffId: options.staffId,
          version: f.booking.version,
          scheduleVersion: f.booking.scheduleVersion,
          status: f.booking.status,
          scheduledAt: f.booking.scheduledAt,
          startedAt: f.booking.startedAt,
          performedByUserId: mode === "malformed" ? id(9999) : f.base.access.userId,
          review,
        },
      },
    });
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const expected =
      ["lost", "not-saved"].includes(mode) &&
      m.location().url.includes("/work-review") &&
      /^Failed to load resource:/.test(m.text());
    if (m.type() === "error" && !expected) errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/admin/workforce/bookings/${f.booking.id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/workforce/bookings/${f.booking.id}$`));
  await expect(page).toHaveTitle(/Allied/i);
  await expect(
    page.getByRole("heading", { name: "Review remaining work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review appointment timing", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Check current resources", exact: true })
    .click();
  await expect(
    page.getByLabel("Estimated remaining work (minutes)", { exact: true }),
  ).toBeFocused();
  return {
    f,
    options,
    writes,
    check: async () => {
      expect(external).toEqual([]);
      await verifyConsole(page, errors, warnings);
    },
  };
}
async function draft(page: Page) {
  await page.getByLabel("Estimated remaining work (minutes)", { exact: true }).fill("45");
  await page.getByLabel("Cleanup after work (minutes)", { exact: true }).fill("15");
  await page.getByLabel(/Synthetic inspection bay/).check();
  await page
    .getByLabel("Reason for this work review (internal)")
    .fill("Synthetic inspection of remaining work and actual bay");
}
async function review(page: Page) {
  await draft(page);
  await page.getByRole("button", { name: "Review remaining work", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 768, 1440])
    test(`${role} reviews ongoing work at ${width}px without moving or completing the job`, async ({
      page,
    }, info) => {
      const { f, writes, check } = await start(page, role, width);
      const visit = f.booking.scheduledAt,
        started = f.booking.startedAt,
        schedule = f.booking.scheduleVersion;
      await review(page);
      expect(writes).toEqual([]);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("45 min");
      await expect(dialog).toContainText("Synthetic inspection bay");
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      const screenshot = path.join(
        tmpdir(),
        `allied-running-work-${role}-${width}-${info.retry}.png`,
      );
      await page.screenshot({ path: screenshot });
      await info.attach(`work-review-${role}-${width}`, {
        path: screenshot,
        contentType: "image/png",
      });
      await dialog
        .getByRole("button", { name: "Confirm work review", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Updated work estimate", exact: true }),
      ).toBeVisible();
      expect(writes).toHaveLength(1);
      expect(writes[0].csrf).toBeTruthy();
      expect(writes[0].body).not.toHaveProperty("scheduledAt");
      expect(f.booking.scheduledAt).toBe(visit);
      expect(f.booking.startedAt).toBe(started);
      expect(f.booking.scheduleVersion).toBe(schedule);
      expect(f.booking.status).toBe("IN_PROGRESS");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Updated work estimate", exact: true }),
      ).toBeVisible();
      expect(writes).toHaveLength(1);
      await check();
    });
for (const mode of ["lost", "malformed", "not-saved"])
  test(`${mode} work-review result is inspected after refresh without replay`, async ({
    page,
  }) => {
    const { writes, check } = await start(page, "STAFF", 320, mode);
    await review(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm work review", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier work review" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the earlier work review" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Check current work review", exact: true })
      .click();
    await expect(
      page.getByText(
        mode === "not-saved"
          ? /No current work review is recorded/
          : /Recorded equipment or space: Synthetic inspection bay/,
      ),
    ).toBeVisible();
    await page.getByLabel(/I have inspected the current job/).check();
    await page
      .getByRole("button", { name: "Clear checked work-review reference" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier work review" }),
    ).toHaveCount(0);
    expect(writes).toHaveLength(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await check();
  });
for (const change of ["grant", "plan"])
  test(`${change} change prevents sending an outdated work review`, async ({ page }) => {
    const { f, options, writes, check } = await start(page);
    await review(page);
    if (change === "grant") f.base.access.independentCapabilities = [];
    else options.resourcePolicyVersionId = id(1050);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm work review", exact: true })
      .click();
    await expect(page.getByText(/No work review was sent/)).toBeVisible();
    expect(writes).toEqual([]);
    await check();
  });
test("refreshing resource choices preserves the assessed draft", async ({ page }) => {
  const { writes, check } = await start(page);
  await draft(page);
  await page
    .getByRole("button", { name: "Refresh resource choices", exact: true })
    .click();
  await expect(
    page.getByLabel("Estimated remaining work (minutes)", { exact: true }),
  ).toHaveValue("45");
  await expect(page.getByLabel(/Synthetic inspection bay/)).toBeChecked();
  await expect(page.getByLabel("Reason for this work review (internal)")).toHaveValue(
    "Synthetic inspection of remaining work and actual bay",
  );
  expect(writes).toEqual([]);
  await check();
});
test("customer sees only the current estimate and cannot reschedule recorded work", async ({
  page,
}) => {
  const f = await bookingDetailFixture(page);
  f.record.startedAt = new Date(Date.now() - 600000).toISOString();
  f.record.workEstimate = {
    reviewedAt: new Date().toISOString(),
    remainingMinutes: 45,
    estimatedWorkEndsAt: new Date(Date.now() + 2700000).toISOString(),
  };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/dashboard/bookings/${detailId}`);
  await expect(page).toHaveTitle(/Allied/i);
  await expect(
    page.getByRole("heading", { name: "Updated work estimate" }),
  ).toBeVisible();
  await expect(
    page.getByText(/not a promised completion or vehicle-collection time/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reschedule appointment", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Review remaining work", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
