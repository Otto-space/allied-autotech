-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "qualityApprovedAt" TIMESTAMP(3),
ADD COLUMN     "qualityApprovedByUserId" UUID,
ADD COLUMN     "workedByUserIds" UUID[] DEFAULT ARRAY[]::UUID[];

-- CreateTable
CREATE TABLE "WorkforceAccess" (
    "userId" UUID NOT NULL,
    "position" VARCHAR(80) NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "delegatedTemplates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "delegatedBranchIds" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "WorkforceAccess_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WorkforceAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "template" VARCHAR(80) NOT NULL,
    "branchId" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "temporary" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reason" VARCHAR(1000) NOT NULL,
    "assignedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" UUID,
    "revocationReason" VARCHAR(1000),

    CONSTRAINT "WorkforceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkforceAssignment_userId_revokedAt_startsAt_expiresAt_idx" ON "WorkforceAssignment"("userId", "revokedAt", "startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkforceAssignment_branchId_idx" ON "WorkforceAssignment"("branchId");

-- AddForeignKey
ALTER TABLE "WorkforceAccess" ADD CONSTRAINT "WorkforceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceAssignment" ADD CONSTRAINT "WorkforceAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "WorkforceAccess"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceAssignment" ADD CONSTRAINT "WorkforceAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
