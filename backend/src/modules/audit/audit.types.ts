import type { AuditAction, AuditEntityType } from "../../generated/prisma/enums.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";

export type AuditValue = string | number | boolean | null;

export interface AppendAuditEvent {
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  oldValues?: Readonly<Record<string, AuditValue>>;
  newValues?: Readonly<Record<string, AuditValue>>;
  context: RequestSecurityContext;
}
