BEGIN;

-- Retain the actual observed receipt identity even when the local attempt has
-- not been confirmed. This lets a bounded reconciliation detect reuse across
-- batches without counting one provider receipt twice or keeping an unbounded
-- in-memory set. Historical observations remain unchanged and nullable.
ALTER TABLE "PaymentReconciliationItem"
  ADD COLUMN "providerGatewayTransactionId" VARCHAR(160);

CREATE INDEX "ReconciliationItem_provider_receipt_idx"
  ON "PaymentReconciliationItem" ("runId", "providerGatewayTransactionId");

COMMIT;
