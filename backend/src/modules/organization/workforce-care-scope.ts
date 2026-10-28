import type { Prisma } from "../../generated/prisma/client.js";
import {
  branchesFor,
  workforceDenied,
  type WorkforceSnapshot,
} from "./workforce.policy.js";

export type WorkforceCareKind = "ENQUIRY" | "COMPLAINT";
export type WorkforceCareAction = "view" | "reply" | "assign" | "live";

/** Preserve the historical case powers of v1 duties. New duties intersect on
 * the actual branch; a global union of view and action permissions is insufficient.
 * Live authority is only eligibility, never staffing, presence or transport readiness.
 */
export function careBranchesFor(
  access: WorkforceSnapshot,
  kind: WorkforceCareKind,
  action: WorkforceCareAction = "view",
): string[] {
  const legacy = branchesFor(
    access,
    kind === "ENQUIRY" ? "CUSTOMER_ENQUIRIES" : "COMPLAINTS",
  );
  const view = [...new Set([...legacy, ...branchesFor(access, "CARE_CASE_VIEW")])];
  if (action === "view") return view;
  if (action === "assign")
    return view.filter((id) => branchesFor(access, "CARE_CASE_ASSIGN").includes(id));
  const reply = [
    ...new Set([
      ...legacy,
      ...view.filter((id) => branchesFor(access, "CARE_PUBLIC_REPLY").includes(id)),
    ]),
  ];
  return action === "reply"
    ? reply
    : reply.filter((id) => branchesFor(access, "CARE_LIVE_ACCEPT").includes(id));
}

export function complaintScope(
  access: WorkforceSnapshot,
  action: WorkforceCareAction = "view",
): Prisma.ComplaintWhereInput {
  const branches = careBranchesFor(access, "COMPLAINT", action);
  if (!branches.length) workforceDenied();
  return { branchId: { in: branches } };
}
