# Dispute observation integrity

Updated 12 October 2026. SEC-030 protects existing dispute records and completed financial outcomes.

## Behavior

A Paystack callback for an existing dispute must match its original payment attempt, amount and currency before it may advance the dispute. A conflicting observation is recorded as an anomaly against the original dispute/payment, and its webhook receipt completes without changing the dispute, ledger or change audit. It cannot settle a dispute belonging to another payment reference.

Once resolved, a dispute retains its first outcome, resolution time, response deadline and ledger entries. Matching repeat observations and older nonterminal observations leave the row unchanged. Conflicting terminal outcomes create an anomaly rather than replacing the recorded outcome. The audit records applied state changes only. Competing resolutions are serialized; only the first committed resolution takes effect.

Anomalies and webhook completion remain in one transaction. Losing the webhook claim rolls back the anomaly and preserves the newer owner. Anomalies store bounded comparison facts, not raw provider payloads, customer data or credentials.

Migration `20261012200000_dispute_resolution_integrity` extends the existing database guard to reject changes to a resolved outcome or its timestamp, while retaining the original financial identity checks. Operational metadata can still be maintained. The migration changes a trigger function and does not rewrite historical disputes, timestamps or ledger data.

## Verification

All 14 initial cases failed against the old handler/database (`%TEMP%/allied-dispute-integrity-baseline.json`). They covered conflicting payment references, amounts and currencies; late callbacks after each terminal state; repeated matching resolutions; and direct database changes to resolved outcomes/timestamps.

The first repaired run passed 27 of 31 tests. Four failures were test code referring to `auditEvent` rather than the actual `auditLog` model after the financial assertions had passed. That test reference was corrected. Subsequent cases cover competing resolutions, permitted operational metadata and rollback after webhook ownership is replaced.

The expanded regression passed **127 tests across 13 files**, with no failures or skips (`%TEMP%/allied-dispute-integrity-regression.json`). It covers dispute integrity/workflow, refund dispatch/polling/observation integrity, owner controls, provider payment lifecycles, financial webhook ownership, reconciliation and payment security/API boundaries. A later final run passed **17 dispute cases**, including the added claim-loss rollback case (`%TEMP%/allied-dispute-integrity-final.json`). The two runs cover 128 unique tests; overlapping cases are not counted twice.

Backend typecheck, lint, build, affected formatting, secret scanning and `git diff --check` passed. OpenAPI validation passed for 266 paths and route coverage matched 315 API operations plus four infrastructure routes. No public schema or rendered frontend changed in this repair, so browser tests and frontend generation were not repeated.

All 54 migrations replayed on a new empty `allied_dispute_integrity_replay_20261012_test` database. Upgrading `allied_refund_poll_replay_20261012_test` preserved all 12 existing synthetic disputes and every ledger row, verified through canonical row digests. No application database, provider account or deployed process was changed.

## Rollout and remaining provider contract work

Update, 13 October 2026: the BG-12 implementation below is now completed locally; see [Paystack dispute contract acceptance](paystack-dispute-contract.md) for current evidence and deployment limits. The following paragraphs retain the original gap description.

Drain old API/general workers, apply all migrations and deploy the repaired API/workers together. Old code may attempt resolution-time rewrites that the new database guard rejects. Historical inconsistencies require separate evidence-based review; this repair does not fabricate replacement facts.

BG-12 remains required implementation. The current parser expects top-level dispute amount/currency and the mapper primarily recognizes internal status names. Paystack's [Dispute API](https://paystack.com/docs/api/dispute/) documents provider-specific status and resolution fields, nested transaction facts and a separate refund amount. Its [dispute guide](https://paystack.com/docs/payments/manage-disputes/) also permits partial refunds. Those facts must be normalized and verified without treating a merchant's decline as an automatic win or booking the full transaction amount as a partial chargeback. This integrity repair does not establish complete provider payload compatibility.

BG-12 acceptance must cover documented raw provider examples, signed HTTP ingestion, authoritative lookup when facts are absent or ambiguous, safe retry serialization, repeated reminders, amount/currency/payment correlation, and the correct one-time ledger effect for each supported resolution. Unknown outcomes must remain visible for review without invented financial effects. Live provider acceptance remains a separate deployment gate.
