# Service Operations Security and Lifecycle

Phase 5 owns service definitions, customer bookings, branch-scoped staff scheduling, quote versions, and work orders.

## Trust boundaries

- Public callers can read only active services.
- Customers can create and read only their own bookings and can accept or reject only their own issued, unexpired quotes.
- Staff access is denied unless MFA assurance is complete and the booking belongs to the staff member's active branch.
- Administrators and super-administrators manage service definitions; every mutation is CSRF protected and audited.
- Customer responses exclude staff notes and work-order internal notes.

## Concurrency and scheduling

Bookings, services, quotes, and work orders use integer optimistic versions. Mutations with a stale version fail with `STALE_VERSION`.

Staff and customer schedules are serialized with transaction-scoped advisory locks. Interval-overlap checks use the configured service duration while active-booking partial indexes keep schedule lookups bounded. Transactions contain database work only and never make provider calls.

## Money and immutable history

All request and response money uses decimal-free integer-kobo strings. Quote and work-order subtotals are calculated on the server. Part prices come from the active product record and cannot be supplied by clients.

Changing quote lines creates a new quote version and voids the superseded draft. Issued quote amounts and lines remain immutable. Work-order items are append-only, and closed work orders reject new items. Physical deletes remain prohibited by database triggers.

## Lifecycle maps

- Booking: `REQUESTED -> CONFIRMED | CANCELLED`; `CONFIRMED -> IN_PROGRESS | CANCELLED | NO_SHOW`; `IN_PROGRESS -> COMPLETED | CANCELLED`.
- Quote: `DRAFT -> ISSUED | VOID`; `ISSUED -> ACCEPTED | REJECTED | EXPIRED | VOID`.
- Work order: `DRAFT -> APPROVED | CANCELLED`; `APPROVED -> IN_PROGRESS | CANCELLED`; `IN_PROGRESS -> AWAITING_PARTS | QUALITY_CHECK | CANCELLED`; `AWAITING_PARTS -> IN_PROGRESS | CANCELLED`; `QUALITY_CHECK -> IN_PROGRESS | COMPLETED | CANCELLED`.

Terminal states have no outgoing application transition. The database independently enforces monetary, timestamp, uniqueness, and immutability constraints.
