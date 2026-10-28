# Refund request and approval session boundary — 27 October 2026

`PaymentsService.requestRefund` checked the operator role and MFA before its
transaction, then could replay or create a refund after that session was revoked.
`decideRefund` rechecked the approval capability inside its transaction but did
not revalidate session revocation or expiry. A focused regression first showed
a revoked requester reaching a refund lookup and a revoked approver committing
an approved refund.

Both transactions now use the existing locked current-account/session/MFA check
before their refund-specific reads, advisory lock, approval capability check or
writes. Requester-bound idempotent replay, branch checks, independent approval,
amount ceiling, dispute hold, audit and the existing refund worker remain intact.
No provider submission or ledger action was added.

The unit regressions pass with revoked sessions, and the three existing approval
publication cases remain green. Phase 8 and Monnify isolated integration
fixtures now use real current test sessions for direct service calls. The exact
GitHub database-safety workflow has a dedicated isolated `_ci` step for those
real-database payment flows and the new unit cases. Exact runtime
`e74d4ae78bcf22772f76d6729ca2cf947075bee8` passed
[backend database-safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40465987685)
and the [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40465987682).
The focused CI step passed all four suites: one Phase 8 integration case, one
Monnify integration case, four approval-publication units and one revoked-request
unit. The locally combined session/approval units passed 10/10. This source is
unreleased; real provider sandbox, production-role acceptance, reconciliation
recovery gates and compatible production rollout remain open. Payments remain
disabled.
