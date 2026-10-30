import {
  holdUnallocatableProviderResult,
  recordConflictingProviderFacts,
} from "../modules/payments/provider-observation.js";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import type {
  PaymentAttempt,
  PrismaClient,
  ReconciliationItemStatus,
} from "../generated/prisma/client.js";
import type { VerifiedPayment } from "../providers/payments/payment-provider.port.js";
import {
  paymentProviders,
  PaymentProviderRegistry,
  type OnlinePaymentProvider,
} from "../providers/payments/payment-provider.registry.js";

const batchSize = 250;
const reconciliationLeaseMs = 10 * 60_000;

function receivedAmount(attempt: PaymentAttempt): bigint | null {
  if (attempt.status !== "SUCCESSFUL") return 0n;
  return (attempt.verificationStatus === "VERIFIED" ||
    attempt.verificationStatus === "MISMATCH") &&
    attempt.verifiedCurrency === "NGN" &&
    attempt.verifiedAmountKobo !== null &&
    attempt.verifiedAmountKobo > 0n
    ? attempt.verifiedAmountKobo
    : null;
}

function compare(
  attempt: PaymentAttempt,
  remote: VerifiedPayment,
  internalAmountKobo: bigint | null,
): {
  status: ReconciliationItemStatus;
  providerAmountKobo: bigint | null;
  note: string | null;
} {
  if (remote.reference !== attempt.internalReference)
    return {
      status: "STATUS_MISMATCH",
      providerAmountKobo: null,
      note: "Provider returned a different reference; excluded from NGN totals",
    };
  if (remote.currency !== "NGN")
    return {
      status: "CURRENCY_MISMATCH",
      providerAmountKobo: null,
      note: "Provider currency is not NGN; excluded from NGN totals",
    };
  if (remote.status === "success" && remote.amountKobo <= 0n)
    return {
      status: "AMOUNT_MISMATCH",
      providerAmountKobo: null,
      note: "Successful provider result has no positive receipt; excluded from NGN totals",
    };
  if (!remote.gatewayTransactionId.trim())
    return {
      status: "STATUS_MISMATCH",
      providerAmountKobo: null,
      note: "Provider receipt identity is missing; excluded from NGN totals",
    };
  if (remote.status === "reversed")
    return {
      status: "STATUS_MISMATCH",
      providerAmountKobo: null,
      note: "Provider reported a reversal; refund or chargeback amount requires review and is excluded from NGN totals",
    };
  const providerAmountKobo = remote.status === "success" ? remote.amountKobo : 0n;
  if (
    remote.amountKobo !== attempt.amountKobo ||
    attempt.verificationStatus === "MISMATCH" ||
    (attempt.status === "SUCCESSFUL" && internalAmountKobo !== remote.amountKobo)
  )
    return {
      status: "AMOUNT_MISMATCH",
      providerAmountKobo,
      note: "Provider amount differs from the request or a previously confirmed receipt; any existing amount mismatch remains unresolved",
    };
  const localStatus = {
    INITIALIZED: "pending",
    PENDING: "pending",
    PROCESSING: "pending",
    SUCCESSFUL: "success",
    FAILED: "failed",
    ABANDONED: "abandoned",
    CANCELLED: "cancelled",
  }[attempt.status];
  const metadata = attempt.redactedGatewayData;
  const held =
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    metadata["verificationHold"] === true;
  if (
    remote.status !== localStatus ||
    internalAmountKobo === null ||
    held ||
    (attempt.status === "SUCCESSFUL" &&
      remote.gatewayTransactionId !== attempt.gatewayTransactionId)
  )
    return {
      status: "STATUS_MISMATCH",
      providerAmountKobo,
      note: "Provider state or transaction identity differs, or the local attempt remains held for review",
    };
  return { status: "MATCHED", providerAmountKobo, note: null };
}

export class PaymentReconciliationWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly providers: PaymentProviderRegistry = paymentProviders,
  ) {}
  async run(
    periodStart: Date,
    periodEnd: Date,
    provider: OnlinePaymentProvider = "PAYSTACK",
    reobserveCompleted = false,
  ) {
    if (
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime()) ||
      periodStart >= periodEnd
    )
      throw new Error("Invalid reconciliation period");
    let previous = await this.database.paymentReconciliationRun.findFirst({
      where: { provider, periodStart, periodEnd },
      orderBy: { attemptNumber: "desc" },
    });
    if (previous?.status === "RUNNING") {
      const now = new Date();
      if (!previous.leaseToken || !previous.leaseUntil || previous.leaseUntil >= now)
        throw new Error("Reconciliation period already running");
      const released = await this.database.paymentReconciliationRun.updateMany({
        where: {
          id: previous.id,
          status: "RUNNING",
          leaseToken: previous.leaseToken,
          leaseUntil: { lt: now },
        },
        data: {
          status: "FAILED",
          completedAt: now,
          failureMessage: "Reconciliation ownership expired before completion",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (released.count !== 1)
        throw new Error("Reconciliation period ownership changed");
      previous = { ...previous, status: "FAILED" };
    }
    if (
      !reobserveCompleted &&
      (previous?.status === "MATCHED" || previous?.status === "DIFFERENCES_FOUND")
    )
      return previous;
    const leaseToken = randomUUID();
    const run = await this.database.paymentReconciliationRun.create({
      data: {
        provider,
        periodStart,
        periodEnd,
        attemptNumber: (previous?.attemptNumber ?? 0) + 1,
        leaseToken,
        leaseUntil: new Date(Date.now() + reconciliationLeaseMs),
      },
    });
    const renewLease = async () => {
      await this.database.paymentReconciliationRun.update({
        where: {
          id: run.id,
          status: "RUNNING",
          leaseToken,
          leaseUntil: { gt: new Date() },
        },
        data: { leaseUntil: new Date(Date.now() + reconciliationLeaseMs) },
      });
    };
    try {
      let matchedCount = 0;
      let differenceCount = 0;
      let providerTotalKobo = 0n;
      let internalTotalKobo = 0n;
      let after: { initiatedAt: Date; id: string } | undefined;
      while (true) {
        // Bound memory, not coverage. New attempts belong to a later run. The
        // timestamp/UUID keyset also handles hundreds of simultaneous attempts.
        const attempts: PaymentAttempt[] = await this.database.paymentAttempt.findMany({
          where: {
            provider,
            initiatedAt: { gte: periodStart, lt: periodEnd },
            createdAt: { lte: run.startedAt },
            ...(after === undefined
              ? {}
              : {
                  OR: [
                    { initiatedAt: { gt: after.initiatedAt } },
                    { initiatedAt: after.initiatedAt, id: { gt: after.id } },
                  ],
                }),
          },
          orderBy: [{ initiatedAt: "asc" }, { id: "asc" }],
          take: batchSize,
        });
        if (attempts.length === 0) break;
        for (const attempt of attempts) {
          await renewLease();
          let internalAmountKobo = receivedAmount(attempt);
          let remote: VerifiedPayment;
          try {
            remote = await this.providers.get(provider).verify(attempt.internalReference);
          } catch {
            // An unavailable provider is not evidence that a receipt is absent.
            // Leave this run incomplete so a later attempt can verify it again.
            throw new Error(
              "Provider verification unavailable; reconciliation will retry",
            );
          }
          let result = compare(attempt, remote, internalAmountKobo);
          if (result.providerAmountKobo !== null && result.providerAmountKobo > 0n) {
            const [confirmedElsewhere, alreadyCounted] = await Promise.all([
              this.database.paymentAttempt.findFirst({
                where: {
                  provider,
                  gatewayTransactionId: remote.gatewayTransactionId,
                  status: "SUCCESSFUL",
                  id: { not: attempt.id },
                },
                select: { id: true },
              }),
              this.database.paymentReconciliationItem.findFirst({
                where: {
                  runId: run.id,
                  providerGatewayTransactionId: remote.gatewayTransactionId,
                  providerAmountKobo: { gt: 0n },
                },
                select: { id: true },
              }),
            ]);
            if (confirmedElsewhere || alreadyCounted)
              result = {
                status: "STATUS_MISMATCH",
                providerAmountKobo: null,
                note: "Provider receipt belongs to another confirmed attempt or was already counted in this run; excluded from NGN totals",
              };
          }
          await this.database.$transaction(async (transaction) => {
            // Hold the run row through the insert. A replacement cannot claim an
            // expired lease between our ownership check and the observation write.
            await transaction.paymentReconciliationRun.update({
              where: {
                id: run.id,
                status: "RUNNING",
                leaseToken,
                leaseUntil: { gt: new Date() },
              },
              data: { leaseUntil: new Date(Date.now() + reconciliationLeaseMs) },
            });
            if (
              remote.status === "reversed" &&
              remote.reference === attempt.internalReference &&
              remote.gatewayTransactionId.trim()
            ) {
              // Share verification's deduplicated observation under both the run
              // lease and attempt lock. Never rewrite an existing capture.
              await transaction.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id}::uuid FOR UPDATE`;
              const current = await transaction.paymentAttempt.findUniqueOrThrow({
                where: { id: attempt.id },
              });
              internalAmountKobo = receivedAmount(current);
              result = compare(current, remote, internalAmountKobo);
              if (current.status === "SUCCESSFUL") {
                await recordConflictingProviderFacts(transaction, current, remote);
              } else {
                await holdUnallocatableProviderResult(transaction, current, remote);
                await transaction.paymentAttempt.update({
                  where: { id: current.id },
                  data: { gatewayStatus: "reversed" },
                });
              }
            }
            await transaction.paymentReconciliationItem.create({
              data: {
                runId: run.id,
                paymentAttemptId: attempt.id,
                ...result,
                providerReference: attempt.providerReference,
                providerGatewayTransactionId: remote.gatewayTransactionId,
                internalAmountKobo,
              },
            });
          });
          internalTotalKobo += internalAmountKobo ?? 0n;
          providerTotalKobo += result.providerAmountKobo ?? 0n;
          if (result.status === "MATCHED") matchedCount++;
          else differenceCount++;
        }
        const last = attempts[attempts.length - 1]!;
        after = { initiatedAt: last.initiatedAt, id: last.id };
      }
      await renewLease();
      return await this.database.$transaction(
        async (transaction) => {
          const completed = await transaction.paymentReconciliationRun.update({
            where: {
              id: run.id,
              status: "RUNNING",
              leaseToken,
              leaseUntil: { gt: new Date() },
            },
            data: {
              status: differenceCount === 0 ? "MATCHED" : "DIFFERENCES_FOUND",
              matchedCount,
              differenceCount,
              providerTotalKobo,
              internalTotalKobo,
              completedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
            },
          });
          // Publish scheduling state only if the completed evidence commits. Lock
          // attempts in a stable order so a concurrent status change cannot
          // overwrite the decision with a stale local state.
          await transaction.$executeRaw`
            WITH locked_attempts AS MATERIALIZED (
              SELECT a."id", a."provider", a."initiatedAt", a."status"
              FROM "PaymentAttempt" AS a
              WHERE EXISTS (
                SELECT 1 FROM "PaymentReconciliationItem" AS i
                WHERE i."runId" = ${run.id}::uuid
                  AND i."paymentAttemptId" = a."id"
              )
              ORDER BY a."id"
              FOR UPDATE OF a
            ), newest AS (
              SELECT DISTINCT ON (i."paymentAttemptId")
                a."id" AS "paymentAttemptId", a."provider", a."initiatedAt",
                a."status" AS "attemptStatus", i."status" AS "itemStatus",
                i."createdAt" AS "itemCreatedAt", i."id" AS "itemId",
                r."completedAt", r."startedAt", r."attemptNumber"
              FROM locked_attempts AS a
              JOIN "PaymentReconciliationItem" AS i ON i."paymentAttemptId" = a."id"
              JOIN "PaymentReconciliationRun" AS r ON r."id" = i."runId"
              WHERE i."runId" = ${run.id}::uuid
              ORDER BY i."paymentAttemptId", i."createdAt" DESC, i."id" DESC
            )
            INSERT INTO "PaymentReconciliationDue" AS due (
              "paymentAttemptId", "provider", "initiatedAt", "nextDueAt",
              "latestItemStatus", "latestCompletedAt", "latestItemCreatedAt",
              "latestRunStartedAt", "latestRunAttemptNumber", "latestItemId"
            )
            SELECT "paymentAttemptId", "provider", "initiatedAt",
              CASE WHEN "itemStatus" = 'MATCHED'
                AND "attemptStatus" NOT IN ('INITIALIZED', 'PENDING', 'PROCESSING')
                THEN NULL ELSE "completedAt" END,
              "itemStatus", "completedAt", "itemCreatedAt", "startedAt",
              "attemptNumber", "itemId"
            FROM newest
            WHERE TRUE
            ON CONFLICT ("paymentAttemptId") DO UPDATE SET
              "provider" = EXCLUDED."provider",
              "initiatedAt" = EXCLUDED."initiatedAt",
              "nextDueAt" = EXCLUDED."nextDueAt",
              "latestItemStatus" = EXCLUDED."latestItemStatus",
              "latestCompletedAt" = EXCLUDED."latestCompletedAt",
              "latestItemCreatedAt" = EXCLUDED."latestItemCreatedAt",
              "latestRunStartedAt" = EXCLUDED."latestRunStartedAt",
              "latestRunAttemptNumber" = EXCLUDED."latestRunAttemptNumber",
              "latestItemId" = EXCLUDED."latestItemId"
            WHERE due."latestItemId" IS NULL OR
              (EXCLUDED."latestItemCreatedAt", EXCLUDED."latestRunStartedAt",
                EXCLUDED."latestRunAttemptNumber", EXCLUDED."latestItemId") >
              (due."latestItemCreatedAt", due."latestRunStartedAt",
                due."latestRunAttemptNumber", due."latestItemId")
          `;
          return completed;
        },
        { timeout: 5 * 60_000 },
      );
    } catch (error) {
      await this.database.paymentReconciliationRun.updateMany({
        where: { id: run.id, status: "RUNNING", leaseToken },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          failureMessage: "Reconciliation did not complete",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      throw error;
    }
  }

  /** Process one closed window containing an unobserved or still-open attempt. */
  async runNextDueForProvider(
    provider: OnlinePaymentProvider,
    intervalMs: number,
    now = new Date(),
  ) {
    if (
      !Number.isSafeInteger(intervalMs) ||
      intervalMs <= 0 ||
      !Number.isFinite(now.getTime())
    )
      throw new Error("Invalid reconciliation schedule");
    const dueBefore = new Date(now.getTime() - intervalMs);
    const [uncovered] = await this.database.$queryRaw<Array<{ initiatedAt: Date }>>`
      SELECT "initiatedAt"
      FROM "PaymentReconciliationDue"
      WHERE "provider" = CAST(${provider} AS "PaymentProvider")
        AND "initiatedAt" <= ${dueBefore}
        AND "nextDueAt" <= ${dueBefore}
      ORDER BY "initiatedAt", "paymentAttemptId"
      LIMIT 1
    `;
    if (!uncovered) return null;
    const running = await this.database.paymentReconciliationRun.findFirst({
      where: {
        provider,
        periodStart: { lte: uncovered.initiatedAt },
        periodEnd: { gt: uncovered.initiatedAt },
        status: "RUNNING",
      },
      orderBy: { startedAt: "desc" },
      select: { periodStart: true, periodEnd: true },
    });
    if (running) return this.run(running.periodStart, running.periodEnd, provider);
    const covering = await this.database.paymentReconciliationRun.findFirst({
      where: {
        provider,
        periodStart: { lte: uncovered.initiatedAt },
        periodEnd: { gt: uncovered.initiatedAt },
        status: { in: ["MATCHED", "DIFFERENCES_FOUND"] },
      },
      orderBy: { startedAt: "desc" },
      select: { periodStart: true, periodEnd: true },
    });
    const failed = await this.database.paymentReconciliationRun.findFirst({
      where: {
        provider,
        status: "FAILED",
        periodStart: { lte: uncovered.initiatedAt },
        periodEnd: { gt: uncovered.initiatedAt },
      },
      orderBy: [{ periodStart: "asc" }, { attemptNumber: "desc" }],
    });
    const periodStart =
      covering?.periodStart ?? failed?.periodStart ?? uncovered.initiatedAt;
    const periodEnd =
      covering?.periodEnd ??
      failed?.periodEnd ??
      new Date(periodStart.getTime() + intervalMs);
    return this.run(periodStart, periodEnd, provider, covering !== null);
  }

  async runNextDue(intervalMs: number, now = new Date()) {
    const results = [];
    const failures: Error[] = [];
    for (const provider of this.providers.enabledProviders()) {
      try {
        results.push(await this.runNextDueForProvider(provider, intervalMs, now));
      } catch (error) {
        failures.push(
          error instanceof Error ? error : new Error("Reconciliation provider failed"),
        );
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, "Payment reconciliation incomplete");
    return results;
  }
}
