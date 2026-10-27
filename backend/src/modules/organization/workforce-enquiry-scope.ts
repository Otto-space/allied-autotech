import type { Prisma } from "../../generated/prisma/client.js";
import { workforceDenied, type WorkforceSnapshot } from "./workforce.policy.js";
import { assignmentAllows } from "./workforce-catalogue.js";
import { careBranchesFor } from "./workforce-care-scope.js";

export function enquiryScope(
  snapshot: WorkforceSnapshot,
  action: "view" | "reply" | "assign" = "view",
): Prisma.EnquiryWhereInput {
  const care = careBranchesFor(snapshot, "ENQUIRY", action);
  const assignments = snapshot.assignments.filter((a) =>
    assignmentAllows(a, action === "assign" ? "ENQUIRIES_ASSIGN" : "SALES_ENQUIRIES"),
  );
  if (!assignments.length && !care.length) workforceDenied();
  return {
    OR: [
      ...(care.length ? [{ branchId: { in: care } }] : []),
      ...assignments.map((a) => ({
        branchId: a.branchId,
        type: { in: ["PRODUCT", "VEHICLE"] as ("PRODUCT" | "VEHICLE")[] },
        ...(a.scope === "ASSIGNED"
          ? {
              assignedStaffId: snapshot.staffId ?? "00000000-0000-0000-0000-000000000000",
            }
          : {}),
      })),
    ],
  };
}
