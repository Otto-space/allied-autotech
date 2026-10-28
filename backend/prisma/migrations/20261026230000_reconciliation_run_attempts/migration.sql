-- Retain every failed run and its observations when a period is retried.
-- Existing rows become attempt 1 without changing any financial evidence.
ALTER TABLE "PaymentReconciliationRun"
  ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "leaseToken" UUID,
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD CONSTRAINT "PaymentReconciliationRun_attemptNumber_positive_check"
    CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "PaymentReconciliationRun_lease_pair_check"
    CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL));

DROP INDEX "PaymentReconciliationRun_provider_periodStart_periodEnd_key";
CREATE UNIQUE INDEX "ReconciliationRun_period_attempt_key"
  ON "PaymentReconciliationRun"("provider", "periodStart", "periodEnd", "attemptNumber");
CREATE INDEX "PaymentReconciliationRun_provider_periodStart_periodEnd_idx"
  ON "PaymentReconciliationRun"("provider", "periodStart", "periodEnd");
CREATE INDEX "PaymentAttempt_reconciliation_due_idx"
  ON "PaymentAttempt"("provider", "initiatedAt", "id");

-- Only one observation may be running for a period at once. Completed snapshots
-- remain immutable, and a later backdated attempt can receive a new snapshot.
CREATE UNIQUE INDEX "PaymentReconciliationRun_one_running_period_key"
  ON "PaymentReconciliationRun"("provider", "periodStart", "periodEnd")
  WHERE "status" = 'RUNNING';
