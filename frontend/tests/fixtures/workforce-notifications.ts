import type { Page } from "@playwright/test";
import type { WorkforceAccess } from "../../lib/api/workforce-schemas";
import { notificationsFixture } from "./customer-notifications";

const id = (n: number) => `b4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-19T08:00:00.000Z";
export const notificationResponsibilities = {
  OPERATIONS: ["BOOKINGS_READ", "ORDERS_READ", "ORDERS_PREPARE"],
  CUSTOMER_SERVICE: ["BOOKINGS_READ", "CUSTOMER_ENQUIRIES", "COMPLAINTS", "ORDERS_READ"],
  SALES_SUPERVISOR: ["SALES_ENQUIRIES", "ENQUIRIES_ASSIGN", "ORDERS_READ"],
  SALES_CASHIER: ["SALES_ENQUIRIES"],
  ACCOUNTANT: ["FINANCE_READ"],
  WORKSHOP_LEAD: ["JOBS_READ", "JOBS_ASSIGN", "JOBS_UPDATE", "QUALITY_APPROVE"],
  ELECTRICAL_TECHNICIAN: ["JOBS_READ", "JOBS_UPDATE"],
  MECHANICAL_TECHNICIAN: ["JOBS_READ", "JOBS_UPDATE"],
} as const;

export async function workforceNotificationsFixture(
  page: Page,
  template: keyof typeof notificationResponsibilities = "MECHANICAL_TECHNICIAN",
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const notifications = await notificationsFixture(page, role);
  const access: WorkforceAccess = {
    managed: true,
    userId: notifications.sessionUserId,
    staffId: id(2),
    position: "Synthetic workforce account",
    department: "Synthetic department",
    version: 1,
    assignments: [
      {
        id: id(3),
        userId: notifications.sessionUserId,
        template,
        branchId: id(4),
        scope: [
          "SALES_CASHIER",
          "ELECTRICAL_TECHNICIAN",
          "MECHANICAL_TECHNICIAN",
        ].includes(template)
          ? "ASSIGNED"
          : "BRANCH",
        temporary: false,
        startsAt: stamp,
        expiresAt: null,
        reason: "Isolated browser verification",
        assignedByUserId: id(5),
        createdAt: stamp,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
      },
    ],
    permissions: [...notificationResponsibilities[template]],
    canManageAssignments: false,
    canInviteAdmins: false,
    serverTime: stamp,
  };
  const state = {
    notifications,
    access,
    denied: false,
    hold: false,
    release: undefined as (() => void) | undefined,
    requests: [] as string[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    state.requests.push(endpoint);
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic workforce notification fixture",
          meta: { requestId: "workforce-notifications" },
        },
      });
    if (endpoint === "/auth/session")
      return ok({
        id: id(1),
        user: {
          id: notifications.sessionUserId,
          role: notifications.role,
          email: "workforce@example.test",
        },
        workforceManaged: true,
        mfaRequired: true,
        mfaVerifiedAt: stamp,
      });
    if (endpoint === "/staff/workforce/access") {
      if (state.hold)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.denied)
        return route.fulfill({
          status: 403,
          json: {
            success: false,
            message: "Access denied",
            error: { code: "FORBIDDEN" },
          },
        });
      return ok(state.access);
    }
    return route.fallback();
  });
  return state;
}
