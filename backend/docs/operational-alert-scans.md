# Durable operational alert scans

Reviewed 12 October 2026. Implemented locally; deployment remains pending.

## Problem and behavior

The operational-alert worker selected the first 100 unresolved disputes, attention refunds, stuck payments and paid vehicle holds on every cycle. Creating an alert does not resolve the underlying record, so those first 100 rows could indefinitely prevent later rows from being checked.

Each of these four queues now has a durable `WorkerScanCheckpoint`. Queries return at most 100 eligible records ordered by creation time and UUID. A successful page advances the saved boundary; a short or empty page resets it for the next sweep. New eligibility or records inserted behind the boundary are picked up on the next sweep. A changing or removed boundary row cannot invalidate the cursor because the checkpoint stores its values, without a foreign key to that row.

Progress is saved only after every record in that page has been processed. An interrupted page is retried; existing alert upserts and daily reminder deduplication preserve their behavior. Version-checked checkpoint updates prevent a stale concurrent worker from rewinding a newer scan. This is retryable processing, not an exactly-once delivery guarantee. A failed page retains its position and surfaces through the existing worker failure heartbeat; operators still need to resolve persistent failures.

The general worker continues to run at the configured expiration interval. Each queue advances one bounded page per cycle, so large backlogs take multiple cycles. This does not guarantee a fixed alert latency under arbitrary load. Urgent complaints and cancelled-order refund processing retain their existing eligibility and draining behavior. No money is moved, allocation released, business policy approved or notification provider enabled by this change.

## Migration and release

Migration `20261013120000_operational_scan_checkpoints` adds only the checkpoint table, its primary key, a positive revision constraint and an all-or-none timestamp/UUID constraint. Existing records are not modified. Apply migration 58 and generate the matching Prisma client before releasing the general worker. No frontend contract or OpenAPI change is needed. Default runtime-role table privileges must cover the new table, as in the existing staging privilege procedure.

Rollback to an older worker does not require dropping the table; it does reintroduce the first-page limitation. Preserve checkpoint records during normal deployments. A deliberate checkpoint reset merely causes an earlier rescan and must not be used to claim that records were processed.

## Verification

- All 58 migrations replayed successfully on `allied_operational_scan_20261012_test`; Prisma's schema comparison reported no difference.
- Six new database cases passed, including 101 equal-timestamp records in each of four queues, new worker instances between pages, a boundary record becoming ineligible, wraparound, partial-write retry, stale checkpoint fencing and SQL constraints.
- A combined focused run passed 39 cases across the new scan suite, UTC database boundaries, aftercare/privacy/complaint controls, worker resilience and disabled worker behavior.
- Application and deployment-script type checking and lint passed. The new test also receives a separate strict TypeScript check because the normal application project excludes test files.
- The isolation guard was verified with the dedicated flag unset: six deliberately skipped, zero failures. A subsequent fresh replay on `allied_operational_scan_final_20261012_test` was interrupted by PostgreSQL closing the connection (`P1017`); a read-only health check then returned recovery-mode error `57P03`. That replay did not reach its test command and is not a passing run. Its migration log is retained as `allied-operational-scan-final-migrations.log`; recovery and the explicit-flag rerun remain pending.

Follow-up on 12 October: PostgreSQL recovered (`pg_is_in_recovery()` returned false). Read-only migration checks found 58 finished and no incomplete migrations in the original test database; the interrupted fresh database has two finished migrations and one incomplete migration. Preserve the interrupted replay as failed evidence. After host disk space became available, all 58 migrations applied to a new isolated database, `allied_operational_scan_recovered_20261012_test`, and Prisma reported no schema difference. The dedicated suite then passed all six cases with both `RUN_DATABASE_TESTS=true` and `RUN_OPERATIONAL_SCAN_TESTS=true`, with no skips or failures. Terminal exit codes were zero. Reports are `allied-operational-scan-recovered-migrations.log`, `allied-operational-scan-recovered.log` and `allied-operational-scan-recovered.json` in the OS temporary directory. This completes the previously pending local replay and explicit-flag verification.

Initial synthetic fixture runs were rejected by existing branch, refund authorization and vehicle agreement constraints. The fixtures were corrected to satisfy those constraints; no production validation was weakened. Bulk financial records and the synthetic agreement are enclosed in a rolled-back transaction. They do not publish reservation terms or alter application data.

The exact-size suite needs its own migrated test database and `RUN_OPERATIONAL_SCAN_TESTS=true`, alongside the usual `RUN_DATABASE_TESTS=true` and `TEST_DB_NAME`. See [database verification](../tests/helpers/database.md). Keep these flags out of hosted environments. Retained local reports are `allied-operational-scan-migrations.log`, `allied-operational-scan.json` and `allied-operational-scan-regression.json` in the OS temporary directory.

Deployed acceptance still needs to confirm migration availability, worker permissions, repeated progress through more than one page, restart recovery and the existing operational heartbeat. Provider delivery remains a separate verification gate.
