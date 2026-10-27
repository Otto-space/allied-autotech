# Payment reconciliation recovery checkpoint — 27 October 2026

## Problem and resulting behavior

The general worker previously scheduled only the hour before its next in-memory tick. A restart or long outage omitted older payment attempts. It advanced that tick even when reconciliation failed. The unique provider/period index then prevented a failed run from being retried without removing its observations. Provider verification failures were recorded as `MISSING_IN_PROVIDER`, conflating an unavailable service with evidence of a missing receipt.

The candidate now locates the oldest online attempt without a completed reconciliation observation for each enabled provider. It processes one closed, bounded window per provider on each minute-level scan, including after restart. Empty historical windows are skipped because there is no local attempt to verify. A failed period is retried with a new numbered run; earlier rows and items remain intact. A late-created attempt inside a completed period gets a new snapshot of that same period. Completed snapshots are not additive financial ledger entries and must not be summed across run attempts.

Provider verification is read-only. An unavailable provider fails the run with a generic failure message and is retried later; it is not called missing and no payment/refund is submitted. A ten-minute renewable lease protects each running attempt. After an expired lease, the next worker marks only that run failed and creates a new attempt. The displaced worker checks ownership again before persisting an item or summary. An existing pre-migration `RUNNING` row without a lease is deliberately not reclaimed automatically; it requires operational inspection before a retry. The worker still runs only when `PAYMENT_RECONCILIATION_ENABLED` is configured.

The forward migration adds attempt/lease columns, a positive-attempt and lease-pair constraint, a unique provider/period/attempt index, a partial unique index for a running period, and a due-attempt index. It does not remove or rewrite payment, refund, ledger, reconciliation-run or item rows. The pre-existing provider/period uniqueness index is replaced to allow separate immutable snapshots. Its name sorts after production migration `20261026180000_workforce_template_versions` and before the separate unreleased Allie migration `20261027003000_assistant_transient_state`; merge/replay both histories before any combined release.

## Verification and limits

- Fresh isolated PostgreSQL `_ci` replay of the final 73 migrations and Prisma schema comparison passed. The separate synthetic container was stopped and removed.
- The final-source reconciliation and Monnify integration suites passed **23/23** cases, including failed-run retry, backlog after restart, late attempt, expired lease, and displaced-worker isolation. TypeScript, scoped lint, formatting and diff whitespace checks passed. Runtime commit `c98342b35901b7d7ded9ef354917523d4ce74b19` passed GitHub backend database-safety run `40428951879` and repository secret-guard run `40428951880`. Production rollout remains open.
- No production database write, provider request, payment movement, refund, customer message or enabled payment mode occurred in this implementation checkpoint. The disposable test container was stopped and removed.

Remaining P0 work includes re-observation policy for pending/mismatched receipts, explicit anomaly/hold resolution, provider sandbox verification, legacy `RUNNING` inspection, production-scale query measurement, and final source/release validation. Do not use this checkpoint as proof of a live reconciliation or a completed payment launch.

Before a shared release: reconcile current deployed source and the separate Allie migration branch; review active reconciliation rows and provider mode read-only; verify managed encrypted off-device backups/retention/PITR and a separate populated restore rehearsal; run the guarded forward migration and `db:check`; deploy API/general worker in the required order; verify exact image/source identity, worker heartbeat and read-only reconciliation status. Keep payment mode disabled without configured keys and policy approval.
