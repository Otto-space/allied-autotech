# Backend completion audit

**Later checkpoint:** [Integrated regression audit, 12 October 2026](backend-regression-audit-20261012.md) reconciles all 1,046 current cases across the shared run and corrected isolated reruns. It preserves the initial nine failures and explains the test changes. The 857-case record below remains the earlier baseline.

This record covers the current local backend working tree and the complete Vitest regression command. It supplements the capability-specific acceptance reports; it does not replace deployed acceptance or approve business policies.

## Verification results

**857 distinct backend tests passed, with no failures.** The full command passed 853 cases on fresh `allied_backend_release_20261013_test`; its four deliberately gated cases passed separately on the fresh owner/workshop databases below. The full run took approximately 650 seconds and included every file matched by `vitest.config.ts`. It used `RUN_DATABASE_TESTS=true`, `TEST_DB_NAME=allied_backend_release_20261013_test`, `--maxWorkers=1` and the JSON reporter.

| Gate                                        | Result                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full backend Vitest run                     | 853 passed, 0 failed, 4 intentionally skipped; 128 discovered test files                                                                               |
| Sole-owner provisioning                     | 3 passed on `allied_backend_owner_release_20261013_test` with `RUN_OWNER_PROVISIONING_TESTS=true`                                                      |
| Workshop access without owner staff profile | 1 passed on `allied_backend_workshop_release_20261013_test` with `RUN_DATABASE_TESTS=true`, `RUN_WORKSHOP_ACCESS_TESTS=true` and `--testTimeout=30000` |
| Migration replay                            | All 55 migrations applied on each fresh database; updated replay-plus-schema comparison passed on `allied_backend_schema_release_20261013_test`        |
| Schema, generated client and compilation    | Prisma validation, client generation, application/script/config TypeScript and backend build passed                                                    |
| Static checks                               | Full backend lint and formatting passed; changed replay script passed its checks again; secret guard and whitespace checks passed                      |
| API contracts                               | OpenAPI validation passed for 266 paths; all 315 documented operations matched mounted routes, with four explicit infrastructure exclusions            |
| Backend dependency audit                    | `npm audit --json` reported zero advisories across the full backend dependency tree at this checkpoint                                                 |

The shared run comprises 84 API cases, 13 migration assertions, 502 integration cases and 254 unit cases. The four separate cases bring the integration total to 506. There were no failed assertions to suppress or tests to weaken during this run. Node emitted experimental cryptography and PostgreSQL client deprecation warnings; the processes still completed successfully. No application database migration/reset, external provider activation or deployment was performed.

Evidence is retained in the OS temporary directory as `allied-backend-release-20261013.json`, `allied-backend-owner-release-20261013.json`, `allied-backend-workshop-release-20261013.json`, `allied-backend-release-audit-20261013.json`, `allied-backend-schema-release-20261013.log` and `allied-backend-replay-refusal-20261013.log`. These are local verification artifacts, not deployed monitoring evidence. Deployment-specific Node/Docker scripts are outside the Vitest command and were not rerun by this audit.

## Schema reconciliation

The read-only comparison of the fully migrated database with `schema.prisma` proposed dropping four service-discovery indexes: `Service_name_search_idx`, `Service_shortDescription_search_idx`, `Service_description_search_idx` and `ServiceCategory_name_search_idx`. Migration `20261009140000_service_discovery` already creates them. Their missing Prisma declarations could cause a later generated migration to remove working search indexes.

The schema now declares the existing GIN indexes, their exact database names and the `gin_trgm_ops` operator class. Prisma supports this through its [custom operator-class syntax](https://docs.prisma.io/docs/orm/prisma-schema/data-model/indexes). The repaired comparison reports no difference. No new migration, index rebuild or application database write is required.

`npm run test:migrations` now compares the replayed database with the schema and fails on drift after successful replay. All 55 migrations and the comparison passed on fresh `allied_backend_schema_release_20261013_test`; a second invocation correctly refused that now-populated database before replay. The read-only comparison was also clean on `allied_backend_release_20261013_test`. Prisma does not model every SQL object; existing tests continue to check SQL-only constraints, triggers and other invariants.

## Requirement inventory

| Scope                           | Implemented behavior and verification sources                                                                                                                                                         | Remaining boundary                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| BG-01 customer directory        | Admin/Super Admin directory, bounded search and related collections; `customer-directory` integration, unit and index-plan suites                                                                     | Deployed role/identity acceptance                                                                                  |
| BG-02 through BG-06 media       | Owned profile/garage media, service/product binary uploads, stock image editing/removal, private/public visibility, confirmation and cleanup; media HTTP, integration, concurrency and storage suites | Real private Spaces credentials, CORS, byte transfer and cleanup verification remain deferred                      |
| BG-07 through BG-10             | Checkout availability, immutable invoice/receipt documents, current-care overview and quotation expiry; payment availability, financial document, overview and service-operation suites               | Approved live finance and deployed acceptance                                                                      |
| API-01 through API-05           | Saved-vehicle paging, vehicle/product/service discovery and vehicle creation replay; corresponding discovery, pagination and idempotency suites                                                       | Target-environment integration; existing capability reports retain browser evidence                                |
| BG-11 reservation agreement     | Versioned Super Admin publication and explicit customer acceptance; reservation terms suite                                                                                                           | Owner says the actual agreement is awaiting approval; no invented terms or activation                              |
| BG-12 disputes                  | Authenticated provider lookup, capture identity checks, conservative resolution and partial chargebacks; dispute contract/integrity and webhook suites                                                | Provider sandbox/live dashboard evidence and deployment                                                            |
| Identity and authorization      | Sessions, CSRF, MFA, owner provisioning, branch/capability/record checks and private projections; identity, boundary, policy and owner suites                                                         | Deployed cookies, recovery delivery, ingress and real staff assignments                                            |
| Financial integrity and workers | Payment/refund/dispute identity, ledger protection, claims, retries, UTC clocks, bounded provider/storage operations and safe logs; financial concurrency, worker, transport and emitted-log suites   | Release matching API/workers and migrations; historical recovery and provider settlement require separate evidence |

The original six-gap handoff, owner decision matrix and current gap register remain authoritative for their detailed acceptance criteria. Existing browser reports were inspected as historical evidence; this backend audit does not claim a new frontend/browser run.

## Remaining implementation work

The audit identified four further contract enhancements. [Atomic profile-text revisions](customer-profile-revisions.md) have since been implemented with separate migration, API, frontend and browser evidence. Authoritative [owner-scoped review-source discovery](review-source-discovery.md) and [durable review submission recovery](review-submission-replay.md) have also since been implemented. [Notification-preference revisions and recovery](notification-preference-recovery.md) now also have separate local verification. [Customer support creation recovery](support-creation-recovery.md) now also has separate local API/database and production-browser verification. [Customer support reply recovery](support-reply-recovery.md) now also has separate local API/database, notification-intent and production-browser verification. [Aftercare original-request recovery](aftercare-request-recovery.md) now also has separate local API/database and production-browser verification, including later rejection and recovery beyond the bounded history window. Coordinated deployment remains pending. This audit does not mark the overall backend goal complete. The 857-test baseline above predates the profile revision change.

Marketing execution and destructive privacy execution require approved policies. Existing preference/intake/review APIs must not be treated as permission to enable either. No booking deposit or Monnify activation is introduced. Delivery, vehicle money/hold, tax, refund-clock and retention policy gates retain the [owner matrix](owner-implementation-matrix.md).

REL-01 through REL-03 still require deployed storage, messaging, identity, workers, database TLS, ingress, backup/restore and payment-provider verification. Maps configuration is deferred. The development-tooling SEC-015 finding remains tracked separately; a clean backend dependency audit is not a claim about frontend tooling or all application security.

See [isolated database instructions](../tests/helpers/database.md) for safe repeatable verification and the separate owner/workshop gates.
