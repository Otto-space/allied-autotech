import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { enforceWorkforceBoundary } from "../../src/modules/organization/workforce.policy.js";

const actor: AuthenticatedActor = {
  userId: "b4000000-0000-4000-8000-000000000001",
  sessionId: "b4000000-0000-4000-8000-000000000002",
  role: "STAFF",
  email: "synthetic@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date("2026-10-19T08:00:00Z"),
};
const notification = "b4000000-0000-4000-8000-000000000003";
function database(managed = true) {
  return {
    workforceAccess: {
      findUnique: vi.fn().mockResolvedValue(managed ? { userId: actor.userId } : null),
    },
  } as unknown as Pick<Prisma.TransactionClient, "workforceAccess">;
}

describe("managed workforce personal notification boundary", () => {
  for (const role of ["STAFF", "ADMIN"] as const) {
    it(`${role} reaches only the existing personal endpoint shapes`, async () => {
      const db = database();
      for (const suffix of [
        "",
        "/",
        "?limit=25&unreadOnly=true",
        "/preferences/current",
        "/summary",
        "/attention?section=%2Fadmin%2Fworkforce%2Fjobs",
        "/context",
        "/read-context",
        "/read-all",
        `/${notification}/read`,
        `/${notification}/unread`,
        `/${notification}/read/`,
      ])
        await expect(
          enforceWorkforceBoundary(
            db,
            { ...actor, role },
            `/api/v1/staff/notifications${suffix}`,
          ),
        ).resolves.toBeUndefined();
    });
    it(`${role} cannot use near-misses or legacy operational paths`, async () => {
      const db = database();
      for (const path of [
        "/staff/notifications-admin",
        "/staff/notifications/export",
        "/staff/notifications/summary/export",
        "/staff/notifications/context/export",
        "/staff/notifications/read-context/export",
        "/staff/notifications/attention/export",
        "/staff/notifications/preferences",
        "/staff/notifications/preferences/current/export",
        "/staff/notifications/read-all/export",
        "/staff/notifications/other-user/read",
        `/staff/notifications/${notification}/read/export`,
        "/staff/notifications/%252fread-all",
        "/staff/notifications/%ZZ",
        "/staff/notifications//read-all",
        "/staff/notifications/../payments",
        "/staff/payments",
        "/staff/bookings",
        "/staff/customers",
        "/admin/users",
        "/customers/notifications",
      ])
        await expect(
          enforceWorkforceBoundary(db, { ...actor, role }, `/api/v1${path}`),
        ).rejects.toMatchObject({ statusCode: 403 });
    });
  }
  it("leaves existing legacy account boundary behavior intact", async () => {
    await expect(
      enforceWorkforceBoundary(database(false), actor, "/api/v1/staff/bookings"),
    ).resolves.toBeUndefined();
    for (const role of ["SUPER_ADMIN", "CUSTOMER"] as const)
      await expect(
        enforceWorkforceBoundary(
          database(),
          { ...actor, role },
          "/api/v1/staff/bookings",
        ),
      ).resolves.toBeUndefined();
  });
});
