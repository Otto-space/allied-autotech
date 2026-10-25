-- Operator-local presentation acknowledgement; no delivery state/history changes.
CREATE TABLE "SupportDeliveryNoticeDismissal" (
  "userId" UUID NOT NULL,
  "deliveryId" UUID NOT NULL,
  "revision" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportDeliveryNoticeDismissal_pkey" PRIMARY KEY ("userId", "deliveryId", "revision"),
  CONSTRAINT "SupportDeliveryNoticeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupportDeliveryNoticeDismissal_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportDeliveryNoticeDismissal_deliveryId_idx" ON "SupportDeliveryNoticeDismissal"("deliveryId");
