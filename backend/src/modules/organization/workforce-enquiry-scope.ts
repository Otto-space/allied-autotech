import type { Prisma } from "../../generated/prisma/client.js";
import { workforceDenied, type WorkforceSnapshot } from "./workforce.policy.js";
import { assignmentAllows } from "./workforce-catalogue.js";

export function enquiryScope(snapshot: WorkforceSnapshot): Prisma.EnquiryWhereInput {
  const assignments = snapshot.assignments.filter(
    (a) =>
      assignmentAllows(a, "CUSTOMER_ENQUIRIES") || assignmentAllows(a, "SALES_ENQUIRIES"),
  );
  if (!assignments.length) workforceDenied();
  return {
    OR: assignments.map((a) => ({
      branchId: a.branchId,
      ...(assignmentAllows(a, "CUSTOMER_ENQUIRIES")
        ? {}
        : { type: { in: ["PRODUCT", "VEHICLE"] as ("PRODUCT" | "VEHICLE")[] } }),
      ...(a.scope === "ASSIGNED"
        ? { assignedStaffId: snapshot.staffId ?? "00000000-0000-0000-0000-000000000000" }
        : {}),
    })),
  };
}
