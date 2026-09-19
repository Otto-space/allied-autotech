import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { inspectionFixture, inspectionId as id } from "../fixtures/inspection";
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      meta: { requestId: "inspection-test" },
      data,
    },
  });

test("rescheduled inspections send a complete interval and can close as no-show", async ({
  page,
}) => {
  const inspection = inspectionFixture();
  inspection.status = "CONFIRMED";
  inspection.scheduledStartAt = "2026-10-20T09:00:00Z";
  inspection.scheduledEndAt = "2026-10-20T10:00:00Z";
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicle-inspections") {
      await reply(route, { items: [inspection] });
      return true;
    }
    if (endpoint.endsWith("/status")) {
      const body = route.request().postDataJSON();
      writes.push(body);
      inspection.status = body.status;
      inspection.version++;
      if (body.scheduledStartAt) {
        inspection.scheduledStartAt = body.scheduledStartAt;
        inspection.scheduledEndAt = body.scheduledEndAt;
      }
      await reply(route, inspection);
      return true;
    }
  });
  await page.goto("/admin/inspections");
  await page.getByText("Manage inspection progress", { exact: true }).click();
  await page.getByLabel("Next inspection status").selectOption("RESCHEDULED");
  await page.getByLabel("Inspection starts (Lagos time)").fill("2026-10-21T12:00");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByLabel("Inspection ends (Lagos time)")).toBeFocused();
  await page.getByLabel("Inspection ends (Lagos time)").fill("2026-10-21T13:00");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("RESCHEDULED");
  expect(writes[0]).toEqual({
    status: "RESCHEDULED",
    expectedVersion: 2,
    scheduledStartAt: "2026-10-21T12:00:00+01:00",
    scheduledEndAt: "2026-10-21T13:00:00+01:00",
  });
  await page.getByRole("button", { name: "Reload inspection fields" }).click();
  await page.getByLabel("Next inspection status").selectOption("NO_SHOW");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("NO SHOW");
  expect(writes[1]).toEqual({ status: "NO_SHOW", expectedVersion: 3 });
  await expect(
    page.getByRole("button", { name: "Review inspection change" }),
  ).toHaveCount(0);
});

test("customer inspection history displays a report with an unrecorded odometer", async ({
  page,
}) => {
  const inspection = inspectionFixture();
  inspection.status = "COMPLETED";
  inspection.conditionReport = {
    id: id(30),
    summary: "Isolated report without a reading",
    inspectedAt: "2026-09-17T13:00:00Z",
    odometerKm: null,
    conditionScore: null,
    findings: null,
  };
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/customers/vehicle-inspections") {
        await reply(route, { items: [inspection] });
        return true;
      }
    },
    "CUSTOMER",
  );
  await page.goto("/dashboard/inspections");
  await page.getByText("Inspection report", { exact: true }).click();
  await expect(
    page.getByText("Isolated report without a reading", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Odometer not recorded", { exact: false })).toBeVisible();
});
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "STAFF",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(4),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(5), email: "inspection@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-inspection-csrf-".repeat(4) });
    if (endpoint === "/public/branches")
      return reply(route, { items: [{ id: id(3), name: "Isolated branch" }] });
    if (endpoint === "/admin/staff")
      return reply(route, {
        items: [
          {
            id: id(6),
            email: "assignee@example.test",
            role: "STAFF",
            status: "ACTIVE",
            staffProfile: {
              id: id(7),
              firstName: "Isolated",
              lastName: "Assignee",
              branchId: id(3),
            },
          },
        ],
      });
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
test("staff confirms and completes inspections with Lagos schedules and separate report creation", async ({
  page,
}) => {
  const inspection = inspectionFixture();
  const writes: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicle-inspections") {
      await reply(route, { items: [inspection] });
      return true;
    }
    if (endpoint.endsWith("/status")) {
      const body = route.request().postDataJSON();
      writes.push(body);
      inspection.status = body.status;
      inspection.version++;
      inspection.assignedStaffId = id(8);
      inspection.assignedStaff = {
        id: id(8),
        firstName: "Isolated",
        lastName: "Operator",
      };
      if (body.scheduledStartAt) {
        inspection.scheduledStartAt = body.scheduledStartAt;
        inspection.scheduledEndAt = body.scheduledEndAt;
      }
      await reply(route, inspection);
      return true;
    }
  });
  await page.goto("/admin/inspections");
  await expect(page).toHaveTitle(/Manage vehicle inspections/);
  await expect(
    page.getByRole("heading", { name: "Vehicle inspections", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Active branch filter")).toHaveCount(0);
  await page.getByText("Manage inspection progress", { exact: true }).click();
  await expect(page.getByLabel("Next inspection status").locator("option")).toHaveText([
    "CONFIRMED",
    "CANCELLED",
  ]);
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByLabel("Inspection ends (Lagos time)")).toBeFocused();
  await page.getByLabel("Inspection ends (Lagos time)").fill("2026-10-20T11:00");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "assigns the inspection to your own staff profile",
  );
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
  expect(writes).toHaveLength(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-inspection-review-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("CONFIRMED");
  expect(writes[0]).toEqual({
    status: "CONFIRMED",
    expectedVersion: 2,
    scheduledStartAt: "2026-10-20T10:00:00+01:00",
    scheduledEndAt: "2026-10-20T11:00:00+01:00",
  });
  await page.getByRole("button", { name: "Reload inspection fields" }).click();
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not reserve the vehicle");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("COMPLETED");
  expect(writes[1]).toEqual({ status: "COMPLETED", expectedVersion: 3 });
  await expect(
    page.getByRole("button", { name: "Review inspection change" }),
  ).toHaveCount(0);
  await expect(page.getByText("To record the findings", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
test("administrator filters and schedules an active assignee, preserving drafts after a concurrent update", async ({
  page,
}) => {
  const inspection = inspectionFixture();
  const queries: string[] = [];
  const writes: unknown[] = [];
  let failed = true;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/staff/vehicle-inspections") {
        queries.push(new URL(route.request().url()).search);
        if (failed)
          await route.fulfill({
            status: 503,
            json: { success: false, error: { code: "UNAVAILABLE" } },
          });
        else await reply(route, { items: [inspection], nextCursor: id(15) });
        return true;
      }
      if (endpoint.endsWith("/status")) {
        const body = route.request().postDataJSON();
        writes.push(body);
        inspection.status = body.status;
        inspection.version++;
        await reply(route, inspection);
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/inspections");
  await expect(page.getByText("No inspection requests on this page")).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Refresh inspection records" }).click();
  await expect(page.locator(".status")).toHaveText("REQUESTED");
  await page
    .getByRole("navigation", { name: "Staff inspections pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)).toContain(`cursor=${id(15)}`);
  await page.getByLabel("Active branch filter").selectOption(id(3));
  await expect.poll(() => queries.at(-1)).toContain(`branchId=${id(3)}`);
  expect(queries.at(-1)).not.toContain("cursor=");
  await page.getByText("Manage inspection progress", { exact: true }).click();
  await page.getByLabel("Inspection ends (Lagos time)").fill("2026-10-20T12:00");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByLabel("Inspection assignee")).toBeFocused();
  await page.getByLabel("Inspection assignee").selectOption(id(7));
  inspection.version++;
  await page.getByRole("button", { name: "Refresh inspection records" }).click();
  await expect(
    page.getByRole("button", { name: "Review inspection change" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Inspection ends (Lagos time)")).toHaveValue(
    "2026-10-20T12:00",
  );
  await page.getByRole("button", { name: "Reload inspection fields" }).click();
  await page.getByLabel("Inspection ends (Lagos time)").fill("2026-10-20T11:30");
  await page.getByLabel("Inspection assignee").selectOption(id(7));
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("CONFIRMED");
  expect(writes[0]).toEqual({
    status: "CONFIRMED",
    expectedVersion: 3,
    assignedStaffId: id(7),
    scheduledStartAt: "2026-10-20T10:00:00+01:00",
    scheduledEndAt: "2026-10-20T11:30:00+01:00",
  });
});
test("inspection cancellation requires a reason and reconciles a lost status response", async ({
  page,
}) => {
  const inspection = inspectionFixture();
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicle-inspections") {
      await reply(route, { items: [inspection] });
      return true;
    }
    if (endpoint.endsWith("/status")) {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        status: "CANCELLED",
        expectedVersion: 2,
        reason: "Isolated cancellation",
      });
      inspection.status = "CANCELLED";
      inspection.version++;
      inspection.cancellationReason = "Isolated cancellation";
      await route.abort("failed");
      return true;
    }
  });
  await page.goto("/admin/inspections");
  await page.getByText("Manage inspection progress", { exact: true }).click();
  await page.getByLabel("Next inspection status").selectOption("CANCELLED");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await expect(page.getByLabel("Inspection cancellation reason")).toBeFocused();
  await page.getByLabel("Inspection cancellation reason").fill("Isolated cancellation");
  await page.getByRole("button", { name: "Review inspection change" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.locator(".status")).toHaveText("CANCELLED");
  await expect(
    page.getByRole("button", { name: "Review inspection change" }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
});
