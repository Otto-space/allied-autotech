# Orders, promotions, and billing

Phase 6 treats checkout as one PostgreSQL transaction. The server locks the cart and selected branch inventory in deterministic order, reads active product prices, evaluates a locked promotion, writes immutable order items and promotion-use snapshots, creates a draft invoice, reserves inventory, clears the cart, appends an audit event, and completes the idempotency record atomically.

## Authorization

- Customers may only checkout, list, read, and cancel their own pending orders. Draft invoices are not customer-visible.
- Staff access is restricted to the active branch assigned to their staff profile and requires MFA assurance.
- Administrators may operate across branches and manage promotions. All mutations require CSRF protection.
- Client-supplied customer identifiers, prices, discounts, totals, currencies, invoice amounts, and inventory balances are never accepted.

## Lifecycle and stock

Orders transition `PENDING -> CONFIRMED -> PROCESSING -> READY -> COMPLETED`. Cancellation is allowed from `PENDING`, `CONFIRMED`, or `PROCESSING`; terminal states cannot transition. Pending checkout stock is reserved for 30 minutes. Confirmation consumes the reservations as sales. Pending cancellation or expiry releases reservations; cancellation after confirmation records a compensating restock transaction. All balance changes use row locks, optimistic inventory versions, and append-only inventory transactions.

## Promotions and invoices

Promotion evaluation enforces activation windows, minimum order values, global and per-customer limits while holding a promotion row lock. Percentage math uses integer basis points and integer kobo. Redemption snapshots remain immutable even if the promotion later changes; cancelled orders no longer consume eligibility limits.

Checkout creates an amount-authoritative draft order invoice. Staff may also create invoices from an accepted booking quote or a committed vehicle transaction. Each invoice has exactly one source. Issued invoice sources and amounts are database-protected; paid invoices cannot be voided through this module.

## Idempotency and privacy

Checkout requires `Idempotency-Key`. Only an HMAC hash and request fingerprint are stored. A matching retry returns the original order; reuse for different input is rejected. Customer and staff projections exclude token hashes, internal idempotency records, inventory request hashes, and unrestricted payment/provider data.
