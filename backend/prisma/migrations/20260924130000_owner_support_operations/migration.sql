ALTER TABLE "Complaint" ADD COLUMN "acknowledgedAt" TIMESTAMP(3), ADD COLUMN "acknowledgedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 ADD COLUMN "acknowledgementDueAt" TIMESTAMP(3), ADD COLUMN "slaPolicySnapshot" JSONB, ADD COLUMN "escalatedAt" TIMESTAMP(3);
CREATE TABLE "RateLimitBucket" ("key" CHAR(64) PRIMARY KEY, "hits" INTEGER NOT NULL CHECK ("hits" >= 0), "resetAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
CREATE TABLE "OperationalAlert" ("id" UUID PRIMARY KEY, "key" VARCHAR(200) NOT NULL UNIQUE, "category" VARCHAR(80) NOT NULL, "resourceId" UUID, "message" VARCHAR(1000) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolvedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT);
CREATE INDEX "OperationalAlert_resolvedAt_createdAt_idx" ON "OperationalAlert"("resolvedAt","createdAt");
CREATE TABLE "WorkerHeartbeat" ("name" VARCHAR(100) PRIMARY KEY, "lastStartedAt" TIMESTAMP(3) NOT NULL, "lastSucceededAt" TIMESTAMP(3), "lastFailedAt" TIMESTAMP(3), "errorCode" VARCHAR(100));
CREATE TABLE "ConsentRecord" ("id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "scope" VARCHAR(100) NOT NULL, "source" VARCHAR(100) NOT NULL, "wordingVersion" VARCHAR(100) NOT NULL, "granted" BOOLEAN NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "ConsentRecord_userId_scope_recordedAt_idx" ON "ConsentRecord"("userId","scope","recordedAt");
CREATE TRIGGER "ConsentRecord_immutable" BEFORE UPDATE OR DELETE ON "ConsentRecord" FOR EACH ROW EXECUTE FUNCTION aat_immutable_policy();
CREATE TABLE "PrivacyRequest" ("id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "kind" VARCHAR(24) NOT NULL CHECK ("kind" IN ('ANONYMIZATION','DELETION')), "reason" VARCHAR(2000) NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED','UNDER_REVIEW','ON_HOLD','APPROVED_PENDING_POLICY','REJECTED')), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3), "reviewedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT, "reviewNote" VARCHAR(2000));
CREATE INDEX "PrivacyRequest_userId_createdAt_idx" ON "PrivacyRequest"("userId","createdAt");
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status","createdAt");
CREATE TABLE "RetentionHold" ("id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "recordType" VARCHAR(80) NOT NULL, "recordId" UUID, "reason" VARCHAR(2000) NOT NULL, "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "releasedAt" TIMESTAMP(3), "releasedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT);
CREATE INDEX "RetentionHold_userId_releasedAt_idx" ON "RetentionHold"("userId","releasedAt");
