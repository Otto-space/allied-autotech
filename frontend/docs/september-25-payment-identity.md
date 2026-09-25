# September 25: exact receipt identity and duplicate-credit prevention

## Change and preserved behavior

One gateway transaction could previously become two successful attempts and two capture credits, even for different customer orders. Seven database cases reproduced this. The payment service now serializes claims by provider and transaction ID before recording success. A competing claim becomes a `REUSED_PROVIDER_TRANSACTION` anomaly and verification hold; it creates no second credit or allocation. Same-attempt verification remains idempotent, different receipts remain recordable, and identical ID strings in different providers remain independent. Mismatched positive NGN receipts retain their actual amount and cannot be used to pay another order.

Successful facts remain immutable. Contradictory legacy duplicate rows are reported without another capture backfill. Holds do not automatically release on later reports. The existing owner, staff capabilities, payment amounts, refund approvals and source-allocation rules were not changed.

Paystack IDs were also being converted through JavaScript numbers before string storage. The parser tests reproduced rounding, including `9007199254740993` becoming `9007199254740992`. Webhook and adapter parsing now use the original JSON ID token supplied by Node 24's reviver context. Numeric 64-bit IDs remain exact strings for verification, refunds, disputes and event deduplication. Unsafe numeric representations, blank IDs and fractional numeric IDs are rejected. Monetary parsing remains strict and separate. This follows the [Paystack transaction ID contract](https://paystack.com/docs/api/transaction/); Monnify's adapter continues to use its [transaction reference](https://developers.monnify.com/docs/collections/manage-payments/verify-transactions).

Reconciliation previously counted two reports of the same receipt twice despite detecting state differences. It now stores the observed gateway transaction ID and checks persisted items across batches. A receipt already confirmed for a different attempt is excluded even if that attempt is outside the selected period. Duplicate observations remain visible with a null amount, not a second contribution. The worker remains read-only for financial records and uses bounded batches.

## Migrations and deployment

Two migrations were added:

- `20260925001500_unique_provider_receipts`: transactional preflight, a partial unique index on successful online `(provider, gatewayTransactionId)`, and a nonempty successful receipt-ID constraint. Manual receipts are outside this index.
- `20260925002000_reconciliation_receipt_identity`: nullable `PaymentReconciliationItem.providerGatewayTransactionId` and an index for receipt lookup within a run. Historical items are not fabricated or backfilled.

The first migration stops if existing successful rows share one provider receipt. It never picks a winner, edits successful rows, deletes accounting history or fabricates a refund. An authorized operator must investigate such records before migration deployment. This is a real deployment prerequisite; application locking is not a substitute for applying the constraint.

Both migrations are applied only to `allied_receipt_final_20260925_test`. Prisma reports all 42 migrations applied and a valid schema. The first 41 were replayed on the fresh database; the second new migration then applied successfully. The older synthetic database deliberately contains seven duplicate groups from the failing regression. Executing the first migration there rejected those groups, retained the same seven groups after rollback and created no partial index. The preliminary `allied_receipt_20260925_test` database predates the final transactional migration text; use the `final` test database for further checks.

No production migration, payment-provider request, customer notification, account change, dependency or environment variable was added. Test commands used process-local database settings and disabled outgoing providers. The extra reconciliation field changes internal persistence; it does not introduce a browser endpoint or expose provider payloads.

## Verification

- Capture accounting: 22 database cases pass, including eight new identity cases. Seven of those new cases failed before the fix; provider namespace separation already worked.
- Reconciliation: 16 database cases pass, including two reproduced duplicate-total failures and the prior pagination/amount/currency/error boundaries.
- Combined payment, expiry, manual review, evidence, provider-flow and refund-control regression: **80 tests in 12 suites pass**.
- Paystack identity: 24 cases pass after 18 reproduced failures. Combined provider/security unit checks: **39 tests in four suites pass**.
- Backend build, lint, script typecheck and Prisma validation/migration status pass. API contracts are regenerated from the implementation.
- OpenAPI validation passes for 224 paths; all 268 documented operations match mounted routes with four explicit infrastructure exclusions. Regenerated frontend types pass typecheck. Changed documentation and generated artifacts are formatted, and `git diff --check` passes. No rendered UI changed, so this increment makes no new browser or frontend production-build claim.
- Existing experimental WebCrypto and `pg` concurrent-query deprecation messages occur in adjacent tests. No clean-warning, live-provider or bank-settlement claim is made.

Remaining work includes controlled migration deployment, investigation of any real duplicate history, reconciliation scheduling gaps and same-period failed-run recovery, an approved auditable hold-resolution workflow, and genuine provider/storage integration. Local-reference reconciliation cannot discover provider-only receipts or prove bank settlement. The broader full-stack, image, accessibility, performance and 20-topic final-report goal remains active.
