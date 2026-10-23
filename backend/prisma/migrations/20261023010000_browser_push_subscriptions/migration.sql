-- Additive only: existing records and notification channel preferences are unchanged.
CREATE TABLE "PushSubscription" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "endpointHash" CHAR(64) NOT NULL,
  "encryptedSubscription" JSONB NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PushSubscription_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");
CREATE INDEX "PushSubscription_userId_disabledAt_idx" ON "PushSubscription"("userId", "disabledAt");
CREATE INDEX "PushSubscription_sessionId_idx" ON "PushSubscription"("sessionId");
