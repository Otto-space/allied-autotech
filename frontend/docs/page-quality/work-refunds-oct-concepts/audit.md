# Refund request workspace audit — gate 83

Route `/admin/refunds`. Current accepted total remains 82. This gate is open; no
refund page UI implementation has started. Four production baselines at 430/768/1280/
1440px were captured and viewed with synthetic records. They have no page overflow
or errors, but controls and records occupy excessive height, the first refund pushes
all other records below the fold, and loose totals/metadata lack a clear handling
workspace. Reason, exact timestamps, lifecycle/operator identities, clock/provider
facts and full references require a complete deliberate presentation.

Current Admin/Super Admin reads use `/admin/operations/payment-refunds`, which permits
the full private safe queue. Delegated Staff reads use `/staff/refunds`, with active
verified role/MFA and live REFUND_APPROVE/TRANSFER/CHECK capabilities; the scope is a
union of eligible requested/own-approved, approved human bank and transferred bank
records. Preserve both boundaries. Queue supports strict status/limit/cursor only,
ordered requestedAt/id descending. Both return `refundQueueSelect`, excluding bank
beneficiary, evidence object keys and policy evidence. The frontend currently strips
providerRefundId and policyVersionId and loses useful returned facts.

Admin reads currently begin before own-profile confirmation. Profile refresh failures
and denial need consistent protected-data handling. URL status/cursor/history/selected
state must persist. No global totals or unsupported filters should be fabricated.
All financial amounts remain exact integer kobo and NGN; requested/approved/transferred/
independently confirmed states must never imply the same outcome.

Reuse RefundDecisionForm, RefundTransferForm, RefundEvidenceCheck, MutationReview,
capability/profile hooks, cursor history, signed upload/evidence validation and the
accepted account-bound pending patterns. Fresh identity/capability and exact current
refund preflight must precede dispatch. Forms keep drafts until an exact receipt is
validated, cancellation makes no extra reads and success/recovery receives focus.
Uncertain decision/transfer/check outcomes need minimal persistent actor/refund/action/
fingerprint locks; explicit current reads do not prove original request outcomes.
Never persist beneficiary/account fields, evidence URLs/tokens or raw form bodies.

Backend preserves separate operators: requester cannot approve; transfer operator
differs from requester/approver; checker differs from all three. Manual evidence
uploads bind actor/refund/file metadata and completion verifies uploaded integrity.
Transfer records an already completed external bank transfer; it never sends money.
Independent accepted checking creates the once-only refund ledger entry. Gateway
approval dispatch belongs to the durable worker and must never enable a manual bank
replacement. Retain locks, exact-body duplicate transfer/check handling, live
capability checks, CSRF, dispute checks and source capture limits.

Audit identified no direct current-refund GET independent of paging. Add a private
audited safe read preserving administrator versus delegated queue scope, so stale
preflight and reload recovery can check the original UUID. Inspect decision receipt
handling for cancellation timestamp/note: current queue omits both although stored
fields exist. Expose only explicitly needed safe staff facts, preserving customer
projections and all financial rules. Do not introduce schema changes for UI recovery.
Durable original transition receipts remain a separately documented optional gap.

The current preserved isolated test target now has 60 migrations and restricted runtime
access to the new workforce tables. Reuse gate 82 compatibility evidence; confirm the
actual target before new synthetic writes. Do not repeat completed invoice financial
tests or change shared/application data, migrations or existing grants for this gate.

## Verified foundation — recorded before UI implementation

Fresh complete desktop/mobile concepts have been generated with the built-in image
tool, saved and viewed. The specification records corrections to generated branding,
amounts, dates, pagination, refresh emphasis and cancellation-note limits before UI
implementation. The original refund UI remains unchanged at this checkpoint.

The independent scoped current-refund endpoint, private queue headers and exact
cancellation facts are now implemented. Cancellation-note provenance uses the saved
decision audit and preserves private provider diagnostics. Four new API/database
scenarios and two existing delegated workflow regressions pass; only the two affected
new scenarios were repeated after tightening note provenance, reusing capture fixtures.
See backend/docs/administrator-refunds.md for exact contracts and target evidence.

New frontend helpers enforce supported URL filters/history, complete strict queue/
current facts, paging order/duplicates/scope, independent capability-based handling
and exact cancellation/approval receipts. Five helper unit cases pass. The page
coordinator, persistent action locks, form receipt integration, responsive UI and
production/browser/API/DB acceptance were still unfinished at that checkpoint.
They have now passed the separate [gate 83 acceptance record](../work-refunds.md).
Current accepted total: 83. Payment exceptions are next; the overall goal remains active.
