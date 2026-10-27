# Manual payment review session boundary — 27 October 2026

## Finding and change

`PaymentsService.reviewManual` previously checked the approver's role and MFA
from the request actor before opening its transaction. A session revoked or an
account changed before the transaction began could still approve/reject manual
evidence, settle a payment and record a ledger entry. The review transaction now
locks and rechecks the current user, session, expiry and MFA before reading the
attempt or writing the decision. The existing different-operator rule, pending
status check, conditional update, settlement and audit remain in place.

## Evidence and limits

Two focused unit cases first failed with the old behavior, then passed with a
revoked session denied before payment read or mutation. The existing real-database
concurrent-review fixture now creates actual test sessions and asserts that only
one of two simultaneous decisions succeeds; it no longer waits for both reads
inside transactions that are intentionally serialized by the access lock.

Backend typecheck, scoped lint and formatting passed locally. The exact-source
GitHub database-safety workflow has a dedicated isolated `_ci` PostgreSQL step
for this concurrency test and the unit regression. Its outcome must be recorded
after the push. No application database, provider, customer payment or production
deployment changed here. The P0 reconciliation candidate and its release gates
remain open; providers remain disabled.
