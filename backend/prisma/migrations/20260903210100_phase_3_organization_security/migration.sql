CREATE TABLE "PrivilegedInvitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "branchId" UUID,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegedInvitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrivilegedInvitation_role_check"
      CHECK ("role" IN ('STAFF', 'ADMIN')),
    CONSTRAINT "PrivilegedInvitation_terminal_state_check"
      CHECK (NOT ("usedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)),
    CONSTRAINT "PrivilegedInvitation_expiry_check"
      CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "PrivilegedInvitation_branch_role_check"
      CHECK (
        ("role" = 'STAFF' AND "branchId" IS NOT NULL)
        OR ("role" = 'ADMIN' AND "branchId" IS NULL)
      )
);

CREATE UNIQUE INDEX "PrivilegedInvitation_tokenHash_key"
  ON "PrivilegedInvitation"("tokenHash");
CREATE UNIQUE INDEX "PrivilegedInvitation_active_email_key"
  ON "PrivilegedInvitation"("email")
  WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX "PrivilegedInvitation_email_idx" ON "PrivilegedInvitation"("email");
CREATE INDEX "PrivilegedInvitation_expiresAt_idx" ON "PrivilegedInvitation"("expiresAt");
CREATE INDEX "PrivilegedInvitation_invitedById_idx" ON "PrivilegedInvitation"("invitedById");
CREATE INDEX "PrivilegedInvitation_branchId_idx" ON "PrivilegedInvitation"("branchId");

ALTER TABLE "PrivilegedInvitation"
  ADD CONSTRAINT "PrivilegedInvitation_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivilegedInvitation"
  ADD CONSTRAINT "PrivilegedInvitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
