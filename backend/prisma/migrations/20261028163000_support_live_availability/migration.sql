-- Additive shared support-channel foundation. Existing case/message data is unchanged.
-- CreateEnum
CREATE TYPE "SupportConversationState" AS ENUM ('QUEUED', 'HUMAN_ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "SupportLiveCoverage" (
    "branchId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" JSONB NOT NULL,
    "maxConcurrentPerAgent" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedByUserId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportLiveCoverage_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "SupportLivePresence" (
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportLivePresence_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" UUID NOT NULL,
    "enquiryId" UUID,
    "complaintId" UUID,
    "customerId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "state" "SupportConversationState" NOT NULL DEFAULT 'QUEUED',
    "assignedUserId" UUID,
    "assignedSessionId" UUID,
    "claimedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" VARCHAR(40),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportLivePresence_branchId_available_expiresAt_idx" ON "SupportLivePresence"("branchId", "available", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportLivePresence_sessionId_idx" ON "SupportLivePresence"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportConversation_enquiryId_key" ON "SupportConversation"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportConversation_complaintId_key" ON "SupportConversation"("complaintId");

-- CreateIndex
CREATE INDEX "SupportConversation_branchId_state_createdAt_id_idx" ON "SupportConversation"("branchId", "state", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SupportConversation_assignedUserId_state_idx" ON "SupportConversation"("assignedUserId", "state");

-- CreateIndex
CREATE INDEX "SupportConversation_customerId_id_idx" ON "SupportConversation"("customerId", "id");

-- AddForeignKey
ALTER TABLE "SupportLiveCoverage" ADD CONSTRAINT "SupportLiveCoverage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLiveCoverage" ADD CONSTRAINT "SupportLiveCoverage_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLivePresence" ADD CONSTRAINT "SupportLivePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLivePresence" ADD CONSTRAINT "SupportLivePresence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLivePresence" ADD CONSTRAINT "SupportLivePresence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensive bounds complement strict API validation; no existing rows are rewritten.
ALTER TABLE "SupportLiveCoverage"
  ADD CONSTRAINT "SupportLiveCoverage_capacity_check" CHECK ("maxConcurrentPerAgent" BETWEEN 1 AND 5),
  ADD CONSTRAINT "SupportLiveCoverage_version_check" CHECK ("version" >= 0),
  ADD CONSTRAINT "SupportLiveCoverage_schedule_check" CHECK ((
    jsonb_typeof("schedule") = 'object'
    AND "schedule"->>'timezone' = 'Africa/Lagos'
    AND jsonb_typeof("schedule"->'windows') = 'array'
    AND jsonb_array_length("schedule"->'windows') <= 28
    AND (NOT "enabled" OR jsonb_array_length("schedule"->'windows') > 0)
  ) IS TRUE);
ALTER TABLE "SupportLivePresence"
  ADD CONSTRAINT "SupportLivePresence_capacity_check" CHECK ("capacity" BETWEEN 1 AND 5),
  ADD CONSTRAINT "SupportLivePresence_version_check" CHECK ("version" >= 0);
ALTER TABLE "SupportConversation"
  ADD CONSTRAINT "SupportConversation_case_check" CHECK (num_nonnulls("enquiryId", "complaintId") = 1),
  ADD CONSTRAINT "SupportConversation_version_check" CHECK ("version" >= 0),
  ADD CONSTRAINT "SupportConversation_assignment_check" CHECK (
    ("state" = 'HUMAN_ACTIVE' AND "assignedUserId" IS NOT NULL AND "assignedSessionId" IS NOT NULL AND "claimedAt" IS NOT NULL)
    OR ("state" <> 'HUMAN_ACTIVE' AND "assignedUserId" IS NULL AND "assignedSessionId" IS NULL)
  ),
  ADD CONSTRAINT "SupportConversation_end_check" CHECK (
    ("state" = 'ENDED' AND "endedAt" IS NOT NULL AND "endReason" IS NOT NULL AND length(btrim("endReason")) > 0)
    OR ("state" <> 'ENDED' AND "endedAt" IS NULL AND "endReason" IS NULL)
  );
