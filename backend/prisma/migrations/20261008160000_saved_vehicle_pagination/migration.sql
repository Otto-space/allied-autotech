-- Owner-scoped keyset traversal, including when the prior page's anchor is removed.
CREATE INDEX "SavedVehicle_customerId_id_idx" ON "SavedVehicle"("customerId", "id");
