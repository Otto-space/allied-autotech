-- Compatible optional supplied description. Keep exact recorded capacity and
-- the historical engineSize, engineCode and feature items unchanged.
ALTER TABLE "Vehicle" ADD COLUMN "engineDetails" VARCHAR(500);
