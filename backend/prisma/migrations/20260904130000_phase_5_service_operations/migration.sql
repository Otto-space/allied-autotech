-- Phase 5 service-operation ownership, optimistic concurrency, scheduling, and immutability controls.

ALTER TABLE "Service"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Booking"
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ServiceQuote"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkOrder"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Service"
  ADD CONSTRAINT "aat_service_version_nonnegative" CHECK ("version" >= 0);

ALTER TABLE "Booking"
  ADD CONSTRAINT "aat_booking_version_nonnegative" CHECK ("version" >= 0);

ALTER TABLE "ServiceQuote"
  ADD CONSTRAINT "aat_service_quote_revision_nonnegative" CHECK ("revision" >= 0);

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "aat_work_order_version_nonnegative" CHECK ("version" >= 0),
  ADD CONSTRAINT "aat_work_order_status_timestamps"
  CHECK (
    ("status" <> 'APPROVED' OR "openedAt" IS NOT NULL)
    AND ("status" <> 'IN_PROGRESS' OR "startedAt" IS NOT NULL)
    AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
  );

CREATE INDEX "Booking_branchId_status_scheduledAt_idx"
  ON "Booking"("branchId", "status", "scheduledAt");

CREATE INDEX "Booking_active_staff_schedule_idx"
  ON "Booking"("assignedStaffId", "scheduledAt")
  WHERE "assignedStaffId" IS NOT NULL
    AND "status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS');

CREATE INDEX "Booking_active_vehicle_schedule_idx"
  ON "Booking"("vehicleId", "scheduledAt")
  WHERE "vehicleId" IS NOT NULL
    AND "status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS');

CREATE UNIQUE INDEX "ServiceQuote_one_accepted_per_booking_key"
  ON "ServiceQuote"("bookingId") WHERE "status" = 'ACCEPTED';

CREATE INDEX "ServiceQuote_bookingId_version_desc_idx"
  ON "ServiceQuote"("bookingId", "version" DESC);

CREATE OR REPLACE FUNCTION aat_protect_quote_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "QuoteStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "ServiceQuote"
  WHERE "id" = COALESCE(NEW."serviceQuoteId", OLD."serviceQuoteId");

  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Issued quote items are immutable; create a new version';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "QuoteItem_protect_issued" ON "QuoteItem";
CREATE TRIGGER "QuoteItem_protect_issued"
BEFORE INSERT OR UPDATE OR DELETE ON "QuoteItem"
FOR EACH ROW EXECUTE FUNCTION aat_protect_quote_items();

CREATE OR REPLACE FUNCTION aat_protect_closed_work_order_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "WorkOrderStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "WorkOrder"
  WHERE "id" = COALESCE(NEW."workOrderId", OLD."workOrderId");

  IF parent_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Closed work order items are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "WorkOrderItem_protect_closed" ON "WorkOrderItem";
CREATE TRIGGER "WorkOrderItem_protect_closed"
BEFORE INSERT OR UPDATE OR DELETE ON "WorkOrderItem"
FOR EACH ROW EXECUTE FUNCTION aat_protect_closed_work_order_items();
