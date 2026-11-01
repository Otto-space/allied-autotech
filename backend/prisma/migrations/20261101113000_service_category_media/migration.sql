-- Add optional category media through the existing managed-media lifecycle.
ALTER TABLE "ResourceImage" ADD COLUMN "serviceCategoryId" UUID;
CREATE UNIQUE INDEX "ResourceImage_serviceCategoryId_key" ON "ResourceImage"("serviceCategoryId");
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_serviceCategoryId_fkey"
  FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceImage" DROP CONSTRAINT "ResourceImage_one_parent";
ALTER TABLE "ResourceImage" ADD CONSTRAINT "ResourceImage_one_parent"
  CHECK (num_nonnulls("profileId", "customerVehicleId", "serviceId", "serviceCategoryId") = 1);

ALTER TABLE "MediaUpload" DROP CONSTRAINT "MediaUpload_valid";
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_valid" CHECK ("resourceType" IN ('PROFILE','GARAGE','SERVICE','SERVICE_CATEGORY','PRODUCT','STOCK') AND "purpose" = CASE WHEN "resourceType" = 'PROFILE' THEN 'PROFILE_PHOTO' ELSE "resourceType" || '_IMAGE' END AND "sizeBytes" BETWEEN 1 AND 10485760 AND "mimeType" IN ('image/jpeg','image/png','image/webp') AND "checksumSha256" ~ '^[0-9a-f]{64}$' AND "expiresAt" > "createdAt");
