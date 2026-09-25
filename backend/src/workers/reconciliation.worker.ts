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
      status: "MISSING_IN_PROVIDER",
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
  ) {
    if (
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime()) ||
      periodStart >= periodEnd
    )
      throw new Error("Invalid reconciliation period");
    const run = await this.database.paymentReconciliationRun.create({
      data: { provider, periodStart, periodEnd },
    });
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
          const internalAmountKobo = receivedAmount(attempt);
          let remote: VerifiedPayment | undefined;
          try {
            remote = await this.providers.get(provider).verify(attempt.internalReference);
          } catch {
            // Only provider failures become unavailable observations. Database
            // errors must fail the run, never manufacture a provider mismatch.
          }
          let result =
            remote === undefined
              ? {
                  status: "MISSING_IN_PROVIDER" as const,
                  providerAmountKobo: null,
                  note: "Provider verification was unavailable or did not return this reference",
                }
              : compare(attempt, remote, internalAmountKobo);
          if (
            remote !== undefined &&
            result.providerAmountKobo !== null &&
            result.providerAmountKobo > 0n
          ) {
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
          await this.database.paymentReconciliationItem.create({
            data: {
              runId: run.id,
              paymentAttemptId: attempt.id,
              ...result,
              providerReference: attempt.providerReference,
              providerGatewayTransactionId: remote?.gatewayTransactionId ?? null,
              internalAmountKobo,
            },
          });
          internalTotalKobo += internalAmountKobo ?? 0n;
          providerTotalKobo += result.providerAmountKobo ?? 0n;
          if (result.status === "MATCHED") matchedCount++;
          else differenceCount++;
        }
        const last = attempts[attempts.length - 1]!;
        after = { initiatedAt: last.initiatedAt, id: last.id };
      }
      return await this.database.paymentReconciliationRun.update({
        where: { id: run.id },
        data: {
          status: differenceCount === 0 ? "MATCHED" : "DIFFERENCES_FOUND",
          matchedCount,
          differenceCount,
          providerTotalKobo,
          internalTotalKobo,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.database.paymentReconciliationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          failureMessage: "Reconciliation did not complete",
        },
      });
      throw error;
    }
  }

  async runConfigured(periodStart: Date, periodEnd: Date) {
    const results = [];
    for (const provider of this.providers.enabledProviders())
      results.push(await this.run(periodStart, periodEnd, provider));
    return results;
  }
}
