import type { Prisma } from "../../generated/prisma/client.js";
import type { AppendAuditEvent } from "./audit.types.js";

export async function appendAuditEvent(
  transaction: Prisma.TransactionClient,
  event: AppendAuditEvent,
): Promise<void> {
  await transaction.auditLog.create({
    data: {
      userId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: event.context.requestId.slice(0, 100),
      ipAddress: event.context.ipAddress,
      userAgent: event.context.userAgent?.slice(0, 512) ?? null,
      ...(event.oldValues === undefined ? {} : { oldValues: { ...event.oldValues } }),
      ...(event.newValues === undefined ? {} : { newValues: { ...event.newValues } }),
    },
  });
}
