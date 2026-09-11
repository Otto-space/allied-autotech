import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { logger } from "../common/observability/logger.js";
import { safeErrorAttributes } from "../common/observability/safe-error.js";
import { prisma } from "../config/database.js";
import { assertGeneralWorkerEnvironment, env } from "../config/env.js";
import { ResendEmailProvider } from "../providers/messaging/resend-email.adapter.js";
import { TermiiSmsProvider } from "../providers/messaging/termii-sms.adapter.js";
import { ExpirationWorker } from "./expiration.worker.js";
import { NotificationDeliveryWorker } from "./notification.worker.js";
import { PaymentReconciliationWorker } from "./reconciliation.worker.js";
import { PaymentWebhookRetryWorker } from "./webhook-retry.worker.js";

type Work = () => Promise<unknown>;

async function safely(name: string, work: Work): Promise<void> {
  try {
    await work();
  } catch (error: unknown) {
    logger.error({ ...safeErrorAttributes(error), worker: name }, "Worker task failed");
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveWait) => {
    if (signal.aborted) return resolveWait();
    const timer = setTimeout(resolveWait, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolveWait();
      },
      { once: true },
    );
  });
}

export async function runGeneralWorker(): Promise<void> {
  assertGeneralWorkerEnvironment();
  const notification = new NotificationDeliveryWorker(
    env.EMAIL_DELIVERY_ENABLED ? new ResendEmailProvider() : null,
    env.SMS_DELIVERY_ENABLED ? new TermiiSmsProvider() : null,
  );
  const webhook = new PaymentWebhookRetryWorker();
  const expiration = new ExpirationWorker();
  const reconciliation = new PaymentReconciliationWorker();
  const stop = new AbortController();
  const stopOnce = () => stop.abort();
  process.once("SIGINT", stopOnce);
  process.once("SIGTERM", stopOnce);
  let nextExpirationAt = 0;
  let nextReconciliationAt = Date.now() + env.RECONCILIATION_INTERVAL_MS;

  await prisma.$connect();
  logger.info(
    {
      emailDelivery: env.EMAIL_DELIVERY_ENABLED,
      smsDelivery: env.SMS_DELIVERY_ENABLED,
      paymentReconciliation: env.PAYMENT_RECONCILIATION_ENABLED,
    },
    "General worker started",
  );
  try {
    while (!stop.signal.aborted) {
      await safely("notification-delivery", () =>
        notification.runOnce(env.WORKER_BATCH_SIZE),
      );
      await safely("payment-webhook-retry", () => webhook.runOnce(env.WORKER_BATCH_SIZE));
      const now = Date.now();
      if (now >= nextExpirationAt) {
        await safely("expiration", () => expiration.runOnce(env.WORKER_BATCH_SIZE));
        nextExpirationAt = now + env.EXPIRATION_INTERVAL_MS;
      }
      if (env.PAYMENT_RECONCILIATION_ENABLED && now >= nextReconciliationAt) {
        const periodEnd = new Date();
        const periodStart = new Date(
          periodEnd.getTime() - env.RECONCILIATION_INTERVAL_MS,
        );
        await safely("payment-reconciliation", () =>
          reconciliation.run(periodStart, periodEnd),
        );
        nextReconciliationAt = now + env.RECONCILIATION_INTERVAL_MS;
      }
      await wait(env.WORKER_POLL_INTERVAL_MS, stop.signal);
    }
  } finally {
    logger.info("General worker stopping");
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runGeneralWorker();
}
