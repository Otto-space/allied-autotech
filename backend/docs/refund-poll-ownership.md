# Refund reconciliation ownership

Updated 12 October 2026. SEC-028 addresses concurrent read-only refund polling.

## Behavior

Each provider poll claims one due refund immediately before the network call. The claim has a random UUID and a ten-minute UTC lease, separate from the next scheduled reconciliation. Claim acquisition rechecks the discovered schedule, current status, provider refund identity, failure budget and lease. A second worker skips a live claim or a row rescheduled after discovery. Batch discovery alone does not authorize a poll.

Successful responses and error handling lock the refund row and verify the claim before changing financial state, retry counts or scheduling. An expired claim can be replaced after a crash; its later response cannot release, complete or reschedule the replacement. The result counter reports polls actually claimed, excluding stale discoveries. Provider refund submission is not retried by reconciliation.

Matching pending responses reset consecutive failures and schedule the next poll in five minutes. Provider failures use the current locked count with exponential backoff capped at one hour; the eighth consecutive failure requires review. Existing exhausted pending records retain their count and move to review when no live claim remains. A live claim is not removed by that cleanup. Missing or unsupported provider reconciliation follows the same failure handling.

An applied Paystack callback revokes an older poll claim, including a pending callback. Monnify terminal or mismatched observations clear claims when they change the refund. Existing completed-refund and review-hold protections remain in place. Conflicting observations are still recorded as anomalies, including a late observation of a completed refund; retaining this evidence does not grant the stale poll authority to change the refund or its ledger.

Review outcomes have no next automatic poll. A verified pending or completed response clears an earlier transport failure message. Neither claim field appears in refund queue, decision, creation or replay responses. Existing roles, branch scope, MFA, CSRF, approval rules, provider activation gates and ledger constraints remain unchanged.

## Migration and rollout

`20261012180000_refund_poll_ownership` adds nullable `reconciliationToken` and `reconciliationLeaseUntil` columns, a paired-null constraint and a partial index for due online refunds. Existing rows are unclaimed. The migration does not update financial history or reset counters.

Drain old API and general worker processes, apply migrations, generate the Prisma client and release the API and workers together. Old workers do not honor claims and must not overlap the repaired version. Identity workers should receive the matching generated client as part of the backend release. The application database and deployed processes have not been changed by this local verification.

This repair does not automatically reconcile ambiguous refund submissions, resolve historical payment anomalies or authorize further money movement. [SEC-029](refund-dispatch-boundary.md) subsequently repairs delayed initial submission batches and late receipt retention. Live provider acceptance, operational review and historical stranded notification recovery remain open.

## Verification

Two initial regression cases failed against the old worker: overlapping calls polled the same refund, and a rescheduled discovery was still polled. The baseline report is `%TEMP%/allied-refund-poll-baseline.json` (one passed, two failed). The first repaired run passed 43 cases across poll ownership, refund observation integrity and owner controls. Additional exhaustion and callback cases are included in the final regression gate.

Migration replay passed all 53 migrations on the new empty `allied_refund_poll_replay_20261012_test` database. An additive upgrade of `allied_refund_observation_20261011_test` preserved all 111 existing synthetic refunds and the complete ledger, verified by comparing canonical row digests before and after migration. All historical claim fields remained null. The focused workflow tests use `allied_vehicle_terms_20261012_test`; no application database was used and no provider request was sent externally.

The final database regression passed **83 tests across ten files**, including 15 poll ownership cases, 22 observation-integrity cases and existing approval, manual refund, provider lifecycle, reconciliation, timing, dispute and webhook ownership checks. A separate security/financial-transaction follow-up passed **27 tests across six files**. Both runs had no failures or skips. Reports are `%TEMP%/allied-refund-poll-regression.json` and `%TEMP%/allied-refund-poll-security.json`. The added cases cover stale pending/failed/success/error responses, live replacement claims, crash recovery, exhausted budgets, pending callbacks, paired claim constraints, exact ledger completion and UTC leases under UTC, Lagos and New York database sessions.

Prisma validation/status, backend typecheck/build/lint, affected-file formatting, secret scanning and `git diff --check` passed. OpenAPI validation passed for 266 paths; route coverage matched 315 API operations and four infrastructure routes. No public schema or rendered frontend behavior changed, so frontend contract generation and browser acceptance were not repeated for this repair.
