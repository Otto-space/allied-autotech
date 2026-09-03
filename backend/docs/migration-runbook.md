# Migration runbook

Production migrations are forward-only. Never edit a migration that has been applied, never use
`migrate reset` against a shared database, and separate PostgreSQL enum additions from migrations
that consume the new values.

For a clean replay, provision a newly created empty database whose name ends in `_test` or `_ci`.
Set `NODE_ENV=test`, `DB_NAME`, and `CONFIRM_EMPTY_MIGRATION_DATABASE=true`, then run
`npm run test:migrations`. The verifier inspects `public` first and refuses to run if any base table
already exists; it then uses `prisma migrate deploy`, so it never destroys an existing database.

Before release, run `prisma validate`, `prisma migrate status`, the empty-database replay, integration
tests, and a backup restore rehearsal. If a production migration fails, stop application rollout,
preserve the error and database state, correct it with a reviewed forward migration, and use Prisma's
resolve workflow only after reconciling the actual database state.

Phase 3 follows the enum rule with `20260903210000_phase_3_enum_extensions` followed by
`20260903210100_phase_3_organization_security`. The latter creates hash-only privileged invitations,
an active-email partial unique index, role/branch and terminal-state constraints, expiry validation,
and restrictive foreign keys.
