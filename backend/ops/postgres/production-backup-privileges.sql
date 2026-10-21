-- New production database only. Run as the schema/database operator.
-- The migration role must also grant its future table/sequence SELECT defaults
-- to the backup role while authenticated as the migration role.
\set ON_ERROR_STOP on
SELECT current_database() = 'allied_autotech_production'
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'allied_production_backup'
    AND rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole
      OR rolreplication OR rolbypassrls))
  AND NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname = 'allied_production_backup')
  AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE r.rolname = 'allied_production_backup') AS safe_backup_role
\gset
\if :safe_backup_role
\else
  DO $$ BEGIN RAISE EXCEPTION 'Backup role/target guard failed'; END $$;
\endif

BEGIN;
REVOKE ALL ON DATABASE allied_autotech_production FROM allied_production_backup;
GRANT CONNECT ON DATABASE allied_autotech_production TO allied_production_backup;
REVOKE ALL ON SCHEMA public FROM allied_production_backup;
GRANT USAGE ON SCHEMA public TO allied_production_backup;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM allied_production_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO allied_production_backup;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM allied_production_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO allied_production_backup;
COMMIT;
