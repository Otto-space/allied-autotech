import type { OperationalJobPosition } from "./operational-job-cursor.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { refundQueueSelect } from "../payments/refund-record.js";
import { anomalySelect } from "./anomaly-record.js";
import { outboxJobSelect, webhookJobSelect } from "./operational-job-record.js";
import type {
  AnomalyListQuery,
  AuditListQuery,
  DisputeListQuery,
  RefundListQuery,
  OperationalJobsQuery,
} from "./audit.schemas.js";

export class AuditRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  list(
    query: AuditListQuery,
    client: Prisma.TransactionClient | PrismaClient = this.database,
  ) {
    return client.auditLog.findMany({
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

  async jobs(
    query: OperationalJobsQuery,
    after?: OperationalJobPosition,
    client: Prisma.TransactionClient | PrismaClient = this.database,
  ) {
    const take = query.limit + 1;
    const boundary = (source: OperationalJobPosition["source"]) =>
      after
        ? {
            OR: [
              { updatedAt: { lt: new Date(after.updatedAt) } },
              {
                updatedAt: new Date(after.updatedAt),
                id: source < after.source ? { lte: after.id } : { lt: after.id },
              },
            ],
          }
        : {};
    const outbox =
      query.source === "PAYMENT_WEBHOOK"
        ? []
        : await client.outboxEvent.findMany({
            where: {
              ...boundary("OUTBOX"),
              status: query.status ?? { in: ["FAILED", "DEAD_LETTER", "PROCESSING"] },
            },
            select: outboxJobSelect,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take,
          });
    const webhook =
      query.source === "OUTBOX"
        ? []
        : await client.paymentWebhookEvent.findMany({
            where: {
              ...boundary("PAYMENT_WEBHOOK"),
              status: query.status ?? { in: ["FAILED", "DEAD_LETTER", "PROCESSING"] },
            },
            select: webhookJobSelect,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take,
          });
    return [
      ...outbox.map((item) => ({ source: "OUTBOX" as const, ...item, lastError: null })),
      ...webhook.map((item) => ({
        source: "PAYMENT_WEBHOOK" as const,
        ...item,
        lastErrorCode: null,
        lastErrorMessage: null,
      })),
    ]
      .sort(
        (left, right) =>
          right.updatedAt.getTime() - left.updatedAt.getTime() ||
          (left.id === right.id
            ? left.source < right.source
              ? 1
              : left.source > right.source
                ? -1
                : 0
            : left.id < right.id
              ? 1
              : -1),
      )
      .slice(0, take);
  }

  async job(source: "outbox" | "webhook", id: string, client: Prisma.TransactionClient) {
    if (source === "outbox") {
      const record = await client.outboxEvent.findUnique({
        where: { id },
        select: { ...outboxJobSelect, publishedAt: true },
      });
      return record ? { ...record, source: "OUTBOX" as const } : null;
    }
    const record = await client.paymentWebhookEvent.findUnique({
      where: { id },
      select: { ...webhookJobSelect, processedAt: true, failedAt: true },
    });
    return record ? { ...record, source: "PAYMENT_WEBHOOK" as const } : null;
  }

  anomalies(query: AnomalyListQuery) {
    return this.database.paymentAnomaly.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      select: anomalySelect,
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
        chargebackAmountKobo: true,
        providerStatus: true,
        providerResolution: true,
        providerReviewReason: true,
        providerUpdatedAt: true,
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
