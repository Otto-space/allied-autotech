-- Additive guest purchase identity only. No User, CustomerProfile, commercial
-- record, permission or existing data is changed; no anonymous account is made.
CREATE TABLE "PurchaseGuest" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseGuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseGuestChallenge" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "browserBindingHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseGuestChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseGuestChallenge_expiry" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "PurchaseGuestSession" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfTokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseGuestSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseGuestSession_expiry" CHECK (
      "expiresAt" > "createdAt" AND "idleExpiresAt" <= "expiresAt"
    )
);

CREATE UNIQUE INDEX "PurchaseGuest_email_key" ON "PurchaseGuest"("email");
CREATE UNIQUE INDEX "PurchaseGuestChallenge_tokenHash_key" ON "PurchaseGuestChallenge"("tokenHash");
CREATE INDEX "PurchaseGuestChallenge_email_createdAt_idx" ON "PurchaseGuestChallenge"("email", "createdAt");
CREATE INDEX "PurchaseGuestChallenge_expiresAt_idx" ON "PurchaseGuestChallenge"("expiresAt");
CREATE UNIQUE INDEX "PurchaseGuestSession_tokenHash_key" ON "PurchaseGuestSession"("tokenHash");
CREATE INDEX "PurchaseGuestSession_guestId_revokedAt_idx" ON "PurchaseGuestSession"("guestId", "revokedAt");
CREATE INDEX "PurchaseGuestSession_expiresAt_idx" ON "PurchaseGuestSession"("expiresAt");
ALTER TABLE "PurchaseGuestSession" ADD CONSTRAINT "PurchaseGuestSession_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "PurchaseGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
