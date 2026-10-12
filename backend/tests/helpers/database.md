# Isolated backend database verification

Run from `backend` with the normal local PostgreSQL connection settings supplied through the environment. Do not print credentials. Use a new database name ending in `_test` or `_ci`; never reset or substitute the application database.

```powershell
$env:NODE_ENV='test'
$env:DB_NAME='allied_release_unique_test'
npm run test:db:create
if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
$env:CONFIRM_EMPTY_MIGRATION_DATABASE='true'
npm run test:migrations
if ($LASTEXITCODE -ne 0) { throw 'Migration verification failed' }
$env:TEST_DB_NAME=$env:DB_NAME
$env:RUN_DATABASE_TESTS='true'
npx vitest run --maxWorkers=1
```

`test:migrations` refuses a nonempty database, replays the committed migration history and then runs a read-only comparison against `schema.prisma`. A schema mismatch fails the command. The comparison covers objects Prisma can represent; SQL-only triggers, check constraints and expression indexes retain their separate migration/integration assertions. Do not apply a diff that proposes removing such protections.

The migration tools use `DB_NAME`; Vitest uses `TEST_DB_NAME`, validates its suffix and supplies `DB_NAME` from it. Set both as shown. The test setup disables external payment and messaging providers. Storage/provider scenarios inject controlled adapters or use local test servers.

The shared suite uses synthetic records and serial file execution. Some tests retain approved policies, audit history and financial fixtures, so a populated database is not equivalent to a clean release baseline. Do not delete those records to make assertions pass. Transaction-local rollback is appropriate for temporary policy states; shared policy assertions must account for legitimate earlier approvals.

Four cases require separate account states and are deliberately gated out of the shared command:

- Run `tests/integration/owner-provisioning.test.ts` with `RUN_OWNER_PROVISIONING_TESTS=true` on its own newly created and migrated database. This tests initial singleton-owner provisioning and concurrency.
- Run `tests/integration/workshop-owner-access.test.ts` with `RUN_DATABASE_TESTS=true` and `RUN_WORKSHOP_ACCESS_TESTS=true` on a different newly created and migrated database, with `--testTimeout=30000`. Its owner must have no staff profile.

Keep the special flags unset for the shared suite. Report these separate results alongside the full run rather than describing intentional skips as executed cases. Local database/provider fixtures do not certify deployed storage, ingress, email delivery or provider settlement.
