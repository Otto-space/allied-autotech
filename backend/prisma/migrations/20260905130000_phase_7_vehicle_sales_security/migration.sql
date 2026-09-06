ALTER TABLE "Vehicle" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VehicleListing" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VehicleDocument" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InspectionRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VehicleHandover" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Vehicle" ADD CONSTRAINT "aat_vehicle_version_nonnegative" CHECK ("version" >= 0) NOT VALID;
ALTER TABLE "VehicleListing" ADD CONSTRAINT "aat_vehicle_listing_version_nonnegative" CHECK ("version" >= 0) NOT VALID;
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "aat_vehicle_document_version_nonnegative" CHECK ("version" >= 0) NOT VALID;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "aat_inspection_version_nonnegative" CHECK ("version" >= 0) NOT VALID;
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "aat_handover_version_nonnegative" CHECK ("version" >= 0) NOT VALID;
ALTER TABLE "VehicleListing" ADD CONSTRAINT "aat_vehicle_listing_positive_price" CHECK ("priceKobo" > 0 AND "currency" = 'NGN') NOT VALID;
ALTER TABLE "Vehicle" ADD CONSTRAINT "aat_vehicle_valid_year" CHECK ("year" BETWEEN 1886 AND 2200) NOT VALID;
ALTER TABLE "Vehicle" ADD CONSTRAINT "aat_vehicle_nonnegative_values" CHECK (("mileageKm" IS NULL OR "mileageKm" >= 0) AND ("acquisitionCostKobo" IS NULL OR "acquisitionCostKobo" >= 0)) NOT VALID;
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "aat_vehicle_document_metadata" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 20971520 AND "checksumSha256" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE "VehicleConditionReport" ADD CONSTRAINT "aat_condition_report_values" CHECK (("odometerKm" IS NULL OR "odometerKm" >= 0) AND ("conditionScore" IS NULL OR "conditionScore" BETWEEN 0 AND 100)) NOT VALID;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "aat_inspection_window" CHECK ("preferredEndAt" IS NULL OR "preferredEndAt" > "preferredStartAt") NOT VALID;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "aat_inspection_schedule_window" CHECK (("scheduledStartAt" IS NULL AND "scheduledEndAt" IS NULL) OR ("scheduledStartAt" IS NOT NULL AND "scheduledEndAt" IS NOT NULL AND "scheduledEndAt" > "scheduledStartAt")) NOT VALID;
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "aat_vehicle_transaction_money" CHECK ("askingPriceKobo" > 0 AND ("agreedPriceKobo" IS NULL OR "agreedPriceKobo" > 0) AND ("reservationRequiredKobo" IS NULL OR "reservationRequiredKobo" >= 0) AND "currency" = 'NGN' AND "version" >= 0) NOT VALID;
ALTER TABLE "VehicleHandover" ADD CONSTRAINT "aat_handover_values" CHECK ("keysDelivered" >= 0 AND ("odometerKm" IS NULL OR "odometerKm" >= 0)) NOT VALID;
ALTER TABLE "VehicleListing" ADD CONSTRAINT "aat_vehicle_listing_timestamps" CHECK (("status" <> 'AVAILABLE' OR "publishedAt" IS NOT NULL) AND ("status" <> 'RESERVED' OR "reservedAt" IS NOT NULL) AND ("status" <> 'SOLD' OR "soldAt" IS NOT NULL) AND ("status" <> 'ARCHIVED' OR "archivedAt" IS NOT NULL)) NOT VALID;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "aat_inspection_timestamps" CHECK (("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL) AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL) AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)) NOT VALID;
ALTER TABLE "VehicleTransaction" ADD CONSTRAINT "aat_vehicle_transaction_timestamps" CHECK (("status" <> 'PAID' OR "paidAt" IS NOT NULL) AND ("status" <> 'HANDOVER_PENDING' OR "handoverPendingAt" IS NOT NULL) AND ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL) AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL) AND ("status" <> 'EXPIRED' OR "expiredAt" IS NOT NULL)) NOT VALID;

CREATE UNIQUE INDEX "VehicleListing_one_live_per_vehicle_idx" ON "VehicleListing" ("vehicleId") WHERE "status" IN ('AVAILABLE', 'RESERVED');
CREATE UNIQUE INDEX "VehicleTransaction_one_committed_per_listing_idx" ON "VehicleTransaction" ("vehicleListingId") WHERE "status" IN ('PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID', 'PAID', 'HANDOVER_PENDING', 'COMPLETED');
CREATE UNIQUE INDEX "VehicleImage_one_primary_per_vehicle_idx" ON "VehicleImage" ("vehicleId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "VehicleConditionReport_report_object_key_idx" ON "VehicleConditionReport" ("reportObjectKey") WHERE "reportObjectKey" IS NOT NULL;
CREATE UNIQUE INDEX "VehicleHandover_signed_object_key_idx" ON "VehicleHandover" ("signedDocumentObjectKey") WHERE "signedDocumentObjectKey" IS NOT NULL;
CREATE INDEX "InspectionRequest_staff_schedule_idx" ON "InspectionRequest" ("assignedStaffId", "scheduledStartAt", "scheduledEndAt") WHERE "status" IN ('CONFIRMED', 'RESCHEDULED');
CREATE INDEX "VehicleDocument_vehicle_status_idx" ON "VehicleDocument" ("vehicleId", "verificationStatus", "createdAt" DESC);
CREATE INDEX "VehicleTransaction_expiring_commitment_idx" ON "VehicleTransaction" ("reservationExpiresAt", "id") WHERE "status" IN ('PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID');

CREATE OR REPLACE FUNCTION "aat_forbid_vehicle_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'vehicle history rows are append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VehiclePriceHistory_forbid_mutation" BEFORE UPDATE OR DELETE ON "VehiclePriceHistory" FOR EACH ROW EXECUTE FUNCTION "aat_forbid_vehicle_history_mutation"();
CREATE TRIGGER "VehicleTransactionStatusHistory_forbid_mutation" BEFORE UPDATE OR DELETE ON "VehicleTransactionStatusHistory" FOR EACH ROW EXECUTE FUNCTION "aat_forbid_vehicle_history_mutation"();

CREATE OR REPLACE FUNCTION "aat_protect_vehicle_transaction_commitment"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "vehicleTransactionId" = OLD."id") AND
     (NEW."vehicleListingId", NEW."customerId", NEW."customerName", NEW."customerPhone", NEW."customerEmail", NEW."askingPriceKobo", NEW."agreedPriceKobo", NEW."currency")
       IS DISTINCT FROM
     (OLD."vehicleListingId", OLD."customerId", OLD."customerName", OLD."customerPhone", OLD."customerEmail", OLD."askingPriceKobo", OLD."agreedPriceKobo", OLD."currency") THEN
    RAISE EXCEPTION 'vehicle buyer and price fields are immutable after payment activity' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VehicleTransaction_protect_commitment" BEFORE UPDATE ON "VehicleTransaction" FOR EACH ROW EXECUTE FUNCTION "aat_protect_vehicle_transaction_commitment"();

CREATE OR REPLACE FUNCTION "aat_protect_vehicle_handover_signature"() RETURNS trigger AS $$
BEGIN
  IF OLD."signedDocumentObjectKey" IS NOT NULL AND
     (NEW."signedDocumentObjectKey", NEW."signedDocumentSha256") IS DISTINCT FROM
     (OLD."signedDocumentObjectKey", OLD."signedDocumentSha256") THEN
    RAISE EXCEPTION 'signed handover evidence is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VehicleHandover_protect_signature" BEFORE UPDATE ON "VehicleHandover" FOR EACH ROW EXECUTE FUNCTION "aat_protect_vehicle_handover_signature"();
