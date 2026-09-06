import { prisma } from "../config/database.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { paystackProvider } from "../providers/payments/paystack.adapter.js";
import type { PaymentProviderPort } from "../providers/payments/payment-provider.port.js";

export class PaymentReconciliationWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly provider: PaymentProviderPort = paystackProvider,
  ) {}
  async run(periodStart: Date, periodEnd: Date) {
    if (
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime()) ||
      periodStart >= periodEnd
    )
      throw new Error("Invalid reconciliation period");
    const run = await this.database.paymentReconciliationRun.create({
      data: { provider: "PAYSTACK", periodStart, periodEnd },
    });
    try {
      const attempts = await this.database.paymentAttempt.findMany({
        where: { provider: "PAYSTACK", initiatedAt: { gte: periodStart, lt: periodEnd } },
        orderBy: [{ initiatedAt: "asc" }, { id: "asc" }],
        take: 1_000,
      });
      let matchedCount = 0;
      let differenceCount = 0;
      let providerTotalKobo = 0n;
      let internalTotalKobo = 0n;
      for (const attempt of attempts) {
        internalTotalKobo += attempt.status === "SUCCESSFUL" ? attempt.amountKobo : 0n;
        try {
          const remote = await this.provider.verify(attempt.internalReference);
          providerTotalKobo += remote.status === "success" ? remote.amountKobo : 0n;
          const status =
            remote.reference !== attempt.internalReference
              ? "MISSING_IN_PROVIDER"
              : remote.amountKobo !== attempt.amountKobo
                ? "AMOUNT_MISMATCH"
                : remote.currency !== attempt.currency
                  ? "CURRENCY_MISMATCH"
                  : (remote.status === "success") !== (attempt.status === "SUCCESSFUL")
                    ? "STATUS_MISMATCH"
                    : "MATCHED";
          if (status === "MATCHED") matchedCount++;
          else differenceCount++;
          await this.database.paymentReconciliationItem.create({
            data: {
              runId: run.id,
              paymentAttemptId: attempt.id,
              status,
              providerReference: attempt.providerReference,
              providerAmountKobo: remote.amountKobo,
              internalAmountKobo: attempt.amountKobo,
            },
          });
        } catch {
          differenceCount++;
          await this.database.paymentReconciliationItem.create({
            data: {
              runId: run.id,
              paymentAttemptId: attempt.id,
              status: "MISSING_IN_PROVIDER",
              providerReference: attempt.providerReference,
              internalAmountKobo: attempt.amountKobo,
              note: "Provider verification was unavailable or did not return this reference",
            },
          });
        }
      }
      return this.database.paymentReconciliationRun.update({
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
}
