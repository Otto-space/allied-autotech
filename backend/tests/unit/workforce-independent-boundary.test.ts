import { describe, expect, it, vi } from "vitest";
import {
  independentEndpointCapabilities,
  recognisedIndependentCapabilities,
} from "../../src/modules/policies/independent-capabilities.js";
import { enforceWorkforceBoundary } from "../../src/modules/organization/workforce.policy.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
const id = "b7000000-0000-4000-8000-000000000001";
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  role: "STAFF",
  email: "synthetic@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
function db(granted: boolean) {
  return {
    workforceAccess: { findUnique: vi.fn().mockResolvedValue({ userId: id }) },
    userCapability: { findFirst: vi.fn().mockResolvedValue(granted ? { id } : null) },
  } as unknown as Pick<Prisma.TransactionClient, "workforceAccess" | "userCapability">;
}
describe("independent-grant compatibility boundary", () => {
  it("retains only recognised names without interpreting unknown historical grants", () => {
    expect(
      recognisedIndependentCapabilities([
        "UNKNOWN",
        "FINANCE_READ",
        "REFUND_CHECK",
        "REFUND_CHECK",
      ]),
    ).toEqual(["REFUND_CHECK"]);
  });
  it.each([
    ["GET", "/staff/refunds"],
    ["GET", `/staff/refunds/${id}`],
    ["POST", `/staff/refunds/${id}/decision`],
    ["POST", `/staff/refunds/${id}/transfer`],
    ["POST", `/staff/refunds/${id}/check`],
    ["POST", `/staff/refunds/${id}/evidence-access`],
    ["POST", `/staff/refunds/${id}/evidence-upload`],
    ["GET", "/staff/disputes"],
    ["GET", "/staff/disputes/operators"],
    ["GET", `/staff/disputes/${id}`],
    ["POST", `/staff/disputes/${id}/acknowledge`],
    ["GET", "/staff/finance-policy/current"],
    ["GET", "/staff/finance-policy"],
    ["POST", "/admin/policies"],
    ["GET", "/staff/privacy-requests"],
    ["POST", `/staff/privacy-requests/${id}/review`],
    ["GET", "/staff/retention-holds"],
    ["POST", "/staff/retention-holds"],
    ["POST", `/staff/retention-holds/${id}/release`],
  ])("requires an actual current grant for %s %s", async (method, path) => {
    expect(
      independentEndpointCapabilities(`/api/v1${path}`, method).length,
    ).toBeGreaterThan(0);
    await expect(
      enforceWorkforceBoundary(db(true), actor, `/api/v1${path}`, method),
    ).resolves.toBeUndefined();
    await expect(
      enforceWorkforceBoundary(db(false), actor, `/api/v1${path}`, method),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      enforceWorkforceBoundary(
        db(true),
        { ...actor, mfaVerifiedAt: null },
        `/api/v1${path}`,
        method,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each([
    "/staff/refunds/export",
    `/staff/refunds/${id}/check/export`,
    "/staff/refunds-admin",
    "/staff/disputes/export",
    `/staff/disputes/${id}/delete`,
    "/staff/finance-policy/current/export",
    "/staff/payments",
    "/staff/bookings",
    "/admin/operations/payment-refunds",
    "/admin/capabilities",
    "/staff/privacy-requests/export",
    "/staff/privacy-requests/%252freview",
  ])("does not exempt neighbouring or broad paths: %s", async (path) => {
    for (const method of ["GET", "POST", "DELETE", "PATCH"])
      await expect(
        enforceWorkforceBoundary(db(true), actor, `/api/v1${path}`, method),
      ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not permit an unsupported verb on a recognised read endpoint", async () => {
    await expect(
      enforceWorkforceBoundary(db(true), actor, "/api/v1/staff/refunds", "DELETE"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
