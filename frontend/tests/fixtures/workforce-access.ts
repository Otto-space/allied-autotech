import type { Page } from "@playwright/test";
import { workforceCounterPermissions } from "../../lib/api/workforce-schemas";
import {
  workforceAccessRevision,
  workforceCapabilityScopes,
} from "../../../backend/src/modules/organization/workforce-access-revision";
export const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const stamp = "2026-10-18T08:00:00.000Z";
function initialWorkforceState(technician = false) {
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
  return {
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
}
export async function workforceAccessFixture(
  page: Page,
  technician = false,
  state = initialWorkforceState(technician),
  modern = false,
) {
  const projection = () => {
    if (!modern) return state.access;
    const assignments = state.access.assignments.map((a) => ({
      ...a,
      templateVersion: 1,
      startsAt: new Date(a.startsAt),
      expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
      revokedAt: a.revokedAt ? new Date(a.revokedAt) : null,
    }));
    return {
      ...state.access,
      serverTime: new Date().toISOString(),
      nextChangeAt: null,
      capabilityScopes: workforceCapabilityScopes(assignments).filter((g) =>
        state.access.permissions.includes(g.capability),
      ),
      accessRevision: workforceAccessRevision({
        ...state.access,
        assignments,
        role: technician ? "STAFF" : "ADMIN",
      }),
    };
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
    if (endpoint === "/staff/notifications/summary")
      return ok({ unreadCount: 0, groups: [], destinations: [] });
    if (
      endpoint === "/staff/notifications/context" &&
      new URL(req.url()).searchParams.get("resourceType") === "WORKFORCE_JOB" &&
      new URL(req.url()).searchParams.get("resourceId") === id(20)
    )
      return ok({ items: [], hasMore: false });
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
      return ok(projection());
    }
    if (endpoint === "/staff/workforce/overview")
      return ok({
        generatedAt: stamp,
        access: projection(),
        branches: [...new Set(state.access.assignments.map((a) => a.branchId))].map(
          (branchId) => ({ id: branchId, name: "Synthetic workforce branch" }),
        ),
        counts: Object.fromEntries(
          Object.entries(workforceCounterPermissions)
            .filter(([, permissions]) =>
              permissions.some((p) => state.access.permissions.includes(p)),
            )
            .map(([key]) => [key, key === "jobs" ? 1 : 2]),
        ),
      });
    if (endpoint === "/staff/workforce/jobs")
      return ok({ items: [state.job], access: projection(), generatedAt: stamp });
    const jobDetail = () => ({
      ...state.job,
      access: projection(),
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
        access: projection(),
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
