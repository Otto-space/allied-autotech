import type { WorkforceAccess } from "../api/workforce-schemas";

export function sameWorkforceScope(current: WorkforceAccess, overview: WorkforceAccess) {
  return (
    current.managed &&
    overview.managed &&
    current.userId === overview.userId &&
    current.staffId === overview.staffId &&
    current.version === overview.version &&
    current.canManageAssignments === overview.canManageAssignments &&
    current.canInviteAdmins === overview.canInviteAdmins &&
    JSON.stringify([...current.permissions].sort()) ===
      JSON.stringify([...overview.permissions].sort()) &&
    JSON.stringify(current.assignments.map((a) => a.id).sort()) ===
      JSON.stringify(overview.assignments.map((a) => a.id).sort())
  );
}
