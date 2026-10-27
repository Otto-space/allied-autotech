# Refund approval state atomicity — 27 October 2026

## Finding and change

`PaymentsService.decideRefund` previously committed an approved manual refund, or
an approved online refund without a captured provider transaction ID, as
`APPROVED`. It then made a separate update to `NEEDS_ATTENTION` with
`OFFLINE_PROCESSING_REQUIRED`. A crash or failed second write could leave a
committed approval in the provider-dispatch state without the intended review
flag. The refund worker already excludes manual attempts, but the stale state
would be visible and would not carry the offline-processing reason.

The approval transaction now stores `NEEDS_ATTENTION`, the provider status,
approver and approval time together with the existing decision audit. Online
attempts with a captured transaction ID still commit as `APPROVED` for the
durable refund worker. The independent-approver, capability, dispute and
refund-clock checks are unchanged. No provider call, transfer or ledger entry is
made by this decision.

## Verification and release boundary

The regression first reproduced failure when a post-commit refund update was
unavailable. After the change, three focused cases pass for manual, online
without a captured transaction ID, and dispatch-ready online approvals. The
adjacent Phase 8 payment-security unit cases also pass; the combined result is
10/10. Backend typecheck, scoped lint, formatting and diff checks pass. The
existing database constraint permits `NEEDS_ATTENTION` with an approval time
and approver; no schema or migration changed. This focused test uses an isolated
transaction double, not a real provider or a populated financial database.

The change is on the unreleased reconciliation candidate. A compatible backend
rollout and target-environment refund acceptance remain open; payment providers
stay disabled. No application database, provider, refund, notification or
production deployment was changed by this checkpoint.
