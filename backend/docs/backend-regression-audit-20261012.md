# Integrated backend regression audit - 12 October 2026

This checkpoint refreshes the earlier 857-case baseline after profile revisions, review/support/aftercare recovery, operational pagination and audit-contract changes. It records local verification of the current test definitions, not deployed acceptance or completion of the entire backend goal.

## Result and evidence boundaries

**All 1,046 current cases across all 138 discovered test files passed across the shared run and final per-file reruns.** The groups contain 84 API cases, 13 migration cases, 693 integration cases and 256 unit cases. The current `tests/**/*.test.ts` inventory was compared with the combined reports; no file was uncovered.

This was not one clean full-suite invocation. The initial shared run discovered 989 cases: 976 passed, nine failed and four were deliberately gated. The failures were retained and investigated. Two test files were then corrected and rerun; the owner/workshop gated suites ran separately. The enum checks were split into individual cases, increasing the count by 57 without claiming additional feature coverage. Combining the latest complete result for each file yields the 1,046 passing current cases above.

The production source, migrations and package files covered by the source-hash manifest remained unchanged during verification. Only the two corrected test files and database-verification instructions changed in that manifest. This checkpoint made no production behavior, authorization or timeout change.

## Initial failures and corrections

### Audit enum verification

The grouped action test exceeded its 30-second budget. The following entity read returned HTTP 500, and the paging query reported a PostgreSQL pool connection timeout. Requests from the timed-out grouped test continued and changed the later successful-read count. The cause of the original connection interruption remains unconfirmed.

Each action/entity now has an individual test case. Requests have explicit 10-second response and 15-second total deadlines so a single stalled request fails before the 30-second case timeout. All 62 revised audit cases passed on the same populated shared database. Production database limits were not relaxed.

### Exact operational queue verification

Five pagination/status cases assumed globally empty job queues, heartbeat records and unresolved alerts. The shared run retained legitimate earlier fixtures, so the API correctly returned extra jobs/cursors and older alerts. Deleting those earlier fixtures would undermine protected evidence and would not represent valid cleanup.

The seven-case suite now follows the existing owner/workshop isolation pattern: it requires `RUN_OPERATIONS_PAGING_TESTS=true` and a separately migrated empty test database. All seven cases passed there with their exact traversal, empty-page, missing-worker and oldest-100 assertions intact. A separate check confirmed all seven are deliberately skipped when the flag is absent. They must always be run alongside the shared suite for complete coverage.

## Commands and databases

All databases use loopback PostgreSQL, synthetic data, disabled external providers and explicit `_test` names. No application database was reset, migrated or used for these cases. All 57 committed migrations and the schema comparison passed on each fresh database.

| Run                                                            | Database                                      | Result                                                         |
| -------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Initial shared `vitest run --maxWorkers=1 --testTimeout=30000` | `allied_backend_audit_20261012_test`          | 976 passed, nine failed, four gated; initial failures retained |
| Revised `audit-enum-coverage.test.ts`                          | Same populated shared database                | 62 passed                                                      |
| `operational-jobs-pagination.test.ts` with dedicated flag      | `allied_backend_paging_audit_20261012_test`   | Seven passed                                                   |
| `owner-provisioning.test.ts` with dedicated flag               | `allied_backend_owner_audit_20261012_test`    | Three passed                                                   |
| `workshop-owner-access.test.ts` with dedicated flag            | `allied_backend_workshop_audit_20261012_test` | One passed                                                     |

The shared run now deliberately gates eleven cases: seven pagination, three initial-owner and one owner-without-staff-profile case. See [isolated database instructions](../tests/helpers/database.md) and the [backend README](../README.md) for flags and reproduction. Never provide these test flags to deployed processes.

Additional checks passed: Prisma schema validation and migration status; application, script and Prisma-config TypeScript; backend compilation into a temporary output directory; full backend lint and formatting; secret guard; OpenAPI validation for 267 paths; coverage of all 316 mounted/documented operations with four explicit infrastructure exclusions; and `npm audit --json` with zero reported advisories in the complete backend dependency tree. The dependency result is a registry checkpoint, not proof of complete application security. Node cryptography and PostgreSQL client deprecation warnings remain visible in the reports.

## Retained local artifacts

The OS temporary directory contains:

- `allied-backend-audit-full.json` and `.log`: original shared result, including failures.
- `allied-backend-audit-enums-recheck.json`: all 62 revised audit cases.
- `allied-backend-paging-audit.json`, `allied-backend-owner-audit.json` and `allied-backend-workshop-audit.json`: separate state-dependent suites.
- `allied-backend-paging-gate.json`: explicit skip behavior without the dedicated flag.
- `allied-backend-audit-combined-summary.json`: latest-per-file reconciliation and source changes.
- `allied-backend-audit-source-manifest.json`: hashes of 615 tracked source/test/schema/package files.
- `allied-backend-audit-migrations.log` plus the owner/workshop/paging migration logs.
- `allied-backend-audit-dependencies.json` and `allied-backend-audit-format.log`.

No raw credentials or real customer fixtures are included in the report. Append-only synthetic evidence is retained in the isolated databases.

## Remaining goal scope

Capability-specific browser acceptance remains in its existing reports; this checkpoint did not rerun the frontend. Coordinated release and target-environment verification remain pending. DigitalOcean Spaces configuration is deferred, reservation terms await approval, and marketing/privacy execution still requires approved policies. Deployed messaging, storage, cookies/MFA, workers, payment-provider behavior, TLS, ingress and backup/restore remain separate release gates. The active goal is not marked complete by this local regression checkpoint.
