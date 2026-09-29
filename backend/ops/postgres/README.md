# Staging database roles

Use an existing **Managed PostgreSQL** cluster and the dedicated database
`allied_autotech_staging`. Do not use an App Platform development database.
Create two ordinary login users through the DigitalOcean control panel: one
runtime identity and one migration identity. Use separate generated passwords;
neither is `doadmin`. Store credentials privately. The release helper requires
actual host, port and CA values; it does not provision or guess them.

Connect with `psql` using `sslmode=verify-full`, `sslrootcert` pointing to the
downloaded CA, the actual hostname, and `-W` for an interactive password prompt.
Do not put passwords in command arguments or a connection URL in shell history.
DigitalOcean's privileged operator must be allowed to administer the schema and
the migration role's default privileges. This permission is not granted to the
runtime identity. See [DigitalOcean role guidance](https://docs.digitalocean.com/products/databases/postgresql/how-to/modify-user-privileges/).

From this backend directory, with the selected database connection already set:

```powershell
psql -W -v runtime_role=ACTUAL_RUNTIME_ROLE -v migration_role=ACTUAL_MIGRATION_ROLE -f ops/postgres/staging-privileges.sql
```

The script refuses other database names, administrator identities, role
memberships and runtime ownership. It removes public schema creation and public
database access; use it only on this dedicated staging database. It grants DML
and sequence usage to runtime, schema creation to migration, and default grants
for objects created **by the migration role**. Review existing object ownership
before using a populated database; do not transfer ownership indiscriminately.
Prisma migrations must always run as the migration role. Existing objects owned
by another role need a separately reviewed ownership correction.

Run the script before the initial PRE_DEPLOY job and again after it, before
opening business ingress. The second run removes runtime access to Prisma's
newly created migration ledger. Future migrations retain the application DML
defaults. Keep PUBLIC privileges and any unexpected inherited memberships under
review. [PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)
apply to the role that creates each object, not every member of its group.

Verify as the actual runtime user after migration:

```sql
SELECT current_user, current_database();
SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = current_user; -- all false
SELECT has_database_privilege(current_user, current_database(), 'CREATE'); -- false
SELECT has_schema_privilege(current_user, 'public', 'CREATE'); -- false
SELECT has_table_privilege(current_user, 'public._prisma_migrations', 'UPDATE'); -- false
BEGIN;
CREATE TABLE public.aat_runtime_ddl_probe (id integer); -- must fail
ROLLBACK;
```

Verify ordinary reads/writes through a disposable application fixture, migration
success through PRE_DEPLOY, and failed migrations blocking release. A successful
local SQL test is not proof of Managed PostgreSQL permissions or connectivity.

Use Trusted Sources restricted to the App Platform application and narrowly
scoped operator access. Never allow `0.0.0.0/0` or `::/0`. The App Spec attaches
the existing managed cluster; verify its resulting firewall explicitly. Prefer
private networking when the selected region/account supports the app-to-database
path; keep hostname validation and use the real private hostname if enabled.

The pools are API 10 + identity 3 + general 5 = 18 steady connections and up to
36 during overlapping deployments. Add measured Prisma migration connections
and operator headroom. `DB_POOL_MAX=2` in the migrator does **not** configure the
Prisma CLI's connection pool. Inspect `SHOW max_connections` and provider/user
limits before selecting capacity; do not assume a small managed plan fits.
Enable provider backups and verify restoration into a separate disposable DB.
