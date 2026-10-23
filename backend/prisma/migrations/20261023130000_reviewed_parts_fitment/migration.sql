-- Additive fitment/catalogue/garage extension. Existing compatibility rows remain DRAFT.
ALTER TYPE "AuditEntityType" ADD VALUE 'FITMENT_MAKE';
ALTER TYPE "AuditEntityType" ADD VALUE 'FITMENT_MODEL';
ALTER TYPE "AuditEntityType" ADD VALUE 'PRODUCT_FITMENT';

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "ProductClassification" AS ENUM ('GENUINE_OEM', 'AFTERMARKET');

-- CreateEnum
CREATE TYPE "FitmentReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "FitmentScope" AS ENUM ('MODEL', 'UNIVERSAL');

-- CreateEnum
CREATE TYPE "FitmentEffect" AS ENUM ('INCLUDE', 'EXCLUDE');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" UUID;

-- AlterTable
ALTER TABLE "CustomerVehicle" ADD COLUMN     "bodyType" VARCHAR(100),
ADD COLUMN     "brakeDiameterMm" VARCHAR(100),
ADD COLUMN     "brakeSystem" VARCHAR(100),
ADD COLUMN     "chassisCode" VARCHAR(100),
ADD COLUMN     "defaultSlot" INTEGER,
ADD COLUMN     "engineCode" VARCHAR(100),
ADD COLUMN     "generation" VARCHAR(100),
ADD COLUMN     "market" VARCHAR(100),
ADD COLUMN     "nickname" VARCHAR(80),
ADD COLUMN     "transmission" VARCHAR(100),
ADD COLUMN     "trim" VARCHAR(100),
ADD COLUMN     "vehicleModelId" UUID;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "classification" "ProductClassification",
ADD COLUMN     "condition" "ProductCondition",
ADD COLUMN     "productType" VARCHAR(80);

-- AlterTable
ALTER TABLE "ProductCompatibility" ADD COLUMN     "allVariantsConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bodyType" VARCHAR(100),
ADD COLUMN     "brakeDiameterMm" VARCHAR(100),
ADD COLUMN     "brakeSystem" VARCHAR(100),
ADD COLUMN     "branchId" UUID,
ADD COLUMN     "chassisCode" VARCHAR(100),
ADD COLUMN     "createdByUserId" UUID,
ADD COLUMN     "effect" "FitmentEffect" NOT NULL DEFAULT 'INCLUDE',
ADD COLUMN     "engineCode" VARCHAR(100),
ADD COLUMN     "evidenceNotes" VARCHAR(2000),
ADD COLUMN     "fingerprint" CHAR(64),
ADD COLUMN     "generation" VARCHAR(100),
ADD COLUMN     "market" VARCHAR(100),
ADD COLUMN     "position" VARCHAR(100),
ADD COLUMN     "requiredQualifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewNote" VARCHAR(1000),
ADD COLUMN     "reviewStatus" "FitmentReviewStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" UUID,
ADD COLUMN     "safetyCritical" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "scope" "FitmentScope" NOT NULL DEFAULT 'MODEL',
ADD COLUMN     "sourceReference" VARCHAR(500),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "transmission" VARCHAR(100),
ADD COLUMN     "trim" VARCHAR(100),
ADD COLUMN     "updatedByUserId" UUID,
ADD COLUMN     "vehicleModelId" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VehicleMake" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" UUID NOT NULL,
    "makeId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceReference" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibilityHistory" (
    "id" UUID NOT NULL,
    "compatibilityId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCompatibilityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_key_key" ON "VehicleMake"("key");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_key_key" ON "VehicleModel"("makeId", "key");

-- CreateIndex
CREATE INDEX "ProductCompatibilityHistory_createdAt_id_idx" ON "ProductCompatibilityHistory"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibilityHistory_compatibilityId_version_key" ON "ProductCompatibilityHistory"("compatibilityId", "version");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVehicle_customerId_defaultSlot_key" ON "CustomerVehicle"("customerId", "defaultSlot");

-- CreateIndex
CREATE INDEX "Product_condition_classification_idx" ON "Product"("condition", "classification");

-- CreateIndex
CREATE INDEX "ProductCompatibility_vehicleModelId_reviewStatus_yearFrom_y_idx" ON "ProductCompatibility"("vehicleModelId", "reviewStatus", "yearFrom", "yearTo");

-- CreateIndex
CREATE INDEX "ProductCompatibility_productId_reviewStatus_effect_idx" ON "ProductCompatibility"("productId", "reviewStatus", "effect");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibility_productId_fingerprint_key" ON "ProductCompatibility"("productId", "fingerprint");

-- AddForeignKey
ALTER TABLE "CustomerVehicle" ADD CONSTRAINT "CustomerVehicle_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibilityHistory" ADD CONSTRAINT "ProductCompatibilityHistory_compatibilityId_fkey" FOREIGN KEY ("compatibilityId") REFERENCES "ProductCompatibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibilityHistory" ADD CONSTRAINT "ProductCompatibilityHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Named invariants complement request validation and keep legacy unreviewed rows valid.
ALTER TABLE "Category" ADD CONSTRAINT "Category_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "CustomerVehicle" ADD CONSTRAINT "CustomerVehicle_default_slot_check" CHECK ("defaultSlot" IS NULL OR "defaultSlot" = 1);
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_year_range_check" CHECK ("yearFrom" BETWEEN 1886 AND 2200 AND "yearTo" BETWEEN "yearFrom" AND 2200);
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_reviewed_scope_check" CHECK (
  "reviewStatus" <> 'APPROVED' OR (
    "sourceReference" IS NOT NULL AND length(btrim("sourceReference")) > 0
    AND "evidenceNotes" IS NOT NULL AND length(btrim("evidenceNotes")) > 0
    AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL
    AND "createdByUserId" IS NOT NULL AND "updatedByUserId" IS NOT NULL
    AND "reviewedByUserId" <> "createdByUserId" AND "reviewedByUserId" <> "updatedByUserId"
    AND "allVariantsConfirmed" = true
    AND (
      ("scope" = 'MODEL' AND "vehicleModelId" IS NOT NULL AND "yearFrom" IS NOT NULL AND "yearTo" IS NOT NULL AND "yearFrom" BETWEEN 1886 AND 2200 AND "yearTo" BETWEEN "yearFrom" AND 2200)
      OR ("scope" = 'UNIVERSAL' AND "vehicleModelId" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL AND NOT "safetyCritical" AND "effect" = 'INCLUDE' AND cardinality("requiredQualifiers") = 0 AND "trim" IS NULL AND "engineCode" IS NULL AND "market" IS NULL AND "position" IS NULL AND "brakeSystem" IS NULL AND "brakeDiameterMm" IS NULL AND "bodyType" IS NULL AND "transmission" IS NULL AND "generation" IS NULL AND "chassisCode" IS NULL)
    )
    AND (NOT "safetyCritical" OR ("scope" = 'MODEL' AND "position" IS NOT NULL AND "brakeSystem" IS NOT NULL AND "requiredQualifiers" @> ARRAY['position','brakeSystem']::text[]))
  )
);
CREATE FUNCTION protect_fitment_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Fitment history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "ProductCompatibilityHistory_append_only" BEFORE UPDATE OR DELETE ON "ProductCompatibilityHistory" FOR EACH ROW EXECUTE FUNCTION protect_fitment_history();

CREATE TRIGGER "ProductCompatibilityHistory_no_truncate" BEFORE TRUNCATE ON "ProductCompatibilityHistory" FOR EACH STATEMENT EXECUTE FUNCTION protect_fitment_history();
