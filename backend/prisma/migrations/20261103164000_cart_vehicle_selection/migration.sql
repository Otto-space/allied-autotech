BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "CartItem" ADD COLUMN "vehicleSelection" JSONB;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_vehicleSelection_object"
  CHECK ("vehicleSelection" IS NULL OR jsonb_typeof("vehicleSelection") = 'object');
COMMIT;
