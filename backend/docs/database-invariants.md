# Database invariants

Catalogue prices are non-negative integer kobo and use `NGN`. Compare-at prices cannot be below the
selling price. Cart quantities and reservation quantities are positive. Compatibility years use a
bounded, ordered range. A product can have at most one primary image.

Inventory always satisfies `quantity >= 0`, `reserved >= 0`, and `reserved <= quantity`.
`available` is derived as `quantity - reserved` and is never stored. Each balance change increments
the optimistic `version` and writes an `InventoryTransaction` whose before/after values must match
its deltas. Inventory transactions are protected by an append-only database trigger.

Reservations start as `ACTIVE` and may transition exactly once to `RELEASED`, `CONSUMED`, or
`EXPIRED`. Identity, quantity, expiry, request fingerprint, and business reference are immutable.
Terminal rows and deletes are rejected by the database. A partial unique index permits at most one
active reservation for the same inventory/business reference.

Application code takes idempotency advisory locks before inventory row locks and always locks a
single inventory row before changing it. Future multi-item checkout code must lock inventory IDs in
ascending order to preserve deterministic ordering and avoid deadlocks.

Service, booking, quote-revision, and work-order versions are non-negative. A booking may reference
an active operational branch; legacy rows remain nullable until explicitly remediated and are denied
to ordinary staff. Partial indexes support active staff and vehicle schedule checks.

Quote totals equal the sum of server-calculated line subtotals and tax in integer kobo. Part prices
come from Product, issued quote monetary fields cannot change, quote rows/items cannot be deleted,
and only one quote per booking may be accepted. Revisions create new quote versions and void the
superseded draft. Work-order items are append-only, and no item can be added to a completed or
cancelled work order. Status-specific booking, quote, and work-order timestamps are database checked.

New orders require an operational branch and retain immutable customer, fulfilment, item-price,
discount, delivery-fee, currency, and total snapshots. The order total is exactly subtotal minus
discount plus delivery fee. Checkout inventory rows are locked in deterministic order; confirmation
consumes reservations, while cancellation records release or compensating restock movements.

Promotion redemptions are append-only snapshots. A promotion row lock serializes global and
per-customer usage checks. Cancelled orders remain auditable but do not consume active eligibility
limits. Invoice rows have exactly one source, and an insertion trigger independently verifies the
customer, currency, subtotal, tax, and total against the order, accepted quote, or committed vehicle
transaction. Issued invoice source and monetary fields cannot change, and financial rows cannot be
physically deleted.

Physical vehicles, listings, documents, inspections, transactions, and handovers use non-negative
optimistic versions where mutable. A physical vehicle has at most one available or reserved listing,
one primary image, and one committed transaction buyer. Vehicle prices are positive integer kobo in
NGN. Status-specific timestamps, inspection windows, document sizes/checksums, condition scores, and
handover values are checked in PostgreSQL.

Vehicle price and transaction-status histories are append-only. Buyer, listing, identity snapshot,
asking price, agreed price, and currency are frozen after a payment attempt exists. Private condition
report and signed-handover object keys cannot be reused; signed handover evidence cannot be replaced.
Reservation code locks listing before transaction and the database partial index remains the final
concurrency backstop.
