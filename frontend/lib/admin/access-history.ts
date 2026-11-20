import { z } from "zod";
import type { AuditEvent } from "@/lib/api/audit-schemas";
import { workforceTemplateLabels } from "@/lib/api/workforce-schemas";
import { workforcePositionLabels } from "@/lib/api/workforce-positions";
import { formatBusinessDate } from "@/lib/format/date";

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const workforceChanges = ["ENROLL_OR_UPDATE_POSITION", "ASSIGN", "REVOKE", "DELEGATION"];
export function accessChangeKind(event: AuditEvent): string | undefined {
  const next = object(event.newValues);
  if (event.entityType === "USER") {
    if (event.action === "ROLE_CHANGE") return "ROLE_CHANGE";
    if (
      event.action === "UPDATE" &&
      typeof next.workforceAction === "string" &&
      workforceChanges.includes(next.workforceAction)
    )
      return next.workforceAction;
  }
  if (event.entityType === "STAFF_PROFILE" && event.action === "BRANCH_ASSIGNED")
    return "BRANCH_ASSIGNED";
  if (event.entityType === "PRIVILEGED_INVITATION") {
    if (event.action === "INVITATION_CREATED" || event.action === "INVITATION_ACCEPTED")
      return event.action;
    if (event.action === "UPDATE" && next.revoked === true) return "INVITATION_CANCELLED";
  }
}
const missing = "Not recorded in this event";
const roleNames: Record<string, string> = {
  CUSTOMER: "Customer",
  STAFF: "Staff",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Admin",
};
const role = (value: unknown) =>
  typeof value === "string"
    ? Object.hasOwn(roleNames, value)
      ? roleNames[value]!
      : "Unrecognised account level; see recorded values"
    : missing;
export function recordedAccessBranchIds(event: AuditEvent) {
  return [
    ...new Set(
      [object(event.oldValues), object(event.newValues)]
        .flatMap((value) => [
          value.branchId,
          ...(typeof value.branchIds === "string"
            ? value.branchIds.split(",").slice(0, 20)
            : []),
        ])
        .filter(
          (value): value is string =>
            typeof value === "string" && z.uuid().safeParse(value).success,
        ),
    ),
  ];
}
const position = (value: unknown) =>
  typeof value === "string" && Object.hasOwn(workforcePositionLabels, value)
    ? workforcePositionLabels[value as keyof typeof workforcePositionLabels]
    : value === null
      ? "No earlier position recorded"
      : missing;
function duty(value: unknown, version: unknown) {
  if (
    (version !== 1 && version !== 2) ||
    typeof value !== "string" ||
    !Object.hasOwn(workforceTemplateLabels, value) ||
    (version === 1 && value.startsWith("CARE_"))
  )
    return "Recorded duty definition unavailable; see recorded values";
  return workforceTemplateLabels[value as keyof typeof workforceTemplateLabels];
}
function date(value: unknown) {
  if (value === undefined) return missing;
  if (value === null) return "No end date recorded";
  return z.iso.datetime({ offset: true }).safeParse(value).success
    ? formatBusinessDate(String(value))
    : "Recorded date unavailable; see recorded values";
}
export function accessChangeSummary(event: AuditEvent) {
  const kind = accessChangeKind(event);
  if (!kind) return undefined;
  const before = object(event.oldValues),
    next = object(event.newValues);
  const branch = (value: unknown) => {
    if (value === null) return "No branch";
    if (typeof value !== "string" || !z.uuid().safeParse(value).success) return missing;
    const current = event.currentContext?.branches.find((row) => row.id === value);
    return current
      ? `${current.name} (current name)`
      : "Recorded branch reference in event details";
  };
  const facts: { label: string; value: string }[] = [];
  let title: string, explanation: string;
  switch (kind) {
    case "ASSIGN":
    case "REVOKE":
      title =
        kind === "REVOKE"
          ? "Duty removed"
          : next.temporary === true
            ? "Temporary cover added"
            : "Duty added";
      explanation =
        kind === "REVOKE"
          ? "This assignment was removed. Other duties or account-level access may remain."
          : "A duty assignment was recorded. Its recorded dates and scope determine when and where it applies.";
      facts.push(
        { label: "Duty", value: duty(next.template, next.templateVersion) },
        { label: "Branch", value: branch(next.branchId) },
        {
          label: "Where it applies",
          value:
            next.scope === "BRANCH"
              ? "Permitted work in the recorded branch"
              : next.scope === "ASSIGNED"
                ? "Assigned records in the recorded branch"
                : missing,
        },
        { label: "Starts", value: date(next.startsAt) },
        { label: "Ends", value: date(next.expiresAt) },
      );
      break;
    case "ENROLL_OR_UPDATE_POSITION":
      title =
        next.legacyAccessReplaced === true
          ? "Managed duty setup created"
          : next.legacyAccessReplaced === false
            ? "Job position changed"
            : "Job position or duty setup recorded";
      explanation =
        "A job position does not automatically grant duties. This event is not a complete account-access summary.";
      facts.push(
        { label: "Earlier position", value: position(next.previousPosition) },
        { label: "Recorded position", value: position(next.position) },
        {
          label: "Sessions",
          value:
            next.sessionEffect === "REVOKED"
              ? "Existing sessions revoked"
              : next.sessionEffect === "KEPT"
                ? "Existing sessions kept"
                : missing,
        },
      );
      break;
    case "DELEGATION": {
      title = "Authority to manage duties changed";
      explanation =
        "Management authority was recorded separately from the person's own work duties.";
      const templates =
        typeof next.templates === "string"
          ? next.templates.split(",").filter(Boolean)
          : undefined;
      facts.push(
        {
          label: "Duties they may manage",
          value: templates
            ? templates
                .map((value) =>
                  value === "ADMIN_INVITE"
                    ? "Administrator invitations"
                    : duty(value, next.delegationPolicyVersion),
                )
                .join(", ") || "None recorded"
            : missing,
        },
        {
          label: "Administrator invitation authority",
          value:
            next.allowAdminInvitations === true
              ? "Allowed in the recorded management scope"
              : next.allowAdminInvitations === false
                ? "Not allowed by this change"
                : missing,
        },
      );
      const ids =
        typeof next.branchIds === "string"
          ? next.branchIds.split(",").filter(Boolean)
          : undefined;
      facts.push({
        label: "Management branches",
        value: ids ? ids.map(branch).join(", ") || "None recorded" : missing,
      });
      break;
    }
    case "ROLE_CHANGE":
      title = "Account level changed";
      explanation =
        "These are the account levels recorded at the time. Check the current account before relying on earlier access.";
      facts.push(
        { label: "Before", value: role(before.role) },
        { label: "After", value: role(next.role) },
      );
      break;
    case "BRANCH_ASSIGNED":
      title = "Staff branch changed";
      explanation =
        "The account's branch assignment changed. Any names below are current branch names.";
      facts.push(
        { label: "Before", value: branch(before.branchId) },
        { label: "After", value: branch(next.branchId) },
      );
      break;
    case "INVITATION_CREATED":
      title = "Access invitation created";
      explanation =
        "Creation does not prove email delivery, acceptance or current administrator access.";
      facts.push({ label: "Proposed account level", value: role(next.role) });
      break;
    case "INVITATION_ACCEPTED":
      title = "Access invitation accepted";
      explanation =
        "Acceptance was recorded at this time. The person's current access may have changed.";
      break;
    default:
      title = "Unused invitation cancelled";
      explanation =
        "The unused link was cancelled. This action does not remove existing account access.";
  }
  const reason =
    typeof next.reason === "string" && next.reason.trim() ? next.reason : undefined;
  return {
    title,
    explanation,
    facts,
    reason:
      reason &&
      (reason.length > 2000
        ? `${reason.slice(0, 2000)}… Full text is in Recorded values.`
        : reason),
  };
}
