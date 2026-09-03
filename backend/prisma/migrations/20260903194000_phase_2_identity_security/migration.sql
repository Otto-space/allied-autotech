-- Phase 2 identity/session security. Existing sessions are revoked during the
-- backfill so no pre-migration session can bypass the new CSRF or MFA state.

CREATE TYPE "MfaChallengePurpose" AS ENUM ('REGISTRATION', 'AUTHENTICATION');

ALTER TABLE "Session"
  ADD COLUMN "csrfTokenHash" CHAR(64),
  ADD COLUMN "idleExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

UPDATE "Session"
   SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
       "idleExpiresAt" = "expiresAt",
       "lastRotatedAt" = LEAST(CURRENT_TIMESTAMP, "expiresAt");

CREATE TABLE "MfaChallenge" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "purpose" "MfaChallengePurpose" NOT NULL,
  "challengeHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthenticationThrottle" (
  "id" UUID NOT NULL,
  "keyHash" CHAR(64) NOT NULL,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthenticationThrottle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaChallenge_challengeHash_key" ON "MfaChallenge"("challengeHash");
CREATE INDEX "MfaChallenge_userId_purpose_expiresAt_idx" ON "MfaChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX "MfaChallenge_sessionId_purpose_expiresAt_idx" ON "MfaChallenge"("sessionId", "purpose", "expiresAt");
CREATE UNIQUE INDEX "AuthenticationThrottle_keyHash_key" ON "AuthenticationThrottle"("keyHash");
CREATE INDEX "AuthenticationThrottle_blockedUntil_idx" ON "AuthenticationThrottle"("blockedUntil");
CREATE INDEX "AuthenticationThrottle_expiresAt_idx" ON "AuthenticationThrottle"("expiresAt");
CREATE INDEX "Session_idleExpiresAt_idx" ON "Session"("idleExpiresAt");

ALTER TABLE "MfaChallenge"
  ADD CONSTRAINT "MfaChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MfaChallenge_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "aat_mfa_challenge_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_mfa_challenge_used_valid"
  CHECK ("usedAt" IS NULL OR ("usedAt" >= "createdAt" AND "usedAt" <= "expiresAt"));

ALTER TABLE "AuthenticationThrottle"
  ADD CONSTRAINT "aat_auth_throttle_hash_valid"
  CHECK ("keyHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_auth_throttle_failures_nonnegative"
  CHECK ("failedCount" >= 0),
  ADD CONSTRAINT "aat_auth_throttle_expiry_valid"
  CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "aat_auth_throttle_block_valid"
  CHECK ("blockedUntil" IS NULL OR "blockedUntil" <= "expiresAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "aat_session_csrf_hash_valid"
  CHECK ("csrfTokenHash" IS NULL OR "csrfTokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aat_session_idle_expiry_valid"
  CHECK ("idleExpiresAt" > "createdAt" AND "idleExpiresAt" <= "expiresAt"),
  ADD CONSTRAINT "aat_session_rotation_valid"
  CHECK ("lastRotatedAt" >= "createdAt" AND "lastRotatedAt" <= "expiresAt"),
  ADD CONSTRAINT "aat_session_mfa_valid"
  CHECK (
    (NOT "mfaRequired" AND "mfaVerifiedAt" IS NULL)
    OR ("mfaRequired" AND ("mfaVerifiedAt" IS NULL OR "mfaVerifiedAt" >= "createdAt"))
  );
