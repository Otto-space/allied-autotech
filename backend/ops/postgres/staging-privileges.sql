-- Run with psql as an authorized database/schema owner, after creating the two
-- login roles through DigitalOcean. Supply role names with -v, never passwords.
\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'Supply -v runtime_role=<existing role>'
  DO $$ BEGIN RAISE EXCEPTION 'Missing runtime_role'; END $$;
\endif
\if :{?migration_role}
\else
  \echo 'Supply -v migration_role=<existing role>'
  DO $$ BEGIN RAISE EXCEPTION 'Missing migration_role'; END $$;
\endif

SELECT current_database() = 'allied_autotech_staging'
  AND :'runtime_role' <> :'migration_role'
  AND :'runtime_role' NOT IN ('doadmin', 'postgres')
  AND :'migration_role' NOT IN ('doadmin', 'postgres')
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role' AND rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_role' AND rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  AND NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname IN (:'runtime_role', :'migration_role'))
  AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE r.rolname = :'runtime_role')
  AND NOT EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
    WHERE r.rolname = :'runtime_role')
  AND NOT EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
    WHERE r.rolname = :'runtime_role') AS safe_staging_roles
\gset
\if :safe_staging_roles
\else
  \echo 'Role/database guard failed. Inspect role attributes, memberships and ownership; no grants changed.'
  DO $$ BEGIN RAISE EXCEPTION 'Staging role guard failed'; END $$;
\endif

BEGIN;
REVOKE ALL ON DATABASE allied_autotech_staging FROM PUBLIC;
REVOKE ALL ON DATABASE allied_autotech_staging FROM :"runtime_role";
GRANT CONNECT ON DATABASE allied_autotech_staging TO :"runtime_role", :"migration_role";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM :"runtime_role";
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT USAGE, CREATE ON SCHEMA public TO :"migration_role";
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"runtime_role";
-- On an empty database this table does not exist yet. Re-run after the first
-- PRE_DEPLOY migration, before opening business ingress, to remove this grant.
SELECT format('REVOKE ALL ON TABLE public._prisma_migrations FROM %I', :'runtime_role')
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
\gexec
COMMIT;
