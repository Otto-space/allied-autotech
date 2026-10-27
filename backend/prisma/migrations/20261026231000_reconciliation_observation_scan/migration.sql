-- Support a bounded latest-observation lookup for repeated checks of pending
-- and discrepant online payment attempts. Existing evidence is unchanged.
CREATE INDEX "ReconciliationItem_latest_attempt_idx"
  ON "PaymentReconciliationItem"("paymentAttemptId", "createdAt" DESC, "id" DESC);
