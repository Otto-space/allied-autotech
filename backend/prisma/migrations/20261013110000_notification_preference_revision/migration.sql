-- Existing preferences retain their values, timestamps and consent history.
ALTER TABLE "NotificationPreference" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_version_positive" CHECK ("version" > 0);

-- Every update advances the revision, including older/direct database writers.
CREATE FUNCTION notification_preference_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."version" := OLD."version" + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_preference_revision_before_update
BEFORE UPDATE ON "NotificationPreference"
FOR EACH ROW EXECUTE FUNCTION notification_preference_revision();
