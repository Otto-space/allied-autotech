-- Preserve legacy staff-attributed history while allowing real administrator
-- accounts to act without manufacturing an employee profile. No row is changed.
ALTER TABLE "VehiclePriceHistory" ADD COLUMN "changedByUserId" UUID;
ALTER TABLE "VehiclePriceHistory" ALTER COLUMN "changedByStaffId" DROP NOT NULL;
ALTER TABLE "VehiclePriceHistory"
  ADD CONSTRAINT "VehiclePriceHistory_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehiclePriceHistory"
  ADD CONSTRAINT "VehiclePriceHistory_actor_required"
  CHECK ("changedByUserId" IS NOT NULL OR "changedByStaffId" IS NOT NULL);

ALTER TABLE "VehicleDocument" ADD COLUMN "reviewedByUserId" UUID;
ALTER TABLE "VehicleDocument"
  ADD CONSTRAINT "VehicleDocument_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
