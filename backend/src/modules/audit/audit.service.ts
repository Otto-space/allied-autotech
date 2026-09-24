import type { Prisma } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { auditBadRequest, auditConflict, auditNotFound } from "./audit.errors.js";
import { assertAuditAdministrator } from "./audit.policy.js";
import { AuditRepository } from "./audit.repository.js";
import type {
  AnomalyListQuery,
  AnomalyUpdateInput,
  AuditListQuery,
  DisputeListQuery,
  RefundListQuery,
  OperationalJobsQuery,
  OperationalRetryInput,
} from "./audit.schemas.js";
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

function page<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, ...(rows.length > limit && last ? { nextCursor: last.id } : {}) };
}

export class AuditOperationsService {
  constructor(
    private readonly database = prisma,
    private readonly repository = new AuditRepository(database),
  ) {}

  async audit(
    actor: AuthenticatedActor,
    query: AuditListQuery,
    context: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    if (query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (from > to || to.getTime() - from.getTime() > 90 * 24 * 60 * 60_000)
        throw auditBadRequest(
          "Audit date range must be ordered and no longer than 90 days",
        );
    }
    const result = page(await this.repository.list(query), query.limit);
    await this.auditRead(
      actor,
      "USER",
      actor.userId,
      "AUDIT_LOG",
      result.items.length,
      context,
    );
    return result;
  }

  async jobs(
    actor: AuthenticatedActor,
    query: OperationalJobsQuery,
    context?: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    const result = page(await this.repository.jobs(query), query.limit);
    if (context)
      await this.auditRead(
        actor,
        "USER",
        actor.userId,
        "OPERATIONAL_JOBS",
        result.items.length,
        context,
      );
    return result;
  }

  async status(actor: AuthenticatedActor, context: RequestSecurityContext) {
    assertAuditAdministrator(actor);
    const [counts, lastReconciliation, anomalies] = await Promise.all([
      this.repository.queueCounts(),
      this.database.paymentReconciliationRun.findFirst({
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          differenceCount: true,
          completedAt: true,
          startedAt: true,
        },
        orderBy: { startedAt: "desc" },
      }),
      this.database.paymentAnomaly.count({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      }),
    ]);
    const heartbeats = await this.database.workerHeartbeat.findMany();
    const expectedWorkers: Array<[string, number]> = [
      ["identity-outbox", 600_000],
      ["notification-delivery", 600_000],
      ["payment-webhook-retry", 600_000],
      ["booking-reminders", 600_000],
      ["refunds", 600_000],
      ["expiration", Math.max(600_000, env.EXPIRATION_INTERVAL_MS * 2)],
      ["operational-alerts", Math.max(600_000, env.EXPIRATION_INTERVAL_MS * 2)],
      ...(env.PAYMENT_RECONCILIATION_ENABLED
        ? [
            [
              "payment-reconciliation",
              Math.max(600_000, env.RECONCILIATION_INTERVAL_MS * 2),
            ] as [string, number],
          ]
        : []),
    ];
    const result = {
      queues: counts.map((item) => ({ ...item, count: Number(item.count) })),
      openPaymentAnomalies: anomalies,
      lastReconciliation,
      operationalAlerts: await this.database.operationalAlert.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      workers: expectedWorkers.map(([name, staleAfterMs]) => {
        const worker = heartbeats.find((item) => item.name === name);
        return {
          name,
          ...worker,
          missing: !worker,
          staleAfterMs,
          overdue:
            !worker?.lastSucceededAt ||
            worker.lastSucceededAt.getTime() < Date.now() - staleAfterMs,
        };
      }),
    };
    await this.auditRead(
      actor,
      "USER",
      actor.userId,
      "OPERATIONAL_STATUS",
      counts.length,
      context,
    );
    return result;
  }

  async retryJob(
    actor: AuthenticatedActor,
    source: "outbox" | "webhook",
    id: string,
    input: OperationalRetryInput,
    context: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const changed =
        source === "outbox"
          ? await transaction.outboxEvent.updateMany({
              where: {
                id,
                attempts: input.expectedAttempts,
                status: { in: ["FAILED", "DEAD_LETTER"] },
              },
              data: {
                status: "PENDING",
                availableAt: new Date(),
                lockedAt: null,
                lastError: null,
              },
            })
          : await transaction.paymentWebhookEvent.updateMany({
              where: {
                id,
                processingAttempts: input.expectedAttempts,
                status: { in: ["FAILED", "DEAD_LETTER"] },
              },
              data: {
                status: "RECEIVED",
                nextAttemptAt: new Date(),
                lockedAt: null,
                failedAt: null,
                lastErrorCode: null,
                lastErrorMessage: null,
              },
            });
      if (changed.count !== 1) throw auditConflict();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: source === "webhook" ? "PAYMENT" : "USER",
        entityId: id,
        oldValues: { status: "FAILED_OR_DEAD_LETTER", attempts: input.expectedAttempts },
        newValues: { status: "RETRY_REQUESTED", reason: input.reason },
        context,
      });
      return { id, source, status: "RETRY_REQUESTED", attempts: input.expectedAttempts };
    });
  }

  async anomalies(
    actor: AuthenticatedActor,
    query: AnomalyListQuery,
    context?: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    const result = page(await this.repository.anomalies(query), query.limit);
    if (context)
      await this.auditRead(
        actor,
        "PAYMENT",
        null,
        "PAYMENT_ANOMALIES",
        result.items.length,
        context,
      );
    return result;
  }

  async disputes(
    actor: AuthenticatedActor,
    query: DisputeListQuery,
    context: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    const rows = await this.repository.disputes(query);
    const result = page(
      rows.map(({ evidenceSha256, ...item }) => ({
        ...item,
        amountKobo: item.amountKobo.toString(),
        hasEvidence: evidenceSha256 !== null,
      })),
      query.limit,
    );
    await this.auditRead(
      actor,
      "PAYMENT",
      null,
      "PAYMENT_DISPUTES",
      result.items.length,
      context,
    );
    return result;
  }

  async refunds(
    actor: AuthenticatedActor,
    query: RefundListQuery,
    context: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    const rows = await this.repository.refunds(query);
    const result = page(
      rows.map((item) => ({ ...item, amountKobo: item.amountKobo.toString() })),
      query.limit,
    );
    await this.auditRead(
      actor,
      "PAYMENT",
      null,
      "PAYMENT_REFUNDS",
      result.items.length,
      context,
    );
    return result;
  }

  async updateAnomaly(
    actor: AuthenticatedActor,
    id: string,
    input: AnomalyUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertAuditAdministrator(actor);
    if (input.expectedStatus === "OPEN" && input.status !== "INVESTIGATING")
      throw auditConflict("Open anomalies must be investigated before closure");
    if (input.expectedStatus === "INVESTIGATING" && input.status === "INVESTIGATING")
      throw auditConflict("The anomaly is already under investigation");
    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.paymentAnomaly.findUnique({
        where: { id },
        select: { status: true },
      });
      if (existing === null) throw auditNotFound();
      const terminal = input.status === "RESOLVED" || input.status === "IGNORED";
      const changed = await transaction.paymentAnomaly.updateMany({
        where: { id, status: input.expectedStatus },
        data: {
          status: input.status,
          resolutionNote: input.resolutionNote,
          resolvedByUserId: terminal ? actor.userId : null,
          resolvedAt: terminal ? new Date() : null,
        },
      });
      if (changed.count !== 1) throw auditConflict();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "PAYMENT",
        entityId: id,
        oldValues: { status: input.expectedStatus },
        newValues: { status: input.status, resolutionNote: input.resolutionNote },
        context,
      });
      return transaction.paymentAnomaly.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          type: true,
          status: true,
          summary: true,
          resolutionNote: true,
          resolvedAt: true,
          resolvedByUserId: true,
        },
      });
    });
  }

  private auditRead(
    actor: AuthenticatedActor,
    entityType: "USER" | "PAYMENT",
    entityId: string | null,
    resource: string,
    resultCount: number,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType,
        entityId,
        newValues: { resource, resultCount },
        context,
      }),
    );
  }
}

export const auditOperationsService = new AuditOperationsService();
