# Database safety

The mandatory repository policy is in [AGENTS.md](../../AGENTS.md). These controls
reduce schema failures and accidental data loss; they cannot guarantee zero risk.

## Local workflow

Run from `backend`, with `.env` pointing at the intended development database:

```powershell
npm run db:check
# If there are pending migrations:
npm run db:migrate
npm run dev
```

`db:check` is read-only: it verifies applied migration checksums, unresolved failures,
pending migrations, Prisma validation and live schema drift. Development and worker
pre-hooks require it. Development startup and builds regenerate the client.

The API and both worker entrypoints verify every generated model's scalar columns
before accepting traffic or writing heartbeat/job state. Readiness repeats this
check every minute, deduplicates concurrent probes and caches only successful checks.
Prisma's `take: 0` skips database queries, so these probes use an empty `OR` filter
that emits `WHERE 1=0`: PostgreSQL validates actual mapped columns but returns no
business rows. This avoids inferring filter types from field references, which can
omit list metadata. Concurrency is bounded. Missing tables/columns block startup/readiness.
Additional columns remain compatible for rolling releases. This runtime probe does
not certify triggers, every enum value or migration history; `db:check`, isolated
migration replay and domain integration tests remain required.

## Backups and migrations

`db:migrate` refuses altered/unknown history and failed migrations. On existing
databases it also refuses potentially destructive pending SQL, including table/column
removal, truncate, deletes, top-level updates, type conversions and dynamic SQL.
This conservative gate does not replace human SQL review or sandbox arbitrary SQL.
It recognizes complete, argument-free statement-trigger declarations for TRUNCATE
as DDL that can protect a table. This does not permit executing TRUNCATE or
destructive SQL in the trigger function or adjacent statements.

Before pending migrations, it creates a custom-format PostgreSQL backup outside the
repository, checks the archive database name with `pg_restore --list`, records its
SHA-256 and exact target in a receipt, and verifies that receipt again before deploy.
Missing tools, failed backups, altered archives, wrong targets and receipts older
than one hour block deployment. Backups are never automatically overwritten or pruned.
After deploy, history/schema checks must pass. Startup never migrates or repairs data.

```powershell
npm run db:backup
```

Local backups default to `%USERPROFILE%\.codex\backups\allied-autotech`.
An absolute `DB_BACKUP_DIRECTORY` outside the repository selects another private
location. `PG_DUMP_PATH` and `PG_RESTORE_PATH` can specify absolute executables.
Use PostgreSQL clients compatible with the server. Credentials stay out of command
lines and logs, and the existing database TLS policy also applies to backup connections.

Remote/shared writes require `DB_MIGRATION_TARGET=host:port/database` to match the
actual target. Production additionally requires an explicit durable backup directory
or `DB_SAFE_MIGRATION_BACKUP` pointing to a fresh verified receipt and its archive.
Receipt/archive pairs use relative archive names and can be securely copied/mounted
on a migration runner. Protect them; never put them in git or image layers.

The project Prisma config blocks `migrate reset`, `migrate dev`, `migrate resolve`,
`db push` and `db execute`. Deployment must use the protected runner, which passes
its verified backup evidence to the Prisma child process; do not set its internal
handover flag manually to bypass review.
The sole replay exception is an explicitly confirmed `_test`/`_ci` database;
`test:migrations` proves it is empty first. Generate migration SQL using a separate
disposable development project/database, then review and add the forward migration.
Using a different Prisma config or administrator SQL can bypass local protections;
least-privilege credentials and the mandatory repository policy are still necessary.

The separately approved [initial production recovery](production-initial-migration-recovery.md)
uses `npm run db:recover:initial` and a dedicated config. It permits only recording
the first migration's proven citext first-statement failure as rolled back, after
the permission cause is fixed, an exact-target backup is verified, and a fresh
inspection proves zero business objects/steps and unchanged SQL. Production is
restricted to the approved hostname/database/migration identity; isolated
rehearsals require the dedicated loopback `initial_recovery_<hex>_ci` namespace.
The normal config still blocks all resolve calls. This is not a general recovery
or bypass facility. Never use it for another failure, populated schema or target.

## Release and recovery requirements

- Commit schema and new migration files together; never edit applied migrations.
  CI replays the complete history on empty PostgreSQL and rejects Prisma schema drift.
  Run custom constraint/trigger and business integration tests on isolated databases.
- Separate runtime, migration and backup credentials. Runtime roles must not have
  ownership, DDL, TRUNCATE or administrator privileges. Review the existing PostgreSQL
  provisioning procedure before changing grants. These changes do not alter credentials.
- Configure encrypted automatic off-device backups, retention and managed point-in-time
  recovery where supported. These scripts create local/on-runner dumps; they do not
  configure off-device scheduling, encryption or provider recovery services.
- Rehearse restoration into a separate database, verifying business/audit/financial
  data, schema, permissions and application behavior. Archive listing/hash checks alone
  do not prove restoration. Define acceptable recovery point/time before production.
- Migrate before promoting matching API/worker images. The Docker migration image's
  default command uses the guarded runner with externally supplied durable backup
  evidence. The App Platform template overrides that command with a read-only
  `db:check` gate: migration happens first on a trusted durable release runner,
  and pending migrations/drift block promotion. See [the hosting release sequence](hosting-approval-plan.md#database-releases-preserve-the-backup-safeguards).
  An ephemeral container directory must never hold the sole backup.
- On failure preserve backup, logs and partial migration state. Diagnose and fix forward.
  Restore-over-live and destructive maintenance require separate explicit authorization
  for the exact operation/target, verified backups and a tested recovery plan.

References: [Prisma migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy)
does not detect schema drift, so [migrate diff](https://www.prisma.io/docs/cli/v7/migrate/diff)
is a separate check. [PostgreSQL backup documentation](https://www.postgresql.org/docs/current/backup.html)
explains backup and recovery methods.
