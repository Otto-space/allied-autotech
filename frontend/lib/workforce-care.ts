import type { WorkforceAccess } from "./api/workforce-schemas";
import { workforceAllows, type WorkforceRecordScope } from "./workforce-registry";

export function currentWorkforceAssignment(
  assignment: WorkforceAccess["assignments"][number],
  access: WorkforceAccess,
) {
  const version = assignment.templateVersion ?? 1;
  return (
    assignment.userId === access.userId &&
    assignment.revokedAt === null &&
    [1, 2].includes(version) &&
    (!assignment.template.startsWith("CARE_") || version === 2) &&
    Date.parse(assignment.startsAt) <= Date.parse(access.serverTime) &&
    (assignment.expiresAt === null ||
      Date.parse(assignment.expiresAt) > Date.parse(access.serverTime))
  );
}

/** UI consumes current server permissions and matching owned branch assignments.
 * New Care duties require the modern scope projection. Every API remains final.
 * Live eligibility never promises online staffing or functioning transport.
 */
export function careCaseAllows(
  access: WorkforceAccess,
  kind: "ENQUIRY" | "COMPLAINT",
  action: "view" | "reply" | "assign" | "live",
  record: WorkforceRecordScope,
) {
  if (!access.managed || !record.branchId) return false;
  const has = (capability: string, template: string, modern = false) =>
    (!modern || (!!access.accessRevision && !!access.capabilityScopes)) &&
    workforceAllows(access, { all: [capability], scope: "responsibility" }, record) &&
    access.assignments.some(
      (a) =>
        currentWorkforceAssignment(a, access) &&
        a.branchId === record.branchId &&
        a.template === template &&
        a.scope === "BRANCH" &&
        (!modern || a.templateVersion === 2),
    );
  const legacy = has(
    kind === "ENQUIRY" ? "CUSTOMER_ENQUIRIES" : "COMPLAINTS",
    "CUSTOMER_SERVICE",
  );
  const view = legacy || has("CARE_CASE_VIEW", "CARE_VIEWER", true);
  if (action === "view") return view;
  if (action === "assign") return view && has("CARE_CASE_ASSIGN", "CARE_ASSIGNER", true);
  const reply = legacy || (view && has("CARE_PUBLIC_REPLY", "CARE_RESPONDER", true));
  return action === "reply"
    ? reply
    : reply && has("CARE_LIVE_ACCEPT", "CARE_LIVE_AGENT", true);
}
