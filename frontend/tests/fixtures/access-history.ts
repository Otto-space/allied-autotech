import type { AuditEvent } from "@/lib/api/audit-schemas";
import { id } from "./work-invoices";
export function accessHistoryRows(): AuditEvent[] {
  const values = [
    {
      workforceAction: "ASSIGN",
      template: "CUSTOMER_SERVICE",
      templateVersion: 1,
      scope: "BRANCH",
      temporary: true,
      branchId: id(101),
      startsAt: "2026-11-13T08:00:00Z",
      expiresAt: "2026-11-14T08:00:00Z",
      reason: "Synthetic recorded cover reason",
      proof: false,
      count: 0,
    },
    {
      workforceAction: "REVOKE",
      template: "MECHANICAL_TECHNICIAN",
      templateVersion: 1,
      branchId: id(101),
      reason: "Synthetic removed duty",
    },
    {
      workforceAction: "ENROLL_OR_UPDATE_POSITION",
      position: "CUSTOMER_SERVICE",
      legacyAccessReplaced: false,
    },
    { role: "ADMIN" },
    { role: "ADMIN" },
    { revoked: true },
  ];
  return values.map((newValues, index) => ({
    id: id(300100 + index),
    userId: id(303),
    user: { role: "ADMIN" },
    action: index === 3 ? "ROLE_CHANGE" : index === 4 ? "INVITATION_CREATED" : "UPDATE",
    entityType: index >= 4 ? "PRIVILEGED_INVITATION" : "USER",
    entityId: index >= 4 ? id(310100 + index) : id(310000),
    requestId: "synthetic-history",
    createdAt: new Date(Date.parse("2026-11-13T10:00:00Z") - index * 1000).toISOString(),
    oldValues: index === 3 ? { role: "STAFF" } : null,
    newValues,
    currentContext: {
      actor: { id: id(303), name: "Current Operator", role: "ADMIN" },
      subject: { id: id(310000), name: "Current Person", role: "STAFF" },
      branches: index < 2 ? [{ id: id(101), name: "Current workshop name" }] : [],
    },
  }));
}
