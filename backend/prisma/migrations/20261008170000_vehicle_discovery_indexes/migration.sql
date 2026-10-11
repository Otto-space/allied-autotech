CREATE INDEX "VehicleListing_discovery_price_asc_idx" ON "VehicleListing"("status", "priceKobo", "id");
CREATE INDEX "VehicleListing_discovery_newest_idx" ON "VehicleListing"("status", "createdAt" DESC, "id" DESC);
-- Expression indexes support case-insensitive, deterministic catalogue option search.
CREATE INDEX "Vehicle_discovery_make_idx" ON "Vehicle" ((lower("make") COLLATE "C"));
CREATE INDEX "Vehicle_discovery_make_model_idx" ON "Vehicle" ((lower("make") COLLATE "C"), (lower("model") COLLATE "C"));
