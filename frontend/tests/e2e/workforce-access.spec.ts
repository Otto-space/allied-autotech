import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-18T08:00:00.000Z";
async function fixture(page: Page, technician = false) {
  const assignment = (template: string, n: number, temporary = false) => ({
    id: id(n),
    userId: id(1),
    template,
    branchId: id(2),
    scope: template === "MECHANICAL_TECHNICIAN" ? "ASSIGNED" : "BRANCH",
    temporary,
    startsAt: stamp,
    expiresAt: null,
    reason: temporary ? "Position vacant" : "Synthetic primary responsibility",
    assignedByUserId: id(3),
    createdAt: stamp,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  });
  const state = {
    denied: false,
    hold: false,
    release: undefined as (() => void) | undefined,
    accesses: 0,
    reads: [] as string[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    access: {
      managed: true,
      userId: id(1),
      staffId: id(5),
      position: technician ? "MECHANICAL_TECHNICIAN" : "OPERATIONS",
      department: technician ? "Services" : "Strategy",
      version: 0,
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: technician
        ? [assignment("MECHANICAL_TECHNICIAN", 11)]
        : [
            assignment("OPERATIONS", 11),
            assignment("SALES_SUPERVISOR", 12, true),
            assignment("CUSTOMER_SERVICE", 13, true),
          ],
      permissions: technician
        ? ["JOBS_READ", "JOBS_UPDATE"]
        : [
            "BOOKINGS_READ",
            "SALES_ENQUIRIES",
            "CUSTOMER_ENQUIRIES",
            "COMPLAINTS",
            "ORDERS_READ",
            "ORDERS_PREPARE",
          ],
    },
    job: {
      id: id(20),
      branchId: id(2),
      scheduledAt: stamp,
      status: "CONFIRMED",
      version: 0,
      assignedStaffId: id(5),
      customerNotes: "Engine noise reported",
      service: { name: "Mechanical diagnosis" },
      vehicle: {
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        registrationNumber: "SYNTHETIC",
      },
      workOrder: {
        id: id(21),
        workOrderNumber: "WO-SYNTHETIC-20",
        status: "APPROVED",
        diagnosis: null as string | null,
        internalNotes: null,
        version: 0,
        workedByUserIds: [] as string[],
        qualityApprovedByUserId: null,
        qualityApprovedAt: null,
      },
    },
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      endpoint = new URL(req.url()).pathname.replace("/api/v1", "");
    if (req.method() === "GET") state.reads.push(endpoint);
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic workforce fixture",
          meta: { requestId: "workforce-browser" },
        },
      });
    if (endpoint === "/auth/session")
      return ok({
        id: id(4),
        user: {
          id: id(1),
          email: "synthetic-workforce@example.test",
          role: technician ? "STAFF" : "ADMIN",
        },
        workforceManaged: true,
        mfaRequired: true,
        mfaVerifiedAt: stamp,
        expiresAt: "2027-01-01T00:00:00.000Z",
        idleExpiresAt: "2027-01-01T00:00:00.000Z",
      });
    if (endpoint === "/auth/csrf")
      return ok({ csrfToken: "synthetic-workforce-csrf-".repeat(3) });
    if (endpoint === "/staff/workforce/access") {
      state.accesses++;
      if (state.hold)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.denied)
        return route.fulfill({
          status: 403,
          json: {
            success: false,
            message: "Current access is unavailable",
            error: { code: "FORBIDDEN" },
          },
        });
      return ok(state.access);
    }
    if (endpoint === "/staff/workforce/overview")
      return ok({
        generatedAt: stamp,
        access: state.access,
        branches: state.access.assignments.length
          ? [{ id: id(2), name: "Synthetic workforce branch" }]
          : [],
        counts: technician
          ? { jobs: 1 }
          : { bookings: 3, enquiries: 2, complaints: 1, orders: 4 },
      });
    if (endpoint === "/staff/workforce/jobs")
      return ok({ items: [state.job], access: state.access, generatedAt: stamp });
    const jobDetail = () => ({
      ...state.job,
      access: state.access,
      generatedAt: stamp,
      branch: { id: id(2), name: "Synthetic workforce branch" },
      assignedStaff: { id: id(5), firstName: "Ada", lastName: "Okoro" },
    });
    if (endpoint === `/staff/workforce/jobs/${id(20)}`) return ok(jobDetail());
    if (endpoint === `/staff/workforce/jobs/${id(20)}/work` && req.method() === "PATCH") {
      const body = req.postDataJSON();
      state.writes.push({ path: endpoint, body });
      state.job.workOrder.version++;
      state.job.workOrder.diagnosis = body.diagnosis ?? null;
      state.job.workOrder.status = body.status ?? state.job.workOrder.status;
      state.job.workOrder.workedByUserIds = [id(1)];
      if (body.status === "IN_PROGRESS" && state.job.status === "CONFIRMED") {
        state.job.status = "IN_PROGRESS";
        state.job.version++;
      }
      return ok(jobDetail());
    }
    if (endpoint === "/staff/workforce/enquiries")
      return ok({
        access: state.access,
        generatedAt: stamp,
        items: [
          {
            id: id(40),
            status: "OPEN",
            version: 0,
            subject: "Synthetic parts enquiry",
            message: "Are brake pads available?",
            type: "PRODUCT",
            branchId: id(2),
            branch: { id: id(2), name: "Synthetic workforce branch" },
            assignedStaffId: null,
            assignedStaff: null,
            updatedAt: stamp,
            createdAt: stamp,
          },
        ],
      });
    return route.fulfill({
      status: 403,
      json: {
        success: false,
        message: "Forbidden fixture request",
        error: { code: "FORBIDDEN" },
      },
    });
  });
  return state;
}
test("combined Operations home stays compact and never fetches finance or broad legacy data", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  await expect(page.getByText("Position vacant", { exact: true })).toHaveCount(2);
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveCount(1);
  await expect(nav).not.toContainText("Finance");
  await expect(nav).not.toContainText("Team & Access");
  await page.getByRole("searchbox", { name: "Search dashboard pages" }).fill("enquiries");
  await page
    .locator(".dashboard-search-results")
    .getByRole("link", { name: /^Enquiries Customers/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Enquiries", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: /^Synthetic parts enquiry/ }),
  ).toBeVisible();
  expect(
    state.reads.every((p) => p.startsWith("/auth/") || p.startsWith("/staff/workforce/")),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-workforce-desktop.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("technician updates only technical fields using the existing review modal", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/admin/workforce/jobs");
  await page.getByRole("link", { name: "WO-SYNTHETIC-20", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Technical work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assign technician", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Synthetic vibration diagnosis");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Synthetic vibration diagnosis",
  );
  await page.getByLabel("Progress", { exact: true }).selectOption("IN_PROGRESS");
  await page
    .getByRole("button", { name: "Review technical update", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("dd").filter({ hasText: "Synthetic vibration diagnosis" }),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      path: `/staff/workforce/jobs/${id(20)}/work`,
      body: {
        expectedVersion: 0,
        diagnosis: "Synthetic vibration diagnosis",
        status: "IN_PROGRESS",
      },
    },
  ]);
});
test("direct forbidden URLs do not mount legacy finance or fetch its data", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  expect(state.reads).not.toContain("/staff/payments");
  expect(state.reads).not.toContain("/staff/overview");
});
test("permission loading and revocation discard old-tab content and navigation", async ({
  page,
}) => {
  const state = await fixture(page);
  state.hold = true;
  await page.goto("/admin");
  await expect(
    page.getByText("Checking current responsibility access…", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operational overview" })).toHaveCount(
    0,
  );
  expect(state.reads).not.toContain("/staff/workforce/overview");
  state.hold = false;
  state.release?.();
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  state.access.permissions = ["BOOKINGS_READ", "ORDERS_READ"];
  state.access.assignments = [state.access.assignments[0]];
  state.access.version++;
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Customer Service Officer", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("navigation", { name: "Administration", exact: true }),
  ).not.toContainText("Customers & Enquiries");
  state.denied = true;
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading", { name: "Operational overview" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Your account does not have permission for this action." }),
  ).toBeVisible();
});
test("mobile technician navigation and job queue stay accessible without horizontal overflow", async ({
  page,
}) => {
  await fixture(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  const menu = page.getByRole("button", {
    name: /Open.*menu|Open.*navigation|Open menu/i,
  });
  await menu.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "My work", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workshop jobs", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-workforce-mobile.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
