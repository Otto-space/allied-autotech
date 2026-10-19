# Administrator and delegated refund workspace

Backend and frontend gate 83 are locally verified. See the [page acceptance
record](../../frontend/docs/page-quality/work-refunds.md). Deployment and application-
wide acceptance remain open.

New `GET /api/v1/staff/refunds/{refundId}` reads the original UUID independently of
status filters, cursor paging or UI selection. It requires a current active verified
staff identity and verified MFA. Admin/Super Admin may inspect the same complete scope
as the administrator queue; Staff requires a live REFUND_APPROVE, REFUND_TRANSFER or
REFUND_CHECK capability and a matching stage in the existing delegated queue scope.
Out-of-scope records return 404; missing capabilities return 403. Customer, anonymous
and unverified administrator access is denied. Unknown/array queries and invalid
UUIDs are rejected. A repeatable-read transaction checks scope, reads facts and
appends a minimal REFUND READ audit containing only view/status metadata.
The existing authentication middleware also retains the workforce responsibility
boundary; this endpoint does not bypass it for workforce-managed accounts.

The new projection extends the safe queue with cancelledAt and cancellationNote.
It excludes bank beneficiaries, evidence URLs/object keys/hashes, provider diagnostics,
policy snapshots and idempotency material. Cancellation notes come from the matching
saved cancellation audit, not a reused provider failureMessage. Earlier cancellation
audits without a note yield null; that does not prove no original note existed.
New cancellation decisions atomically include the submitted note/null in their audit
and return that exact note with the stored cancellation timestamp. Existing stored
provider diagnostics are preserved and never relabelled as cancellation notes.

Both original refund queues now return private no-store responses. Their existing
status/limit/cursor contracts, requestedAt/id ordering and safe projections remain
unchanged. The original staff queue still requires a refund capability even for an
administrator; the independent current read deliberately supports the already existing
administrator inspection scope. Customer payment/refund projections are unchanged.

Financial behavior remains authoritative on the server: separate requesting,
approving, transferring and checking operators; live capability/MFA/CSRF checks;
capture/dispute rules; row locks; durable gateway worker dispatch; verified private
uploads; existing exact-body transfer/check repeat handling; and once-only refund
ledger effects. Approval does not prove returned funds. Recording an external bank
transfer does not send money. Independent accepted checking confirms completion and
creates its accounting entry. A current record read never proves an original request
outcome and must not cause replay or a replacement transfer.

Four new API/database scenarios passed: exact safe current facts/private audit,
administrator/delegated/revoked/role scope, strict query/reference boundaries and
private queues, and exact cancellation time/note with no refund ledger or repeat
decision. Two existing delegated queue/approval/transfer/evidence/check scenarios
passed. After tightening cancellation-note provenance, only the two affected new
scenarios were repeated, reusing established identities/capture fixtures and adding
one requested refund for the changed cancellation check. The other passing checks
were reused. Backend TypeScript, scoped lint/formatting and route/OpenAPI validation
pass: 300 paths, 354 documented operations plus four explicit infrastructure operations
in the current workspace. Frontend generated declarations were regenerated.

The guarded target was confirmed before writes as `127.0.0.1:55480 /
allied_work_aftercare_20261017_test`, with the existing restricted runtime. Existing
identities/catalogue were reused; synthetic operator/refund/capture fixtures were
additive. Capture setup used the actual manual approval API after incomplete synthetic
setup exposed settlement constraints. Partial synthetic fixtures were preserved;
no constraints were bypassed and no database was reset. New current-refund tests
remove only their own temporary sessions; existing regression fixtures remain intact.
No application/shared database, schema/migration, existing grant, backup/restore,
push or deployment operation was performed for this foundation. Gate 82's unchanged
60-migration compatibility evidence was reused.

Private evidence under `C:/Users/PC/.codex/`: `work-refunds-api-tests.log`,
`work-refunds-regression-tests.log`, `work-refunds-note-tests.log` and
`work-refunds-api-fixtures.json`. Tests are reviewable in
[work-refunds.test.ts](../tests/integration/work-refunds.test.ts) and
[refund-processing.test.ts](../tests/integration/refund-processing.test.ts).
The page coordinator, persistent pending locks, responsive UI and browser/native
acceptance now pass. All 57 production browser scenarios pass. Connected UI/API/DB
verification exercised approval, verified transfer evidence and independent checking
with four separate operators: three UI financial writes, three mutation audits and
one refund ledger entry. Lost approval/check responses recovered through current
reads without replay. Other refund/payment/customer snapshots were preserved.
The explicit isolated in-memory storage port verified actual bytes/SHA-256; external
S3/provider delivery was not tested. Durable actor/refund/action/body-bound original-
outcome receipts remain optional under ADM-45. No new schema/migration/grant change,
shared database operation, backup/restore or deployment occurred for acceptance.
