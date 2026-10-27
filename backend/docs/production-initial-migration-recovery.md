# Production initial migration: approved recovery completed

Inspected 21 October 2026. Mike explicitly approved this exact recovery in the
conversation. The isolated failure/recovery/59-migration/actual-restore rehearsal
passed. Production recovery subsequently passed: the original failed attempt was
preserved as rolled back, all 59 migrations completed through `npm run db:migrate`,
`db:check` passed, runtime/backup privileges were verified and a fresh post-migration
backup was created and verified. The original firewall was restored. No staging
data was modified, reset, deleted or restored over.

## Exact target and observed failure

- Managed server: `allied-autotech-staging-db`;
  `allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com:25060`.
- Database/environment: `allied_autotech_production`, production.
- Failed migration: `20260831203155_init`.
- PostgreSQL denied the first statement, `CREATE EXTENSION IF NOT EXISTS "citext"`,
  because `allied_production_migrator` lacked database CREATE. The initial grant
  script granted schema CREATE only. The reviewed correction grants database
  CREATE exclusively to the migration role; runtime remains CONNECT-only.
- Read-only inspection found exactly one failed migration record, zero completed
  steps, zero business tables, zero public enums and no citext extension. The
  migration ledger exists. No staging data or grants were changed.
- The guarded runner created and verified a fresh exact-target backup before
  attempting migration. Operator firewall access was removed and the original
  app-only firewall was verified after both migration and inspection.

The database is now prepared for the reviewed production release. Staging's app
was archived under Mike's separate budget-reuse instruction, with its database
preserved. No production app, DNS cutover or live payment activation had occurred
at completion of recovery.

## Proposed narrowly scoped recovery

1. Preserve Mike's recorded explicit approval for this exact target and operation.
   The normal Prisma command guard continues to block all `migrate resolve` calls. Do not bypass it,
   change migration checksums, edit applied SQL, reset or replace the database.
2. The failure and recovery were reproduced on a newly created isolated `_ci`
   database. The reviewed `npm run db:recover:initial` entrypoint and dedicated
   `prisma.initial-recovery.config.ts` permit only
   this initial failed migration, with exact-target confirmation, verified fresh
   backup receipt, unchanged migration checksum and rechecked inspection evidence.
   All other migration-resolution/reset commands remain blocked. Normal
   migration checking recognises only this exact rolled-back, checksum-matched,
   zero-step, ledger-only initial attempt as an empty deployment; unresolved
   failures and populated schemas remain blocked.
3. Verify current managed backups and perform the separately approved managed
   restore rehearsal (up to USD1, remove only the temporary target afterward).
   Create/verify another fresh exact-production backup immediately before repair.
4. Recheck the live target: same single failed initial migration, zero completed
   steps, no business tables/enums/citext, no other migrations and no customer
   data. Stop if any observation differs. Apply the reviewed migration-role
   CREATE privilege correction; verify runtime has no CREATE or ownership.
5. Use the reviewed, explicitly approved recovery entrypoint to mark only
   `20260831203155_init` **rolled back**, preserving its failed attempt as history.
   This reflects a proven first-statement failure after fixing its cause; it is
   not permission to mark a migration applied or silence unknown drift.
6. Run `npm run db:migrate` normally with its fresh backup verification and exact
   target confirmation. Run `npm run db:check`, post-migration runtime/backup
   grants, and verify least privilege, migration checksums and runtime reads.
   Preserve all evidence. A new failure stops release again.

Approval of business policies, hosting costs or the separate temporary restore
resource does not authorize this migration-history recovery. Never update
`_prisma_migrations` manually. No existing database will be deleted, recreated,
truncated or restored over as part of this plan.
