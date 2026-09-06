-- Reuse the stricter controls already installed by the secure-payments migration
-- and remove overlapping Phase 7 objects so each invariant has one owner.
ALTER TABLE "VehicleListing"
  DROP CONSTRAINT IF EXISTS "aat_vehicle_listing_positive_price",
  DROP CONSTRAINT IF EXISTS "aat_vehicle_listing_timestamps";
ALTER TABLE "Vehicle"
  DROP CONSTRAINT IF EXISTS "aat_vehicle_valid_year",
  DROP CONSTRAINT IF EXISTS "aat_vehicle_nonnegative_values";
ALTER TABLE "VehicleConditionReport"
  DROP CONSTRAINT IF EXISTS "aat_condition_report_values",
  DROP CONSTRAINT IF EXISTS "aat_condition_report_asset_pair";
ALTER TABLE "InspectionRequest"
  DROP CONSTRAINT IF EXISTS "aat_inspection_window",
  DROP CONSTRAINT IF EXISTS "aat_inspection_schedule_window",
  DROP CONSTRAINT IF EXISTS "aat_inspection_timestamps";
ALTER TABLE "VehicleTransaction"
  DROP CONSTRAINT IF EXISTS "aat_vehicle_transaction_money",
  DROP CONSTRAINT IF EXISTS "aat_vehicle_transaction_timestamps";
ALTER TABLE "VehicleHandover"
  DROP CONSTRAINT IF EXISTS "aat_handover_values",
  DROP CONSTRAINT IF EXISTS "aat_handover_signature_pair";

DROP INDEX IF EXISTS "VehicleListing_one_live_per_vehicle_idx";
DROP INDEX IF EXISTS "VehicleImage_one_primary_per_vehicle_idx";
DROP INDEX IF EXISTS "VehicleTransaction_one_committed_buyer_per_listing";

DROP TRIGGER IF EXISTS "VehiclePriceHistory_forbid_mutation" ON "VehiclePriceHistory";
DROP TRIGGER IF EXISTS "VehicleTransactionStatusHistory_forbid_mutation" ON "VehicleTransactionStatusHistory";
DROP FUNCTION IF EXISTS "aat_forbid_vehicle_history_mutation"();

DROP TRIGGER IF EXISTS "VehicleTransaction_freeze_after_payment_attempt" ON "VehicleTransaction";
DROP FUNCTION IF EXISTS aat_freeze_vehicle_price_after_payment_attempt();
