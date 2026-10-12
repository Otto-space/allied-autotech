# Refund dispatch authorization and late receipts

Updated 12 October 2026. SEC-029 repairs the initial provider submission path.

## Behavior

Batch discovery no longer marks every refund as submitted. Each item is rechecked and claimed immediately before its own provider call. Remaining items stay approved with no submission marker while an earlier provider request is in flight. A new dispute or review hold encountered at that later claim prevents submission.

Claiming and Paystack dispute observation share a transaction advisory lock for the payment attempt. If the dispute transaction wins the lock, dispatch waits for it to commit and then checks the dispute again. The dispatch authorization is the committed claim; the provider request runs outside the database transaction. A dispute observed after that authorization cannot retract an already authorized external request and requires the existing dispute review process. Database and provider operations are not a distributed atomic transaction.

The durable `submissionStartedAt` marker is never reset by recovery. Overlapping workers cannot claim the same refund twice, and unknown provider outcomes are not automatically resubmitted. A process resuming after the ten-minute dispatch window holds the refund for review without sending it. Worker results count actual provider submission calls rather than the size of a discovered batch. An already won dispute retains the existing permission to submit.

A provider response arriving after recovery placed the refund under review is retained: the provider refund identity is attached to the original record and an anomaly is recorded, while its status, review reason and lack of automatic polling are preserved. A returned identity already bound to another refund cannot be rebound; the original binding is preserved, the new refund requires review and the observed identity is retained in an anomaly. Receipt handling locks the refund and serializes identity assignment. Database retries run only the recording transaction, never the external submission.

No success ledger entry is created merely because the provider accepted a submission. Existing verified reconciliation/callback completion, approval authority, branch isolation, MFA, CSRF, provider gates and immutable financial history remain authoritative. No new endpoint or public response field is added.

## Verification

All four initial regression cases failed against the old worker: a new dispute was ignored for a later batch item, a new review hold was ignored, queued items were prematurely marked submitted, and a late provider receipt was discarded after recovery. The baseline report is `%TEMP%/allied-refund-dispatch-baseline.json`.

The first repaired run passed 28 cases across the four new scenarios, owner financial controls and poll ownership. The expanded gate includes expired dispatch windows, an uncommitted dispute transaction, a won dispute, delayed failures, conflicting provider identities and a forced database rollback after the provider call. All use injected providers and isolated PostgreSQL databases; no external payment or message is sent.

The expanded regression passed **82 tests across ten files**, with no failures or skips (`%TEMP%/allied-refund-dispatch-regression.json`). It covers dispatch, poll ownership, owner controls, refund observations, both webhook ownership boundaries, provider payment/refund lifecycle, manual refunds and disputes. The later forced-rollback case and all nine dispatch cases passed together in a separate **10-test final run** (`%TEMP%/allied-refund-dispatch-final.json`). These are 83 unique tests across the two runs; the overlapping dispatch cases are not counted twice.

The regression used `allied_refund_poll_replay_20261012_test`, and the final dispatch run used `allied_vehicle_terms_20261012_test`, both with all 53 migrations already applied. Backend typecheck, lint, build, affected-file formatting, secret scanning, OpenAPI validation (266 paths), route coverage (315 API operations plus four infrastructure routes) and diff checks passed. No public schema or rendered UI changed, so browser tests and frontend generation were not repeated for this repair.

## Rollout

Drain old API and general worker processes, then deploy the matching API and worker code together so both honor the shared dispute/dispatch lock. This repair adds no migration beyond the existing SEC-028 migration; the release still needs all 53 migrations and the matching generated Prisma client. Existing ambiguous submissions remain held for evidence-based review. Do not reset their submission markers or issue replacement refunds based only on a timeout.

The application database and deployed processes were not changed. Live provider acceptance, historical reconciliation and the broader backend audit remain open.
