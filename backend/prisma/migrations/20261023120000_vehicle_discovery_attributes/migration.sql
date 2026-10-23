-- Additive attributes only. Existing unknown values are never inferred from brands/fuel.
ALTER TYPE "VehicleCondition" ADD VALUE 'FOREIGN_USED';
ALTER TYPE "VehicleCondition" ADD VALUE 'LOCALLY_USED';
CREATE TYPE "Powertrain" AS ENUM ('BEV', 'HEV', 'PHEV', 'ICE');
ALTER TABLE "Vehicle"
  ADD COLUMN "manufactureCountryCode" CHAR(2),
  ADD COLUMN "powertrain" "Powertrain",
  ADD COLUMN "engineCapacityCc" INTEGER,
  ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "Vehicle_engineCapacityCc_check" CHECK ("engineCapacityCc" IS NULL OR "engineCapacityCc" BETWEEN 1 AND 30000),
  ADD CONSTRAINT "Vehicle_manufactureCountryCode_check" CHECK ("manufactureCountryCode" IS NULL OR "manufactureCountryCode" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "Vehicle_features_count_check" CHECK (cardinality("features") <= 40);
CREATE INDEX "Vehicle_manufactureCountryCode_powertrain_condition_idx" ON "Vehicle"("manufactureCountryCode", "powertrain", "condition");
CREATE INDEX "Vehicle_mileageKm_id_idx" ON "Vehicle"("mileageKm", "id");
