import type { WorkforceAccess } from "../../lib/api/workforce-schemas";
import {
  workforceCapabilityScopes,
  workforceAccessRevision,
} from "../../../backend/src/modules/organization/workforce-access-revision";
export const aftercareId = (n: number) =>
  `bc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function aftercareSnapshot(access: WorkforceAccess, role: "STAFF" | "ADMIN") {
  const assignments = access.assignments.map((a) => ({
    ...a,
    templateVersion: a.templateVersion ?? 1,
    startsAt: new Date(a.startsAt),
    expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
    revokedAt: a.revokedAt ? new Date(a.revokedAt) : null,
  }));
  return {
    ...access,
    serverTime: new Date().toISOString(),
    nextChangeAt: null,
    capabilityScopes: workforceCapabilityScopes(assignments).filter((g) =>
      access.permissions.includes(g.capability),
    ),
    accessRevision: workforceAccessRevision({ ...access, assignments, role }),
  };
}
export function aftercareFixtureData(
  owner = aftercareId(1),
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const stamp = "2026-10-19T08:00:00.000Z";
  const access: WorkforceAccess = {
    managed: true,
    userId: owner,
    staffId: aftercareId(2),
    position: "ACCOUNTANT",
    department: "Accounts",
    version: 1,
    permissions: ["FINANCE_READ"],
    independentCapabilities: ["FINANCE_POLICY_APPROVE"],
    canManageAssignments: false,
    canInviteAdmins: false,
    serverTime: stamp,
    assignments: [
      {
        id: aftercareId(3),
        userId: owner,
        template: "ACCOUNTANT",
        templateVersion: 1,
        branchId: aftercareId(4),
        scope: "BRANCH",
        temporary: false,
        startsAt: stamp,
        expiresAt: null,
        reason: "Synthetic isolated finance duty",
        assignedByUserId: aftercareId(5),
        createdAt: stamp,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
      },
    ],
  };
  Object.assign(access, aftercareSnapshot(access, role));
  const record = {
    id: aftercareId(1001),
    orderId: aftercareId(1002),
    kind: "RETURN",
    status: "INSPECTED",
    requestedAt: stamp,
    receivedAt: stamp as string | null,
    inspectedAt: stamp as string | null,
    reviewedAt: null as string | null,
    approvedFeeKobo: null as string | null,
    order: {
      id: aftercareId(1002),
      orderNumber: "SYNTHETIC-AFTERCARE-01",
      branchId: aftercareId(4),
      branch: { id: aftercareId(4), name: "Synthetic workshop" },
      currency: "NGN",
      totalKobo: "30000",
      confirmedAt: stamp as string | null,
      fulfillmentMethod: "COLLECTION",
    },
    reason: "Synthetic customer requested review of one damaged replacement filter",
    reviewReason: "SYNTHETIC_ONLY",
    inspectionNote: "Internal synthetic inspection evidence: packaging checked" as
      string | null,
    goodCondition: true as boolean | null,
    reviewNote: null as string | null,
    requestedItems: [
      {
        orderItemId: aftercareId(1003),
        quantity: 1,
        orderedQuantity: 3,
        productName: "Synthetic replacement filter",
      },
    ] as
      | {
          orderItemId: string;
          quantity: number;
          orderedQuantity: number;
          productName: string;
        }[]
      | null,
    policy: {
      id: aftercareId(1004),
      key: "cancellation",
      version: 1,
      approvalStatus: "APPROVED",
      source: "Synthetic reviewed policy evidence for isolated testing",
      effectiveAt: stamp,
    } as {
      id: string;
      key: string;
      version: number;
      approvalStatus: string;
      source: string;
      effectiveAt: string;
    } | null,
    reviewEvidenceReady: true,
    reviewRevision: "a".repeat(64),
  };
  return { access, record };
}
