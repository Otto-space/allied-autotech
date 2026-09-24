import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { refundQueueSelect } from "../payments/refund-record.js";
import type {
  AnomalyListQuery,
  AuditListQuery,
  DisputeListQuery,
  RefundListQuery,
  OperationalJobsQuery,
} from "./audit.schemas.js";

export class AuditRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  list(query: AuditListQuery) {
    return this.database.auditLog.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.requestId ? { requestId: query.requestId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        requestId: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
        user: { select: { role: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  async jobs(query: OperationalJobsQuery) {
    const take = query.limit + 1;
    const outbox =
      query.source === "PAYMENT_WEBHOOK"
        ? []
        : await this.database.outboxEvent.findMany({
            where: {
              status: query.status ?? { in: ["FAILED", "DEAD_LETTER", "PROCESSING"] },
            },
            select: {
              id: true,
              eventId: true,
              aggregateType: true,
              aggregateId: true,
              eventType: true,
              status: true,
              attempts: true,
              availableAt: true,
              lockedAt: true,
              lastError: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take,
          });
    const webhook =
      query.source === "OUTBOX"
        ? []
        : await this.database.paymentWebhookEvent.findMany({
            where: {
              status: query.status ?? { in: ["FAILED", "DEAD_LETTER", "PROCESSING"] },
            },
            select: {
              id: true,
              eventType: true,
              status: true,
              processingAttempts: true,
              nextAttemptAt: true,
              lockedAt: true,
              lastErrorCode: true,
              lastErrorMessage: true,
              receivedAt: true,
              updatedAt: true,
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take,
          });
    return [
      ...outbox.map((item) => ({ source: "OUTBOX" as const, ...item })),
      ...webhook.map((item) => ({ source: "PAYMENT_WEBHOOK" as const, ...item })),
    ]
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, take);
  }

  anomalies(query: AnomalyListQuery) {
    return this.database.paymentAnomaly.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      select: {
        id: true,
        paymentId: true,
        paymentAttemptId: true,
        refundId: true,
        disputeId: true,
        type: true,
        status: true,
        summary: true,
        detectedAt: true,
        resolvedAt: true,
        resolutionNote: true,
        resolvedByUserId: true,
        updatedAt: true,
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  disputes(query: DisputeListQuery) {
    return this.database.paymentDispute.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      select: {
        id: true,
        paymentAttemptId: true,
        provider: true,
        providerDisputeId: true,
        status: true,
        category: true,
        amountKobo: true,
        currency: true,
        responseDueAt: true,
        openedAt: true,
        respondedAt: true,
        resolvedAt: true,
        evidenceSha256: true,
        updatedAt: true,
      },
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  refunds(query: RefundListQuery) {
    return this.database.refund.findMany({
      where: query.status ? { status: query.status } : {},
      select: refundQueueSelect,
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  queueCounts() {
    return this.database.$queryRaw<
      Array<{ queue: string; status: string; count: bigint }>
    >(Prisma.sql`
      SELECT 'outbox' AS queue, "status"::text AS status, count(*)::bigint AS count
      FROM "OutboxEvent" GROUP BY "status"
      UNION ALL
      SELECT 'payment_webhook' AS queue, "status"::text AS status, count(*)::bigint AS count
      FROM "PaymentWebhookEvent" GROUP BY "status"
      UNION ALL
      SELECT 'notification_delivery' AS queue, "status"::text AS status, count(*)::bigint AS count
      FROM "NotificationDelivery" GROUP BY "status"
    `);
  }
}
