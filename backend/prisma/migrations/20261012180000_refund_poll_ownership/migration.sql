-- Additive ownership for read-only provider reconciliation. Historical refunds
-- remain unclaimed; financial facts and retry history are preserved.
ALTER TABLE "Refund"
  ADD COLUMN "reconciliationToken" UUID,
  ADD COLUMN "reconciliationLeaseUntil" TIMESTAMP(3),
  ADD CONSTRAINT "Refund_reconciliation_claim_pair_check" CHECK (
    ("reconciliationToken" IS NULL) = ("reconciliationLeaseUntil" IS NULL)
  );

CREATE INDEX "Refund_reconciliation_due_idx" ON "Refund" ("nextReconcileAt", "id")
  WHERE "status" IN ('PENDING', 'PROCESSING') AND "providerRefundId" IS NOT NULL;
