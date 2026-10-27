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

Exact runtime `9e04031fe0668d977e802168be3b9ff323c2a482` passed the
[backend database-safety workflow](https://github.com/Otto-space/allied-autotech/actions/runs/40462330861)
and [repository secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40462330852).
The database-safety workflow replayed all candidate migrations, checked drift,
types and lint, and ran its selected isolated database suites; it did not run
`refund-processing.test.ts`. A separate local disposable PostgreSQL 18 run for
that suite was attempted, but automatic command review rejected starting its
task-owned container with the reason `blocked by policy`. No container or
database was created by that attempt. The direct real-database refund transition
therefore remains unverified at this checkpoint.

## Isolated real-database follow-up — 27 October

The existing `refund-processing.test.ts` suite is now included as a dedicated
step before other refund fixtures in the GitHub database-safety workflow. Its
manual approval case additionally reads the committed refund and checks that
`NEEDS_ATTENTION`, `OFFLINE_PROCESSING_REQUIRED` and the approver are stored
together. Both suite cases passed against the workflow's isolated `_ci`
PostgreSQL target on exact runtime `70f5615ac3da9990bbf76a7a17cfb1ceb70fbf1e`.
The full [database-safety run](https://github.com/Otto-space/allied-autotech/actions/runs/40466928896)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40466928798)
passed. This closes the earlier direct database-transition test gap for the
tested manual path. It does not verify real bank movement, provider settlement,
production financial rows or a live role session; the candidate is unreleased.
