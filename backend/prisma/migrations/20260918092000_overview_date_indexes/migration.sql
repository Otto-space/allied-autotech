-- Date-bounded dashboard aggregates. Existing ownership/branch indexes remain.
CREATE INDEX "Booking_overview_created_idx" ON "Booking" ("createdAt");
CREATE INDEX "Booking_overview_branch_created_idx" ON "Booking" ("branchId", "createdAt");
CREATE INDEX "Order_overview_created_idx" ON "Order" ("createdAt");
CREATE INDEX "Order_overview_branch_created_idx" ON "Order" ("branchId", "createdAt");
CREATE INDEX "ServiceQuote_overview_issued_idx" ON "ServiceQuote" ("issuedAt");
CREATE INDEX "InspectionRequest_overview_created_idx" ON "InspectionRequest" ("createdAt");
CREATE INDEX "Vehicle_overview_created_idx" ON "Vehicle" ("createdAt");
CREATE INDEX "Payment_overview_settled_idx" ON "Payment" ("status", "succeededAt");
CREATE INDEX "Refund_overview_processed_idx" ON "Refund" ("status", "processedAt");
