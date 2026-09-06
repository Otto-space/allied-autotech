-- Phase 6 order ownership, optimistic concurrency, query performance, and immutable snapshots.

ALTER TABLE "Order"
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "Promotion"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Invoice"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "aat_order_branch_required_for_new_rows"
  CHECK ("branchId" IS NOT NULL) NOT VALID,
  ADD CONSTRAINT "aat_order_confirmed_timestamp"
  CHECK ("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL) NOT VALID;

ALTER TABLE "Promotion"
  ADD CONSTRAINT "aat_promotion_version_nonnegative" CHECK ("version" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "aat_invoice_version_nonnegative" CHECK ("version" >= 0);

CREATE INDEX "Order_branchId_status_createdAt_idx"
  ON "Order"("branchId", "status", "createdAt" DESC);

CREATE INDEX "Order_pending_payment_due_idx"
  ON "Order"("paymentDueAt", "id")
  WHERE "status" = 'PENDING' AND "paymentDueAt" IS NOT NULL;

CREATE INDEX "InventoryReservation_active_order_idx"
  ON "InventoryReservation"("referenceId", "inventoryId")
  WHERE "referenceType" = 'ORDER' AND "status" = 'ACTIVE';

CREATE INDEX "PromotionUsage_promotion_createdAt_idx"
  ON "PromotionUsage"("promotionId", "createdAt");

CREATE OR REPLACE FUNCTION aat_protect_order_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."orderNumber" IS DISTINCT FROM OLD."orderNumber"
    OR NEW."fulfillmentMethod" IS DISTINCT FROM OLD."fulfillmentMethod"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotalKobo" IS DISTINCT FROM OLD."subtotalKobo"
    OR NEW."discountAmountKobo" IS DISTINCT FROM OLD."discountAmountKobo"
    OR NEW."deliveryFeeKobo" IS DISTINCT FROM OLD."deliveryFeeKobo"
    OR NEW."totalKobo" IS DISTINCT FROM OLD."totalKobo"
    OR NEW."customerName" IS DISTINCT FROM OLD."customerName"
    OR NEW."customerEmail" IS DISTINCT FROM OLD."customerEmail"
    OR NEW."customerPhone" IS DISTINCT FROM OLD."customerPhone"
    OR NEW."deliveryName" IS DISTINCT FROM OLD."deliveryName"
    OR NEW."deliveryPhone" IS DISTINCT FROM OLD."deliveryPhone"
    OR NEW."deliveryAddress" IS DISTINCT FROM OLD."deliveryAddress"
    OR NEW."deliveryCity" IS DISTINCT FROM OLD."deliveryCity"
    OR NEW."deliveryState" IS DISTINCT FROM OLD."deliveryState"
    OR NEW."deliveryCountry" IS DISTINCT FROM OLD."deliveryCountry"
  THEN
    RAISE EXCEPTION 'Order identity, pricing, fulfilment, and customer snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Order_protect_snapshot" ON "Order";
CREATE TRIGGER "Order_protect_snapshot"
BEFORE UPDATE ON "Order"
FOR EACH ROW EXECUTE FUNCTION aat_protect_order_snapshot();

CREATE OR REPLACE FUNCTION aat_forbid_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable snapshots', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS "OrderItem_forbid_update" ON "OrderItem";
CREATE TRIGGER "OrderItem_forbid_update"
BEFORE UPDATE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_snapshot_mutation();

DROP TRIGGER IF EXISTS "PromotionUsage_forbid_mutation" ON "PromotionUsage";
CREATE TRIGGER "PromotionUsage_forbid_mutation"
BEFORE UPDATE OR DELETE ON "PromotionUsage"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_snapshot_mutation();
