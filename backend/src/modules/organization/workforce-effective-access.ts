import { createHash } from "node:crypto";
import { definitionForAssignment, type WorkforceAction } from "./workforce-catalogue.js";

export const workforceActionLabels: Record<WorkforceAction, string> = {
  BOOKINGS_READ: "View bookings",
  ORDERS_READ: "View order progress",
  ORDERS_PREPARE: "Prepare paid orders",
  FITMENT_AUTHOR: "Prepare fitment evidence",
  FITMENT_REVIEW: "Independently review fitment evidence",
  CUSTOMER_ENQUIRIES: "Handle Customer Care enquiries",
  COMPLAINTS: "Handle complaints",
  SALES_ENQUIRIES: "Handle sales enquiries",
  ENQUIRIES_ASSIGN: "Assign sales enquiries",
  FINANCE_READ: "View scoped payment records",
  JOBS_READ: "View workshop jobs",
  JOBS_ASSIGN: "Assign workshop jobs",
  JOBS_UPDATE: "Record workshop work",
  QUALITY_APPROVE: "Independently approve workshop quality",
};
export type GrantAssignment = {
  id: string;
  template: string;
  templateVersion: number;
  scope: string;
  branchId: string;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
export type GrantVisibility = {
  branches: readonly { id: string; name: string; isActive: boolean }[];
  eligible: boolean;
  // null is the owner's full responsibility view. Delegated views are bounded
  // by BOTH capability and branch; hidden sources may explain overlap without
  // disclosing their identifiers, templates, dates or other branch details.
  capabilities: ReadonlySet<WorkforceAction> | null;
  maximumScopes?: ReadonlyMap<WorkforceAction, "BRANCH" | "ASSIGNED">;
  visibleAssignmentIds: ReadonlySet<string>;
};
export type EffectiveGrant = {
  capability: WorkforceAction;
  label: string;
  branch: { id: string; name: string };
  scope: "BRANCH" | "ASSIGNED";
  sources: {
    assignmentId: string | null;
    label: string;
    scope: "BRANCH" | "ASSIGNED";
    kind: "ASSIGNMENT" | "PROPOSED" | "OTHER";
  }[];
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The same pinned definitions and active-time rules as the operational policy.
 * Branch scope covers assigned work in that branch; two branches never combine
 * into company scope. Display titles, unknown policies and future/expired grants
 * supply nothing. This projection does not itself authorize an operation.
 */
export function effectiveWorkforceGrants(
  assignments: readonly GrantAssignment[],
  visibility: GrantVisibility,
  at: Date,
  proposedId?: string,
): EffectiveGrant[] {
  if (!visibility.eligible) return [];
  const rows = new Map<string, EffectiveGrant>();
  for (const assignment of assignments) {
    const definition = definitionForAssignment(assignment);
    const branch = visibility.branches.find(
      (b) => b.id === assignment.branchId && b.isActive,
    );
    if (
      !definition ||
      !branch ||
      assignment.revokedAt ||
      assignment.startsAt > at ||
      (assignment.expiresAt && assignment.expiresAt <= at)
    )
      continue;
    for (const capability of definition.actions) {
      if (visibility.capabilities && !visibility.capabilities.has(capability)) continue;
      const scope =
        visibility.maximumScopes?.get(capability) === "ASSIGNED"
          ? "ASSIGNED"
          : definition.scope;
      const key = `${capability}:${branch.id}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          capability,
          label: workforceActionLabels[capability],
          branch: { id: branch.id, name: branch.name },
          scope,
          sources: [],
        };
        rows.set(key, row);
      }
      if (scope === "BRANCH") row.scope = "BRANCH";
      const proposed = assignment.id === proposedId;
      const visible = visibility.visibleAssignmentIds.has(assignment.id);
      row.sources.push({
        assignmentId: visible && !proposed ? assignment.id : null,
        label: proposed || visible ? definition.label : "Another active responsibility",
        scope,
        kind: proposed ? "PROPOSED" : visible ? "ASSIGNMENT" : "OTHER",
      });
    }
  }
  return [...rows.values()]
    .sort((a, b) =>
      compare(`${a.branch.id}:${a.capability}`, `${b.branch.id}:${b.capability}`),
    )
    .map((row) => ({
      ...row,
      sources: row.sources.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))),
    }));
}

export function workforceGrantChanges(before: EffectiveGrant[], after: EffectiveGrant[]) {
  const key = (r: EffectiveGrant) => `${r.capability}:${r.branch.id}`;
  const previous = new Map(before.map((r) => [key(r), r]));
  const next = new Map(after.map((r) => [key(r), r]));
  const added: EffectiveGrant[] = [],
    removed: EffectiveGrant[] = [],
    retained: EffectiveGrant[] = [];
  for (const row of before) {
    const remaining = next.get(key(row));
    if (!remaining) removed.push(row);
    else if (row.scope === "BRANCH" && remaining.scope === "ASSIGNED")
      removed.push({
        ...row,
        sources: row.sources.filter((source) => source.scope === "BRANCH"),
      });
    if (remaining)
      retained.push({
        ...remaining,
        scope: row.scope === "ASSIGNED" ? "ASSIGNED" : remaining.scope,
      });
  }
  for (const row of after) {
    const prior = previous.get(key(row));
    if (!prior) added.push(row);
    else if (prior.scope === "ASSIGNED" && row.scope === "BRANCH")
      added.push({
        ...row,
        sources: row.sources.filter((source) => source.scope === "BRANCH"),
      });
  }
  return { added, removed, retained };
}

export function accessPreviewFingerprint(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => compare(a, b)))
      : item,
  );
  return createHash("sha256").update(canonical).digest("hex");
}
