# Repository rules

Make every change professional, complete and reviewable.

## Database safety — mandatory

- Preserve existing application data. Never reset, drop, truncate, recreate, or restore
  over an application, shared, staging, or production database to fix errors or tests.
  Never use `prisma db push`, `prisma migrate reset`, `prisma migrate dev`, or an
  unreviewed `db execute` against these databases.
- Confirm the actual host, port, database and environment before any database write.
  Do not print passwords, connection strings, backup contents or customer records.
- Treat schema changes as incomplete until a forward migration is committed alongside
  the schema, the client is regenerated, an empty isolated migration replay passes,
  and the target passes `npm run db:check`. Never edit or delete applied migrations.
- Use `npm run db:migrate` to apply reviewed pending migrations. This command must
  verify migration history and create/verify a fresh backup before applying changes.
  Do not bypass its checks or turn startup into automatic migration/repair.
- Stop on drift, failed migrations, changed checksums, a wrong target, failed backup,
  or failed verification. Diagnose and use a reviewed forward fix. Do not mark a
  migration applied/rolled back merely to silence an error.
- Use expand-and-contract changes: add compatible fields first, preserve old data,
  migrate/backfill explicitly and verify it, then retire old fields only through a
  separately approved data-preservation plan. Destructive maintenance requires an
  explicit user instruction for the exact target and operation, a verified backup,
  a successful restore rehearsal and a reviewed recovery plan.
- Run database tests only on newly created, isolated `_test` or `_ci` databases.
  Never repoint tests to the application database or delete real data for assertions.
- Application/worker credentials must not own the database/tables or have schema
  modification, TRUNCATE, superuser or role-creation privileges. Keep migration and
  backup credentials separate. Do not change existing grants without reviewing impact.
- Before any shared/production rollout, verify automated encrypted off-device backups,
  retention, point-in-time recovery where supported, and a successful restore rehearsal
  into a separate database. A local dump or a readable archive index alone does not
  prove recoverability or constitute an off-device backup.
- Preserve these safeguards in Docker, release scripts and direct runtime entrypoints.
  Report exactly which safety checks and restore tests ran; never promise zero risk.

See `backend/docs/database-safety.md` for the supported workflow.
