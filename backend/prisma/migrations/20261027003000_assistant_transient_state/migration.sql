-- Compatible expansion only. No business records or existing tables are rewritten.
CREATE TYPE "AssistantAudience" AS ENUM ('PUBLIC', 'CUSTOMER', 'WORK');
CREATE TYPE "AssistantTurnStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AssistantGuestSession" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistantGuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantConversation" (
    "id" UUID NOT NULL,
    "ownerKey" CHAR(64) NOT NULL,
    "audience" "AssistantAudience" NOT NULL,
    "accessKey" CHAR(64) NOT NULL,
    "sourceSet" CHAR(64) NOT NULL,
    "encryptedState" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssistantConversation_version_positive" CHECK ("version" > 0),
    CONSTRAINT "AssistantConversation_expiry_bound" CHECK ("expiresAt" <= "absoluteExpiresAt")
);

CREATE TABLE "AssistantTurn" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "status" "AssistantTurnStatus" NOT NULL DEFAULT 'PENDING',
    "quotaKey" CHAR(64) NOT NULL,
    "reservedTokens" INTEGER NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "encryptedResult" JSONB,
    "failureCode" VARCHAR(40),
    "model" VARCHAR(120),
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AssistantTurn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssistantTurn_reservation_positive" CHECK ("reservedTokens" > 0),
    CONSTRAINT "AssistantTurn_usage_nonnegative" CHECK (
        ("inputTokens" IS NULL OR "inputTokens" >= 0) AND
        ("outputTokens" IS NULL OR "outputTokens" >= 0) AND
        ("totalTokens" IS NULL OR "totalTokens" >= 0) AND
        ("durationMs" IS NULL OR "durationMs" >= 0)
    )
);

CREATE UNIQUE INDEX "AssistantGuestSession_tokenHash_key" ON "AssistantGuestSession"("tokenHash");
CREATE INDEX "AssistantGuestSession_expiresAt_idx" ON "AssistantGuestSession"("expiresAt");
CREATE INDEX "AssistantConversation_ownerKey_closedAt_expiresAt_idx" ON "AssistantConversation"("ownerKey", "closedAt", "expiresAt");
CREATE INDEX "AssistantConversation_expiresAt_idx" ON "AssistantConversation"("expiresAt");
CREATE UNIQUE INDEX "AssistantTurn_conversationId_operationId_key" ON "AssistantTurn"("conversationId", "operationId");
CREATE INDEX "AssistantTurn_status_leaseExpiresAt_idx" ON "AssistantTurn"("status", "leaseExpiresAt");
CREATE INDEX "AssistantTurn_conversationId_createdAt_idx" ON "AssistantTurn"("conversationId", "createdAt");
ALTER TABLE "AssistantTurn" ADD CONSTRAINT "AssistantTurn_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
