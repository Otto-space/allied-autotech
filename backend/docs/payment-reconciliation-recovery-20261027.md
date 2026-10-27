# Payment reconciliation recovery checkpoint — 27 October 2026

## Problem and resulting behavior

The general worker previously scheduled only the hour before its next in-memory tick. A restart or long outage omitted older payment attempts. It advanced that tick even when reconciliation failed. The unique provider/period index then prevented a failed run from being retried without removing its observations. Provider verification failures were recorded as `MISSING_IN_PROVIDER`, conflating an unavailable service with evidence of a missing receipt.

The candidate now locates the oldest online attempt due for observation for each enabled provider. It processes one closed, bounded window per provider on each minute-level scan, including after restart. Empty historical windows are skipped because there is no local attempt to verify. A matched pending attempt and any discrepancy are rechecked after the configured interval; a terminal matched attempt is not polled indefinitely. The due scan uses the latest completed item, so a failed partial run cannot falsely count as coverage. A failed period is retried with a new numbered run; earlier rows and items remain intact. A late-created attempt inside a completed period gets a new snapshot of that same period. Completed snapshots are not additive financial ledger entries and must not be summed across run attempts.

Provider verification is read-only. An unavailable provider fails the run with a generic failure message and is retried later; it is not called missing and no payment/refund is submitted. A ten-minute renewable lease protects each running attempt. After an expired lease, the next worker marks only that run failed and creates a new attempt. The displaced worker checks ownership again before persisting an item or summary. An existing pre-migration `RUNNING` row without a lease is deliberately not reclaimed automatically; it requires operational inspection before a retry. The worker still runs only when `PAYMENT_RECONCILIATION_ENABLED` is configured.

The first forward migration adds attempt/lease columns, a positive-attempt and lease-pair constraint, a unique provider/period/attempt index, a partial unique index for a running period, and a due-attempt index. A second additive migration indexes the latest item lookup. Neither removes or rewrites payment, refund, ledger, reconciliation-run or item rows. The pre-existing provider/period uniqueness index is replaced to allow separate immutable snapshots. Both names sort after production migration `20261026180000_workforce_template_versions` and before the separate unreleased Allie migration `20261027003000_assistant_transient_state`; merge/replay both histories before any combined release.

## Verification and limits

- Fresh isolated PostgreSQL `_ci` replay of all 74 migrations and Prisma schema comparison passed after the recurring-observation change. The separate synthetic container was stopped and removed.
- The reconciliation and Monnify integration suites passed **24/24** cases, including failed-run retry, backlog after restart, late attempt, expired lease, displaced-worker isolation, pending-to-discrepancy rechecks and terminal-match stopping. TypeScript, scoped lint and formatting passed. Final runtime `7033ce68d169af2cf0f36dd22bd4e73608bc7fcd` passed GitHub backend database-safety run `40431495357` and repository secret-guard run `40431495423`. Production rollout remains open.
- No production database write, provider request, payment movement, refund, customer message or enabled payment mode occurred in this implementation checkpoint. The disposable test container was stopped and removed.

Remaining P0 work includes explicit anomaly/hold resolution, provider sandbox verification, legacy `RUNNING` inspection, production-scale query measurement, and final source/release validation. Do not use this checkpoint as proof of a live reconciliation or a completed payment launch.

Read-only production checks after CI still found backend deployment `50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3` ACTIVE with no deployment in progress. API readiness/liveness returned 200 and anonymous customer-payment access returned 401. Its general-worker spec has `PAYMENT_RECONCILIATION_ENABLED=false`, `PAYSTACK_MODE=disabled` and `MONNIFY_MODE=disabled`. The managed cluster listed eight backups, newest 26 October 2026 05:22:11 UTC. These checks do not prove a current populated restore or production migration; no rollout was attempted.

Before a shared release: reconcile current deployed source and the separate Allie migration branch; review active reconciliation rows and provider mode read-only; verify managed encrypted off-device backups/retention/PITR and a separate populated restore rehearsal; run the guarded forward migration and `db:check`; deploy API/general worker in the required order; verify exact image/source identity, worker heartbeat and read-only reconciliation status. Keep payment mode disabled without configured keys and policy approval.

## Populated restore and migration rehearsal — 27 October

A retained 26 October 19:57 UTC production backup receipt matched its archive SHA-256 and exact production target; PostgreSQL 18.6 could list the archive. The archive was restored into a fresh, loopback-only PostgreSQL 18 `_ci` database in a task-owned temporary container. The restored database had 90 public base tables and nonempty user, customer, branch, product, service and notification tables. Its payment, payment-attempt, refund, ledger, order and inventory-reservation tables were empty, so this rehearsal does not test existing financial rows.

The standard `npm run db:migrate` runner inspected the restored history, created and verified a fresh exact-target backup in a separate private directory, and applied the three pending additive migrations: workforce template versions, reconciliation run attempts and reconciliation observation scan. Its final `db:check` and Prisma schema comparison passed. The sampled payment/attempt/refund/ledger/order/reservation counts remained zero; user, branch, product, service, customer-profile, staff-profile and notification counts were unchanged. All 90 public base tables remained. The task-created database container was stopped and removed. The new rehearsal backup and receipt were retained under `.codex/backups/allied-reconciliation-rehearsal-20261027`; that directory and its two files were restricted to the owner, Administrators and SYSTEM after inherited group read access was discovered.

Two preliminary disposable attempts stopped before migration: one row-count probe lost SQL identifier quoting through the Windows command line, and another restore encountered a transient closed local connection after container readiness. The final run waited for a successful direct host connection and piped the read-only SQL probe through standard input. No production database connection, write, provider call or payment action occurred.

Read-only production state remained backend deployment `50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3` ACTIVE, with eight managed backups through 26 October 05:22 UTC and app-only database firewall rules. The current app spec uses separate runtime and migrator users, but the migrator password is a provider-encrypted secret in the app spec; the local operator connection is blocked by the app-only firewall. No firewall change, credential rotation, production backup/migration, image build or deployment was attempted. A fresh production backup through the protected migrator path, production migration/`db:check`, image/source verification and rollout checks remain required. The previous statement that a populated restore rehearsal was missing is now superseded for this local candidate, subject to rechecking against the exact final release source.

## Due-scan scale probe - 27 October

A fresh, loopback-only PostgreSQL 18 `_ci` target replayed all 74 migrations and
passed the Prisma schema comparison. It held 50,000 synthetic Paystack attempts,
one completed matching reconciliation run and 50,000 matching items. The due-scan
SQL from `PaymentReconciliationWorker.runNextDueForProvider` was measured with
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` after table analysis:

| Case                                            | Execution time | Shared-buffer hits | Result          |
| ----------------------------------------------- | -------------: | -----------------: | --------------- |
| All 50,000 terminal attempts matched, first run |         672 ms |            201,523 | No due attempt  |
| Same fully cached case, second run              |         330 ms |            201,523 | No due attempt  |
| One pending attempt at the midpoint             |         159 ms |            100,763 | One due attempt |

The probe used synthetic attempt rows without payment parents solely to measure
the due-query tables; FK checks were bypassed only during synthetic insertion and
the one state adjustment inside this disposable `_ci` database. The production
code, constraints and indexes were not altered. The task-owned container and its
temporary storage were removed. These figures show linear work through already
matched rows and are a local cached-data baseline, not production latency or a
financial correctness test. Recheck with representative target statistics and a
larger population before enabling reconciliation at scale; do not trade away
missed-attempt coverage for a faster but incomplete scan.

After the restore checkpoint, production backend advanced to the separate
inventory replay hotfix deployment `71c5e9a7-bd3c-46c4-a503-cef24761837e`.
That deployment contains no reconciliation migrations or worker recovery code.
Reconcile this branch against its exact runtime before any release proposal.

## Provider-reference classification follow-up - 27 October

When verification returned a different reference from the attempt requested, the
worker labelled the observation `MISSING_IN_PROVIDER`. That response is evidence
of a mismatched reference, not proof that the requested receipt is absent. The
worker now records `STATUS_MISMATCH` with the existing explanatory note and
continues to exclude the unallocatable provider amount from NGN totals. A new
isolated case also confirms that already-verified local funds remain in internal
totals and are not relabelled as missing.

A fresh, loopback-only PostgreSQL 18 `_ci` target replayed all 74 candidate
migrations with no Prisma schema difference. The reconciliation integration file
passed 24/24 cases, including the new confirmed-local-funds mismatch case.
Backend TypeScript, scoped oxlint, Prettier and `git diff --check` passed. The
provider was a controlled test adapter; no provider request, payment movement,
application database or production deployment occurred. The separate linear
due-scan scale finding, provider sandbox, operational hold resolution, legacy
`RUNNING` inspection, compatible merge and guarded rollout remain open.

Exact runtime `9f4c963820ca7bdd1079818a503f414549fb284b` was pushed. Its
[backend database-safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40452332576)
and [redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40452332536)
both completed successfully. Neither check establishes provider or production
acceptance.

## Observation lease/write atomicity - 27 October

The worker previously renewed a run lease and inserted its next observation in
separate database transactions. A replacement worker could claim the run after
the renewal committed but before the insert, leaving an item on the displaced
run. The worker now checks and extends its live lease in the same transaction
as the item insert. The run row remains locked until that observation commits;
if ownership has changed, the insert is rolled back and the existing failed-run
recovery path retains prior items without counting the displaced write.

A new PostgreSQL integration case holds the item table's insert lock, waits for
the worker's pending write, and verifies another connection cannot lock the run
row during that window. It then releases the lock and verifies completion. The
isolated 74-migration replay and schema comparison passed; the reconciliation
suite passed 25/25 and the adjacent Monnify flow passed 1/1. Backend TypeScript,
scoped oxlint, Prettier and diff checks passed. This used a fresh loopback-only
`_ci` database and a controlled provider adapter; no real provider or payment
action occurred. The due-scan scale issue and the other release gates above
remain open.

Exact runtime `13fa09d8730d964a4745988f3a15900782bbb09e` passed
[backend database-safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40453684995)
and the [redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40453684938).
The source remains unreleased and provider-disabled.

## Indexed due-state projection - 27 October

The 50,000-row scan above showed that the lateral latest-observation query read
through terminal matched attempts even when nothing was due. The new additive
`20261027010000_reconciliation_due_projection` migration creates one derived row
per payment attempt and indexes its next due time. It backfills that row from the
same latest **completed** observation ordering as the previous query. Failed
partial runs do not count as coverage. New attempts and actual status changes
re-enter the queue through a database trigger. A completed run and the due-state
update commit together; the worker locks affected attempts in a stable order and
only a newer observation may replace a newer projection. Immutable runs/items
and financial balances remain the source of truth. A terminal match is excluded
only after its current state has been observed; a later status change schedules
another observation instead of silently retaining an old match.

Fresh loopback-only PostgreSQL 18 `_ci` targets replayed all 75 candidate
migrations with no Prisma schema difference. The final reconciliation suite
passed 27/27, including a transaction-local migration backfill against seeded
pre-existing completed, failed, pending and terminal observations; the adjacent
Monnify flow passed 1/1. Backend typecheck and scoped oxlint passed. An earlier
new test incorrectly assumed the global oldest due attempt belonged to its own
fixture; its assertion was corrected to inspect the owned projection and direct
same-period re-observation. The full 27-case run passed afterward.

An isolated query-plan probe seeded 50,000 synthetic terminal projection rows.
`EXPLAIN (ANALYZE, BUFFERS)` used the new index and returned no due row in
0.044 ms with six shared-buffer hits; after making one midpoint row due, it
returned that row in 0.066 ms with four hits. This measures the indexed lookup
against projection-only synthetic data; it is not a production latency promise
or a substitute for populated financial migration/role/provider acceptance.
Two preliminary scale fixtures were rejected by existing attempt constraints,
then discarded with their task-owned containers. The final probe bypassed its
parent FK only in the disposable `_ci` target to populate projection-only rows;
the SQL migration and application constraints were not weakened. All task-owned
containers and temporary database storage were removed.

Before a shared rollout, inspect production migration history and legacy
`RUNNING` rows; rehearse the exact 75-migration candidate against a current
populated restore and verify projection counts/representative statuses; verify
runtime DML grants and off-device recovery; then use the guarded migrator and
deploy a source-compatible API/general worker. Provider sandbox, hold resolution,
real-role acceptance and enabled-payment cutover remain separate. The current
production backend still has no reconciliation recovery migrations, and payment
providers remain disabled.

Exact runtime `1cb7b0b74dcd98a1aa73d623af4d9fd4db5674a7` passed
[backend database-safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40457237952)
and the [redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40457237957).
The local backend build, scoped lint/format, 75-migration replay, 27 focused
reconciliation cases, adjacent Monnify case and synthetic 50,000-row plan
probe all used this runtime source. This does not certify the unreleased worker
against live payment data or an actual provider.
