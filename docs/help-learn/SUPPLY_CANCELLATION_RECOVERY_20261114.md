# Supply cancellation refund recovery - 14 November 2026

## Implemented scope

Current assured Admin/Super Admin can use the existing Payment records refund
request after an actual account or email-verified guest buyer cancels the original
collection order before confirmation. A supply concern no longer blocks this
narrow full-remaining-amount recovery. Earlier failed/cancelled requests keep their
history. No new endpoint, permission, approval, payment, stock or handover is created.

The private basis binds the immutable original cancellation audit and original
buyer identity, cancelled original/no confirmation, actual unfulfilled physical
history, current saved zero-fee pre-confirmation rule and approved manual-refund
policy. It requires canonical verified NGN capture, matching original payment/order
ownership and amount, independent manual capture review where applicable, no open
selected payment anomaly/dispute and the full remaining capture after commitments.
A staff cancellation is not buyer consent. Unknown/technical/affected-portion cases
stay in their actual review path; this does not approve broader cancellation terms.
The basis stays in the immutable private refund policy snapshot and is excluded
from refund queue and buyer/guest output. Existing separate approval, dispatch,
actual transfer, independent checking, settlement, caps and replay still apply.

## Forward migration evidence

131 adds the narrow original-buyer basis and insert guard. Fresh isolated replay
passed, but the first three native fixtures failed before exercising the request:
Payment has no guestId column and guest cancellation requires its existing
versioned aftercare key. Payment identity is bound through the immutable original
Order. The fixtures now use that real model/key and guest manual submitter is null.
132 is a forward-only guard correction using the existing Order binding; applied
131 was retained unchanged. No application/shared database was used or modified.

Fresh132 replay/schema diff/db:check and three native journeys pass on owned
loopback tmpfs storage with restricted runtime: verified guest recovery, account
recovery after a separately cancelled previous request, and refusal to treat staff
cancellation as buyer consent. Actual current request/approval/transfer/check and
settlement services are exercised with synthetic provider/storage evidence; replay,
full amount, separate self-approval, immutable private basis and buyer privacy are
asserted. This is not bank/provider or real-role acceptance. Owned tmpfs cleanup
completed with process exit0. Final132 broad native regression passes193/193 across15 files with process
exit0 and verified owned tmpfs cleanup. The77 focused guide/provider/calendar/
timing units also pass. Source/focused types and scoped lint pass; the guide/unit aggregate
had one stale aftercare-v5 expectation, corrected and its17-case file passes.

## Learning and publication

Restricted refund-work v12, financial-aftercare v6 and administrator order-sourcing
v11 explain actual cancellation provenance and separate financial duties. Customer
collection v7/staff v6, eligibility, semantic targets and publication flags remain.
No public DTO or frontend interaction changed. The frontend6df28b6e matrix is kept
running while this backend-only batch is verified. Final exact-master checks and
backup/recovery/restore/migration/runtime safeguards still precede production.
Historical partial monetary allocation and other cancellation origins that lack
actual original/customer/financial evidence remain separate; general returns and
warranty terms stay deferred. Booking and purchasing readiness remain distinct.

## Bounded local cleanup

Local database verification initially stopped at the20.25GiB growth preflight.
34 obsolete ignored webpack _.pack/_.pack.gz files under this worktree's
frontend/.next/dev/cache/webpack were individually removed after verifying path
bounds, no linked entries, no active Next process and unchanged old file metadata.
Removed166231324 bytes (158.53MiB); measured C: free space20.262->20.417GiB at cleanup.
Source, runtime output, dependencies, data, secrets, history, images and rollback
resources were retained. Later measurements vary independently; this is not an OS
quota or a machine-wide guarantee. No folder, database, image or volume was pruned.

Automatic approval review rejected deletion of the verified80KiB aborted-browser
profile with "blocked by policy". It was retained; no alternate deletion was used.
