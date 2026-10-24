import type { Prisma } from "../../generated/prisma/client.js";
import { workforceDenied, type WorkforceSnapshot } from "./workforce.policy.js";

export function enquiryScope(snapshot: WorkforceSnapshot): Prisma.EnquiryWhereInput {
  const assignments = snapshot.assignments.filter((a) =>
    ["CUSTOMER_SERVICE", "SALES_SUPERVISOR", "SALES_CASHIER"].includes(a.template),
  );
  if (!assignments.length) workforceDenied();
  return {
    OR: assignments.map((a) => ({
      branchId: a.branchId,
      ...(a.template === "CUSTOMER_SERVICE"
        ? {}
        : { type: { in: ["PRODUCT", "VEHICLE"] as ("PRODUCT" | "VEHICLE")[] } }),
      ...(a.scope === "ASSIGNED"
        ? { assignedStaffId: snapshot.staffId ?? "00000000-0000-0000-0000-000000000000" }
        : {}),
    })),
  };
}
