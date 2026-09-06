-- Align the Prisma-declared order query index while preserving Phase 6 controls.
DROP INDEX "Order_branchId_status_createdAt_idx";
CREATE INDEX "Order_branchId_status_createdAt_idx"
  ON "Order"("branchId", "status", "createdAt");
