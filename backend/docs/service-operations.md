> Historical phase document. Booking-deposit, provider-activation and readiness claims below are superseded by the signed 22 September owner decisions. Use [the current implementation matrix](owner-implementation-matrix.md) and [staging runbook](owner-staging-runbook.md).

# Service Operations Security and Lifecycle

Phase 5 owns service definitions, customer bookings, branch-scoped staff scheduling, quote versions, and work orders.

## Trust boundaries

- Public callers can read only active services, the current booking policy, and eligible open slots.
- Customers can create and read only their own bookings, transfer one qualifying confirmed booking,
  and accept or reject only their own issued, unexpired quotes.
- Staff access is denied unless MFA assurance is complete and the booking belongs to the staff member's active branch.
- Administrators and super-administrators manage service definitions; every mutation is CSRF protected and audited.
- Customer responses exclude staff notes and work-order internal notes.

## Concurrency and scheduling

Bookings, slots, services, quotes, and work orders use integer optimistic versions. Mutations with a stale version fail with `STALE_VERSION`.

Staff/slot/customer schedules and retry-sensitive booking operations are serialized with
transaction-scoped advisory locks and idempotency records. Interval-overlap checks use the fixed
service duration while exclusion/partial indexes prevent overlapping published staff slots and more
than one active booking per slot. Transactions contain database work only and never make provider calls.

## Money and immutable history

All request and response money uses decimal-free integer-kobo strings. The server snapshots a
fixed-price booking, computes its 30% deposit with half-up integer rounding, and creates the payment
atomically. Quote and work-order subtotals are calculated on the server. Part prices come from the
active product record and cannot be supplied by clients.

Changing quote lines creates a new quote version and voids the superseded draft. Issued quote amounts and lines remain immutable. Work-order items are append-only, and closed work orders reject new items. Physical deletes remain prohibited by database triggers.

## Lifecycle maps

- Legacy booking: `REQUESTED -> CONFIRMED | CANCELLED`.
- Deposit-backed booking: `AWAITING_DEPOSIT -> CONFIRMED | CANCELLED | EXPIRED` after a 30-minute
  hold; `CONFIRMED -> IN_PROGRESS | CANCELLED | NO_SHOW`; `IN_PROGRESS -> COMPLETED | CANCELLED`.
- Customer cancellation/no-show forfeits the deposit. One customer reschedule is permitted at least
  24 hours ahead. A business disruption permits a slot transfer or a four-eyes full-refund request.
- Confirmed appointments receive versioned reminders at 7 days, 72 hours, 48 hours, and 24 hours;
  rescheduling cancels obsolete jobs and creates replacements.
- Quote: `DRAFT -> ISSUED | VOID`; `ISSUED -> ACCEPTED | REJECTED | EXPIRED | VOID`.
- Work order: `DRAFT -> APPROVED | CANCELLED`; `APPROVED -> IN_PROGRESS | CANCELLED`; `IN_PROGRESS -> AWAITING_PARTS | QUALITY_CHECK | CANCELLED`; `AWAITING_PARTS -> IN_PROGRESS | CANCELLED`; `QUALITY_CHECK -> IN_PROGRESS | COMPLETED | CANCELLED`.

Terminal states have no outgoing application transition. The database independently enforces monetary, timestamp, uniqueness, and immutability constraints.
