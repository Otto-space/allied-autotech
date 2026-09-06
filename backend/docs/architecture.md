# Backend architecture

The Express composition root mounts bounded modules beneath `/api/v1`. Controllers adapt validated
HTTP input; services own authorization, transactions, and invariants; repositories own Prisma query
shape and safe projections. Domain modules do not return broad Prisma models at HTTP boundaries.

Phase 4 separates catalogue and inventory responsibilities. Catalogue owns categories, products,
compatibilities, public product images, favourites, and carts. Inventory owns branch balances,
reservations, immutable movements, optimistic versions, and row-lock coordination. Checkout may call
the inventory service in a later phase, but it must not update inventory tables directly.

Public reads expose only active products in active categories. They expose availability as a boolean
per active branch, not internal quantities. Customer writes derive ownership from the session.
Catalogue administration requires an MFA-assured administrator. Inventory staff access is resolved
from the staff profile's active branch, while administrators may work across branches.

All stock mutations execute in short transactions. They HMAC the client idempotency key, serialize
same-key work with a transaction advisory lock, lock the inventory row with `FOR UPDATE`, validate
the new balance, update through the optimistic version, append a movement, and add an audit event.
No provider calls or other network work occurs while a database lock is held.

Phase 5 adds the service-operations bounded context. It owns service definitions, customer-owned
bookings, branch-scoped scheduling, immutable quote versions, and work orders. Schedule decisions
are serialized with transaction advisory locks and checked as duration-based intervals. Customer
projections omit staff and internal work-order notes. See `docs/service-operations.md` for the
authoritative lifecycle and security boundaries.

Phase 6 adds orders, promotions, and billing. Checkout composes those modules inside one short
database transaction and locks cart, inventory, and promotion resources in deterministic order.
Order items, promotion usages, and invoice amounts are immutable source snapshots. The orders
module owns inventory reservation/consumption compensation because it is the aggregate coordinator;
all such writes preserve the Phase 4 balance, version, and append-only transaction invariants. See
`docs/orders-promotions-billing.md` for route, lifecycle, and privacy boundaries.

Phase 7 adds the vehicles and vehicle-sales bounded contexts. Vehicle inventory owns listings,
immutable price history, condition data, and private assets. Vehicle sales owns customer inspections,
negotiations, one-winner reservation commitment, expiry, transaction history, and handover. The
listing row is always locked before the transaction row. Object-storage calls occur before database
transactions, while database references and audit events commit atomically. See
`docs/vehicles-and-sales.md` for the authoritative lifecycle and asset boundaries.

OpenAPI 3.1 is generated from the Zod schemas used at runtime. The documentation adapter is mounted
only when explicitly enabled by environment policy; it is kept outside domain controllers and does
not weaken the application's global security middleware.

Phase 8 adds the payments bounded context and a Paystack adapter. Payment services derive financial
truth from locked business resources and persist state, ledger entries, anomalies, and audit events
transactionally. Provider calls never occur while database row locks are held. Paystack webhooks are
isolated as raw bytes, authenticated before parsing, allowlisted, deduplicated, and replay-safe.
Manual evidence uses private storage capabilities and branch-scoped access. Refund approval enforces
four-eyes separation. Reconciliation and webhook-retry workers operate in bounded batches and do not
overwrite immutable financial history. See `docs/payment-invariants.md` for the authoritative rules.
