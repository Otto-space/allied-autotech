import type { Prisma } from "../../generated/prisma/client.js";
import {
  assignmentAllows,
  supportedAssignmentPolicies,
} from "../organization/workforce-catalogue.js";

/** A resource plan cannot grant or restore a revoked workshop duty. */
export function eligibleWorkshopTechnicianWhere(
  branchId: string,
  now: Date,
): Prisma.StaffProfileWhereInput {
  const pairs = supportedAssignmentPolicies().filter((pair) =>
    assignmentAllows(pair, "JOBS_UPDATE"),
  );
  return {
    user: {
      role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
    },
    OR: [
      { branchId, user: { workforceAccess: { is: null } } },
      {
        user: {
          workforceAccess: {
            is: {
              assignments: {
                some: {
                  branchId,
                  branch: { isActive: true },
                  revokedAt: null,
                  startsAt: { lte: now },
                  AND: [
                    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                    { OR: pairs },
                  ],
                },
              },
            },
          },
        },
      },
    ],
  };
}
