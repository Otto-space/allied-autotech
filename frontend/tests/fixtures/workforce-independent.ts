import type { Page } from "@playwright/test";
import { workforceAccessRevision } from "../../../backend/src/modules/organization/workforce-access-revision";
import { bookingId as id } from "./work-bookings";

/** Decorate an existing isolated workspace fixture; never provide a real session. */
export async function managedIndependentFixture(
  page: Page,
  role: "STAFF" | "ADMIN",
  grants: () => string[],
) {
  const snapshot = () => {
    const base = {
      managed: true,
      userId: id(302),
      staffId: id(601),
      version: 0,
      position: "ACCOUNTANT",
      department: "Finance",
      assignments: [],
      permissions: [],
      independentCapabilities: grants(),
      canManageAssignments: false,
      canInviteAdmins: false,
      nextChangeAt: null,
      capabilityScopes: [],
      serverTime: new Date().toISOString(),
    };
    return { ...base, accessRevision: workforceAccessRevision({ ...base, role }) };
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Isolated independent-grant fixture",
      meta: { requestId: "independent-grants" },
    },
  });
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill(
      ok({
        id: id(901),
        user: { id: id(302), role, email: "synthetic-grants@example.test" },
        workforceManaged: true,
        mfaRequired: true,
        mfaVerifiedAt: "2026-10-27T01:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      }),
    ),
  );
  await page.route("**/api/v1/staff/workforce/access", (route) =>
    route.fulfill(ok(snapshot())),
  );
  await page.route("**/api/v1/staff/workforce/overview", (route) =>
    route.fulfill(
      ok({
        access: snapshot(),
        counts: {},
        branches: [],
        generatedAt: new Date().toISOString(),
      }),
    ),
  );
  return snapshot;
}
