-- Fail rather than select an owner or silently modify existing accounts.
-- The partial unique index also serializes competing owner inserts/promotions.
CREATE UNIQUE INDEX "User_single_super_admin" ON "User" ("role")
WHERE "role" = 'SUPER_ADMIN';

ALTER TABLE "User" ADD CONSTRAINT "User_super_admin_active_verified"
CHECK ("role" <> 'SUPER_ADMIN' OR ("status" = 'ACTIVE' AND "emailVerifiedAt" IS NOT NULL));

CREATE FUNCTION protect_sole_super_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."role" = 'SUPER_ADMIN' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'The sole owner cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF NEW."role" IS DISTINCT FROM OLD."role"
       OR NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."email" IS DISTINCT FROM OLD."email"
       OR NEW."emailVerifiedAt" IS NULL THEN
      RAISE EXCEPTION 'The sole owner identity and active authority are protected' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_protect_sole_super_admin"
BEFORE UPDATE OR DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION protect_sole_super_admin();
