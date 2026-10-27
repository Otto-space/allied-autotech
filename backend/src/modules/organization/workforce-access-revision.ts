import { definitionForAssignment } from "./workforce-catalogue.js";
import {
  accessPreviewFingerprint,
  type GrantAssignment,
} from "./workforce-effective-access.js";

export function workforceCapabilityScopes(assignments: readonly GrantAssignment[]) {
  const rows = new Map<
    string,
    { capability: string; branchId: string; scope: "BRANCH" | "ASSIGNED" }
  >();
  for (const assignment of assignments) {
    const definition = definitionForAssignment(assignment);
    if (!definition) continue;
    for (const capability of definition.actions) {
      const key = `${capability}:${assignment.branchId}`;
      const previous = rows.get(key);
      rows.set(key, {
        capability,
        branchId: assignment.branchId,
        scope: previous?.scope === "BRANCH" ? "BRANCH" : definition.scope,
      });
    }
  }
  return [...rows.values()].sort((a, b) => {
    const first = `${a.branchId}:${a.capability}`,
      second = `${b.branchId}:${b.capability}`;
    return first < second ? -1 : first > second ? 1 : 0;
  });
}

/** Opaque invalidation proof, never a bearer credential or record-access grant. */
export function workforceAccessRevision(value: {
  userId: string;
  role: string;
  managed: boolean;
  staffId: string | null;
  version: number;
  assignments: readonly GrantAssignment[];
  canManageAssignments: boolean;
  canInviteAdmins: boolean;
  delegation?:
    | {
        policyVersion: number;
        templates: readonly string[];
        branchIds: readonly string[];
      }
    | undefined;
  independentCapabilities?: readonly string[];
}) {
  return accessPreviewFingerprint({
    userId: value.userId,
    role: value.role,
    managed: value.managed,
    staffId: value.staffId,
    version: value.version,
    independentCapabilities: [...(value.independentCapabilities ?? [])].sort(),
    assignments: value.assignments
      .map((a) => ({
        id: a.id,
        template: a.template,
        templateVersion: a.templateVersion,
        scope: a.scope,
        branchId: a.branchId,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    canManageAssignments: value.canManageAssignments,
    canInviteAdmins: value.canInviteAdmins,
    delegation: value.delegation && {
      policyVersion: value.delegation.policyVersion,
      templates: [...value.delegation.templates].sort(),
      branchIds: [...value.delegation.branchIds].sort(),
    },
  });
}
