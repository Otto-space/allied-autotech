import { prisma } from "../src/config/database.js";
import { PaymentReconciliationWorker } from "../src/workers/reconciliation.worker.js";

const [startValue, endValue, providerValue = "PAYSTACK"] = process.argv.slice(2);
if (!startValue || !endValue)
  throw new Error(
    "Usage: npm run reconcile:payments -- <start-iso> <end-iso> [PAYSTACK|MONNIFY]",
  );
if (providerValue !== "PAYSTACK" && providerValue !== "MONNIFY")
  throw new Error("Provider must be PAYSTACK or MONNIFY");
try {
  const result = await new PaymentReconciliationWorker().run(
    new Date(startValue),
    new Date(endValue),
    providerValue,
  );
  process.stdout.write(
    `${JSON.stringify({ runId: result.id, status: result.status, matchedCount: result.matchedCount, differenceCount: result.differenceCount })}\n`,
  );
} finally {
  await prisma.$disconnect();
}
