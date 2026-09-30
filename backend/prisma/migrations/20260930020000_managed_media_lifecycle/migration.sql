-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "mediaVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CustomerVehicle" ADD COLUMN     "mediaVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "mediaAssetId" UUID;

-- AlterTable
ALTER TABLE "VehicleImage" ADD COLUMN     "mediaAssetId" UUID;

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "actorUserId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "resourceType" VARCHAR(24) NOT NULL,
    "resourceId" UUID NOT NULL,
    "purpose" VARCHAR(24) NOT NULL,
    "branchId" UUID,
    "objectKey" TEXT NOT NULL,
    "verifiedObjectKey" TEXT NOT NULL,
    "mimeType" VARCHAR(32) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "requestHash" CHAR(64),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredMedia" (
    "id" UUID NOT NULL,
    "uploadId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" VARCHAR(32) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceImage" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "profileId" UUID,
    "customerVehicleId" UUID,
    "serviceId" UUID,
    "altText" VARCHAR(240),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCleanupJob" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaCleanupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_tokenHash_key" ON "MediaUpload"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_objectKey_key" ON "MediaUpload"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_verifiedObjectKey_key" ON "MediaUpload"("verifiedObjectKey");

-- CreateIndex
CREATE INDEX "MediaUpload_expiresAt_idx" ON "MediaUpload"("expiresAt");

-- CreateIndex
CREATE INDEX "MediaUpload_actorUserId_createdAt_idx" ON "MediaUpload"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaUpload_ownerUserId_idx" ON "MediaUpload"("ownerUserId");

-- CreateIndex
CREATE INDEX "MediaUpload_resourceType_resourceId_idx" ON "MediaUpload"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredMedia_uploadId_key" ON "StoredMedia"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredMedia_objectKey_key" ON "StoredMedia"("objectKey");

-- CreateIndex
CREATE INDEX "StoredMedia_deletedAt_createdAt_idx" ON "StoredMedia"("deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceImage_assetId_key" ON "ResourceImage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceImage_profileId_key" ON "ResourceImage"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceImage_serviceId_key" ON "ResourceImage"("serviceId");

-- CreateIndex
CREATE INDEX "ResourceImage_customerVehicleId_sortOrder_id_idx" ON "ResourceImage"("customerVehicleId", "sortOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MediaCleanupJob_objectKey_key" ON "MediaCleanupJob"("objectKey");

-- CreateIndex
CREATE INDEX "MediaCleanupJob_completedAt_availableAt_idx" ON "MediaCleanupJob"("completedAt", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_mediaAssetId_key" ON "ProductImage"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImage_mediaAssetId_key" ON "VehicleImage"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "StoredMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "StoredMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredMedia" ADD CONSTRAINT "StoredMedia_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "MediaUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "StoredMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_customerVehicleId_fkey" FOREIGN KEY ("customerVehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Resource binding and format invariants, independent of API validation.
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_one_parent" CHECK (num_nonnulls("profileId", "customerVehicleId", "serviceId") = 1);
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_order_valid" CHECK ("sortOrder" >= 0 AND "sortOrder" <= 10000);
CREATE UNIQUE INDEX "ResourceImage_garage_primary" ON "ResourceImage" ("customerVehicleId") WHERE "isPrimary" AND "customerVehicleId" IS NOT NULL;
ALTER TABLE "StoredMedia" ADD CONSTRAINT "StoredMedia_valid" CHECK ("width" BETWEEN 32 AND 8192 AND "height" BETWEEN 32 AND 8192 AND "sizeBytes" > 0 AND "mimeType" = 'image/webp' AND "checksumSha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_valid" CHECK ("resourceType" IN ('PROFILE','GARAGE','SERVICE','PRODUCT','STOCK') AND "purpose" = CASE WHEN "resourceType" = 'PROFILE' THEN 'PROFILE_PHOTO' ELSE "resourceType" || '_IMAGE' END AND "sizeBytes" BETWEEN 1 AND 10485760 AND "mimeType" IN ('image/jpeg','image/png','image/webp') AND "checksumSha256" ~ '^[0-9a-f]{64}$' AND "expiresAt" > "createdAt");
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_confirmation" CHECK (("confirmedAt" IS NULL AND "requestHash" IS NULL AND "result" IS NULL) OR ("confirmedAt" IS NOT NULL AND "requestHash" IS NOT NULL AND "result" IS NOT NULL AND "rejectedAt" IS NULL));
