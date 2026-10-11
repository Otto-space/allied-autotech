ALTER TYPE "AuditEntityType" ADD VALUE 'SERVICE_CATEGORY';

CREATE TABLE "ServiceCategory" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");
CREATE INDEX "ServiceCategory_isActive_name_id_idx" ON "ServiceCategory"("isActive", "name", "id");
ALTER TABLE "Service" ADD COLUMN "categoryId" UUID;
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Service_isActive_name_id_idx" ON "Service"("isActive", "name", "id");
CREATE INDEX "Service_isActive_createdAt_id_idx" ON "Service"("isActive", "createdAt" DESC, "id" DESC);
CREATE INDEX "Service_isActive_durationMinutes_id_idx" ON "Service"("isActive", "durationMinutes", "id");
CREATE INDEX "Service_categoryId_isActive_id_idx" ON "Service"("categoryId", "isActive", "id");
-- pg_trgm is installed by 20260904111500_phase_4_query_indexes.
CREATE INDEX "Service_name_search_idx" ON "Service" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Service_shortDescription_search_idx" ON "Service" USING GIN ("shortDescription" gin_trgm_ops);
CREATE INDEX "Service_description_search_idx" ON "Service" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "ServiceCategory_name_search_idx" ON "ServiceCategory" USING GIN ("name" gin_trgm_ops);
