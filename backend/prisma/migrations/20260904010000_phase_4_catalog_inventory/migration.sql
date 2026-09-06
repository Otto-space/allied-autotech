-- Phase 4 catalogue, cart, and inventory reservation hardening.
-- New enum types may be created and used in one transaction; unlike ALTER TYPE
-- ADD VALUE, they do not require a separate committed migration.
CREATE TYPE "InventoryReservationStatus" AS ENUM (
  'ACTIVE',
  'RELEASED',
  'CONSUMED',
  'EXPIRED'
);

ALTER TABLE "InventoryTransaction"
  ADD COLUMN "requestHash" CHAR(64);

CREATE TABLE "InventoryReservation" (
  "id" UUID NOT NULL,
  "inventoryId" UUID NOT NULL,
  "customerId" UUID,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "referenceType" VARCHAR(60),
  "referenceId" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aat_inventory_reservation_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "aat_inventory_reservation_expiry_valid" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "aat_inventory_reservation_lifecycle_valid" CHECK (
    ("status" = 'ACTIVE' AND "releasedAt" IS NULL AND "consumedAt" IS NULL AND "expiredAt" IS NULL)
    OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "consumedAt" IS NULL AND "expiredAt" IS NULL)
    OR ("status" = 'CONSUMED' AND "releasedAt" IS NULL AND "consumedAt" IS NOT NULL AND "expiredAt" IS NULL)
    OR ("status" = 'EXPIRED' AND "releasedAt" IS NULL AND "consumedAt" IS NULL AND "expiredAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "InventoryReservation_idempotencyKey_key"
  ON "InventoryReservation" ("idempotencyKey");
CREATE INDEX "InventoryReservation_inventoryId_status_expiresAt_idx"
  ON "InventoryReservation" ("inventoryId", "status", "expiresAt");
CREATE INDEX "InventoryReservation_customerId_status_createdAt_idx"
  ON "InventoryReservation" ("customerId", "status", "createdAt");
CREATE INDEX "InventoryReservation_status_expiresAt_idx"
  ON "InventoryReservation" ("status", "expiresAt");
CREATE INDEX "InventoryReservation_referenceType_referenceId_idx"
  ON "InventoryReservation" ("referenceType", "referenceId");
CREATE UNIQUE INDEX "InventoryReservation_one_active_reference"
  ON "InventoryReservation" ("inventoryId", "referenceType", "referenceId")
  WHERE "status" = 'ACTIVE' AND "referenceType" IS NOT NULL AND "referenceId" IS NOT NULL;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_inventoryId_fkey"
  FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryReservation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match the public keyset-pagination and filter shapes used by the API.
CREATE INDEX "Category_public_name_id_idx"
  ON "Category" ("name", "id") WHERE "isActive" = true;
CREATE INDEX "Product_public_created_id_idx"
  ON "Product" ("createdAt" DESC, "id" DESC) WHERE "isActive" = true;
CREATE INDEX "Product_public_name_id_idx"
  ON "Product" ("name", "id") WHERE "isActive" = true;
CREATE INDEX "Product_public_price_id_idx"
  ON "Product" ("priceKobo", "id") WHERE "isActive" = true;
CREATE INDEX "Inventory_branch_id_idx"
  ON "Inventory" ("branchId", "id");

CREATE OR REPLACE FUNCTION aat_protect_inventory_reservation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Inventory reservations are append-preserving lifecycle records';
  END IF;

  IF OLD."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Terminal inventory reservations are immutable';
  END IF;

  IF NEW."inventoryId" IS DISTINCT FROM OLD."inventoryId"
    OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW."quantity" IS DISTINCT FROM OLD."quantity"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."referenceType" IS DISTINCT FROM OLD."referenceType"
    OR NEW."referenceId" IS DISTINCT FROM OLD."referenceId"
  THEN
    RAISE EXCEPTION 'Inventory reservation identity fields are immutable';
  END IF;

  IF NEW."status" NOT IN ('RELEASED', 'CONSUMED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Invalid inventory reservation transition';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "InventoryReservation_protect_lifecycle"
BEFORE UPDATE OR DELETE ON "InventoryReservation"
FOR EACH ROW EXECUTE FUNCTION aat_protect_inventory_reservation();
