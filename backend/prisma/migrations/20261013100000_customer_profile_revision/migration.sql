ALTER TABLE "CustomerProfile" ADD COLUMN "profileVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_profileVersion_nonnegative" CHECK ("profileVersion" >= 0);

CREATE FUNCTION aat_customer_profile_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."profileVersion" <> OLD."profileVersion"
     AND NEW."profileVersion"::bigint <> OLD."profileVersion"::bigint + 1 THEN
    RAISE EXCEPTION 'Invalid customer profile revision transition' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW."firstName", NEW."lastName", NEW."phone", NEW."address", NEW."city", NEW."state", NEW."country")
     IS DISTINCT FROM ROW(OLD."firstName", OLD."lastName", OLD."phone", OLD."address", OLD."city", OLD."state", OLD."country") THEN
    NEW."profileVersion" := OLD."profileVersion" + 1;
  END IF;
  IF NEW."phone" IS DISTINCT FROM OLD."phone" THEN
    NEW."phoneVerifiedAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CustomerProfile_revision_guard"
BEFORE UPDATE ON "CustomerProfile"
FOR EACH ROW EXECUTE FUNCTION aat_customer_profile_revision();
