-- Read-only metadata only. Run in the existing local development pgAdmin session.
-- Do not paste passwords, connection URLs or application records into the report.
BEGIN READ ONLY;
DO $$ BEGIN
  IF current_database() <> 'allied_autotech_dev'
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR inet_server_addr() IS NULL OR inet_server_port() <> 5432 THEN
    RAISE EXCEPTION 'Wrong local development target';
  END IF;
END $$;

SELECT current_database(), session_user, current_user,
       inet_server_addr(), inet_server_port(), current_setting('server_version');

SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls, rolinherit
FROM pg_roles WHERE rolname IN
  ('aat_dev_owner','aat_dev_migrator','aat_dev_app','aat_dev_backup');

SELECT granted.rolname AS granted_role, member.rolname AS member_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m
JOIN pg_roles granted ON granted.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member
WHERE member.rolname IN ('aat_dev_owner','aat_dev_migrator','aat_dev_app','aat_dev_backup')
   OR granted.rolname='aat_dev_owner';

SELECT d.datname, pg_get_userbyid(d.datdba) AS owner, d.datallowconn,
       has_database_privilege('aat_dev_owner',d.oid,'CONNECT') AS owner_connect,
       has_database_privilege('aat_dev_owner',d.oid,'CREATE') AS owner_create,
       has_database_privilege('aat_dev_migrator',d.oid,'CONNECT') AS migrator_connect,
       has_database_privilege('aat_dev_app',d.oid,'CONNECT') AS app_connect,
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aat_dev_backup')
         THEN has_database_privilege('aat_dev_backup',d.oid,'CONNECT') END AS backup_connect
FROM pg_database d ORDER BY d.datname;

SELECT nspname, pg_get_userbyid(nspowner) AS owner, nspacl
FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema';

SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname;

SELECT * FROM pg_policies WHERE schemaname='public';
SELECT p.oid::regprocedure AS routine, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.oid::regprocedure::text;

SELECT pg_get_userbyid(defaclrole) AS owner, defaclnamespace::regnamespace AS schema,
       defaclobjtype, defaclacl FROM pg_default_acl;

SELECT COALESCE(d.datname,'*') AS database, COALESCE(r.rolname,'*') AS role,
       ARRAY(SELECT setting FROM unnest(s.setconfig) AS setting
             WHERE setting LIKE 'role=%' OR setting LIKE 'search_path=%') AS identity_defaults
FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase
LEFT JOIN pg_roles r ON r.oid=s.setrole
WHERE r.rolname IN ('aat_dev_owner','aat_dev_migrator','aat_dev_app','aat_dev_backup')
   OR d.datname='allied_autotech_dev';

SELECT name, version, installed, superuser, trusted
FROM pg_available_extension_versions WHERE name IN ('citext','pg_trgm');
SELECT extname, extversion, pg_get_userbyid(extowner) AS owner FROM pg_extension;
SELECT count(*) AS large_object_count FROM pg_largeobject_metadata;
SELECT to_regclass('public._prisma_migrations') AS migration_ledger;
COMMIT;
