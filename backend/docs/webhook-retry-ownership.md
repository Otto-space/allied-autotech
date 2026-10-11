# Payment-webhook retry ownership

Updated 11 October 2026.

## Corrected behavior

The retry worker renews each batch item's lease only while its ID, `PROCESSING` status and cumulative attempt still match. Superseded batch entries are skipped. A delayed exception cannot fail another worker's attempt. The final automatic attempt is protected while its ten-minute lease remains fresh; expired final leases become valid dead letters, including their required failure timestamp.

Payment-service completion and recoverable failure writes use the same event ownership predicate. Capture, settlement, refund, dispute, ledger and audit work remains inside its existing transaction. If the event has been taken over, the conditional completion fails and that transaction rolls back. The stale worker treats this as superseded work, leaving recovery to the current owner. Initial callback processing also carries the original `RECEIVED` generation, so it cannot overwrite a retry worker that claimed the persisted event while the callback was still processing.

Provider duplicates are acknowledged without immediately reprocessing the stored event. This preserves backoff, active leases and dead-letter decisions. Paystack duplicate detection recognizes the existing provider event ID even when the signed body digest differs; the original verified event remains authoritative. Callback acknowledgement means accepted, not necessarily settled. Existing signature/provider verification, receipt identity, immutable capture accounting and financial authorization are retained.

Monnify verification mismatches now create the processed receipt and review hold in one transaction. No intermediate retryable receipt is exposed to a worker, and a failed transaction leaves neither a processed receipt nor partial hold changes. Monnify remains disabled by configuration; tests use injected providers.

Successful retry completion does not increment the attempt a second time. Automatic failures remain limited to eight cumulative attempts. The existing Admin/Super Admin retry operation sets `RECEIVED`, which now permits one further attempt even after the automatic budget is exhausted. It preserves cumulative history and requires the same MFA, CSRF, expected-attempt and audit checks. A failure beyond that budget returns to `DEAD_LETTER`; another attempt requires another reviewed operator request. This does not reset counters or automatically resend every dead letter.

## Evidence

All 51 migrations replayed into the new isolated `allied_webhook_claim_20261011_test` database. No migration was added for this repair and the application database was not changed.

Six initial tests failed against the previous implementation, recorded in `%TEMP%/allied-webhook-before.json`. They reproduced stale service completion, stale failure, superseded batch dispatch, premature final-attempt termination, missing dead-letter timestamps, and an audited retry being immediately rejected by the old budget check.

The final new suites contain **21 passing PostgreSQL cases**:

- `webhook-claim-ownership.test.ts`: 14 cases covering both providers' duplicate handling, stale service success/failure, batch takeover, fresh/expired final leases and an actual audited manual retry.
- `webhook-financial-ownership.test.ts`: 7 cases covering rollback and successful recovery for Paystack/Monnify captures and refunds, Paystack disputes, initial-ingress takeover, and atomic Monnify mismatch holds including injected transaction rollback.

The tests coordinate real transactions and claim changes through separate database operations. The financial cases let the transaction execute its business writes, replace its event claim immediately before completion, and verify that the financial state remains unchanged. The replacement then completes through the real worker and records one relevant ledger entry. Fixtures honor the existing immutable provider identity, verified-reference and refund-approval constraints.

Regression: **125 tests passed in 13 files**, with no skips, recorded in `%TEMP%/allied-webhook-regression.json`. Coverage includes capture accounting, competing payment targets, owner financial/refund controls, Paystack/Monnify flows, notification retry authority, database clocks, route security and OpenAPI contracts. After the final claim SQL timestamp update, **46 tests passed in three files**, recorded in `%TEMP%/allied-webhook-final-claims.json`.

The OpenAPI artifact, endpoint handbook and frontend API types were regenerated; their changes describe behavior without changing request/response shapes. No rendered frontend code changed for this repair, so browser tests were not repeated. Provider tests are synthetic and no money or message was sent.

Backend typecheck, lint and final build passed. OpenAPI validation passed for 265 paths; route verification matched 314 documented operations plus four explicit infrastructure routes. Affected TypeScript formatting and frontend `tsc --noEmit` passed. The secret guard passed for 1,654 non-ignored files.

## Rollout and remaining boundaries

Drain and restart the API and all general workers together: older callback/service or worker code can still write without the ownership predicate. Deployment has not been performed. Earlier [UTC migration and pool changes](database-time.md) retain their separate rollout requirements.

Investigate historical failed/dead-letter records through the existing administrator operations workflow and current financial records before requesting retries. The repair does not rewrite financial history, reset attempt counts, provision payment providers or promise exactly-once external delivery. Real deployed callback delivery, provider settlement, historical stranded notification recovery and remaining payment-state transition audits are still open acceptance work.

The subsequent [refund observation audit](refund-observation-integrity.md) repairs conflicting completed-refund observations, provider-bound refund correlation and review-hold preservation. Event ownership prevents a superseded attempt from committing; ordering and terminal-state rules between distinct verified events retain their separate acceptance evidence.
