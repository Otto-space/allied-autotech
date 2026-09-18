ALTER TABLE "PrivilegedInvitation" ADD COLUMN "recipientId" UUID;
ALTER TABLE "PrivilegedInvitation" ADD CONSTRAINT "PrivilegedInvitation_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PrivilegedInvitation_recipientId_idx" ON "PrivilegedInvitation"("recipientId");

-- Legacy links created new accounts. Preserve their history, but never allow them
-- to grant access through the new authenticated, existing-account workflow.
UPDATE "PrivilegedInvitation" SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "PrivilegedInvitation" ADD CONSTRAINT "PrivilegedInvitation_bound_admin"
  CHECK ("usedAt" IS NOT NULL OR "revokedAt" IS NOT NULL OR
    ("recipientId" IS NOT NULL AND "recipientId" <> "invitedById" AND "role" = 'ADMIN' AND "branchId" IS NULL));
CREATE UNIQUE INDEX "PrivilegedInvitation_pending_recipient"
  ON "PrivilegedInvitation"("recipientId") WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

CREATE FUNCTION aat_protect_invitation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."recipientId" IS DISTINCT FROM OLD."recipientId"
    OR NEW."email" IS DISTINCT FROM OLD."email"
    OR NEW."role" IS DISTINCT FROM OLD."role"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."invitedById" IS DISTINCT FROM OLD."invitedById"
    OR NEW."tokenHash" IS DISTINCT FROM OLD."tokenHash"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR (OLD."usedAt" IS NOT NULL AND NEW."usedAt" IS DISTINCT FROM OLD."usedAt")
    OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
  THEN RAISE EXCEPTION 'Invitation binding and terminal states are immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PrivilegedInvitation_protect_binding" BEFORE UPDATE ON "PrivilegedInvitation"
FOR EACH ROW EXECUTE FUNCTION aat_protect_invitation_binding();
