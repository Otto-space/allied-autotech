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

Seventeen cases require separate account or operational states and are deliberately gated out of the shared command:

- Run `tests/integration/owner-provisioning.test.ts` with `RUN_OWNER_PROVISIONING_TESTS=true` on its own newly created and migrated database. This tests initial singleton-owner provisioning and concurrency.
- Run `tests/integration/workshop-owner-access.test.ts` with `RUN_DATABASE_TESTS=true` and `RUN_WORKSHOP_ACCESS_TESTS=true` on a different newly created and migrated database, with `--testTimeout=30000`. Its owner must have no staff profile.

- Run `tests/integration/operational-jobs-pagination.test.ts` with `RUN_DATABASE_TESTS=true`, `RUN_OPERATIONS_PAGING_TESTS=true` and `TEST_DB_NAME` pointing to a different newly created and migrated database. Its seven cases require globally empty job queues, worker heartbeats and unresolved alerts so exact traversal, empty-final-page and oldest-100 assertions remain meaningful. Do not delete other suites' protected evidence to satisfy them.

- Run `tests/integration/operational-scan.test.ts` with `RUN_DATABASE_TESTS=true`, `RUN_OPERATIONAL_SCAN_TESTS=true` and `TEST_DB_NAME` pointing to its own newly migrated database. Its six cases verify exact 100-row pages across four queues, restart/rescan behavior, failed writes, stale checkpoints and SQL constraints. Financial and policy fixtures roll back; no protected evidence is deleted. Run this separately from the shared suite so unrelated eligible records cannot change the expected page sizes.

Keep the special flags unset for the shared suite. Report these separate results alongside the full run rather than describing intentional skips as executed cases. Local database/provider fixtures do not certify deployed storage, ingress, email delivery or provider settlement.

## Provisioned workspace acceptance harnesses

Historical workspace acceptance suites inspect explicitly provisioned fixture
manifests, least-privilege roles and fixed local target identities. They now also
require `RUN_PROVISIONED_WORKSPACE_TESTS=true`; they are not generic fresh-database
integration tests. Without that opt-in they are reported as skipped, not passed.
Their existing target, privilege, snapshot and authorization assertions remain.
Several of these suites require WORK_* or WORKFORCE_* fixture/prior-evidence files.
An absent manifest must not trigger use of application records or another target.

To execute those checks, first provision a NEW isolated local test database and
matching synthetic fixtures/runtime credentials, review the suite's exact target
preconditions, and supply all required local manifest paths. Do not run them against
an old populated target merely to match a historical name. Review/update target
constants for the newly provisioned instance before opting in. The resume-only
staff-account harness specifically requires its prior synthetic acceptance state.
No results for those harnesses are implied by the shared suite's success.

The self-contained discovery/fitment, saved garage, notification context, collection
and permission tests do not require this flag. They create their own synthetic
fixtures on the verified isolated target. The backend's 30-second test and 60-second
setup limits accommodate complete PostgreSQL/cryptographic flows; their data and
permission assertions are unchanged. The 1,000-attempt reconciliation scenario has
its own 60-second limit.
