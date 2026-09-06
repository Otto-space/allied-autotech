# Catalogue and inventory operations

Products are created with an active category, an allowlisted SKU and slug, and integer-kobo prices.
Deactivating a category requires its products to be inactive. Deactivating a product requires all
active inventory reservations to be released or consumed. Product media accepts public HTTPS URLs
without embedded credentials; private documents belong to the vehicle asset boundary instead.

Carts are intent only and do not reserve stock. Adding an item checks current aggregate availability,
but checkout must price again and reserve branch-specific stock transactionally. Cart totals are
computed from current server-owned prices and are not payment or invoice authority.

Stock movements support receipts, returns, restocking, damage, sales, and explicit adjustments.
Damage and unreserved sales can consume only available stock. A sale tied to a reservation must
consume the full active, unexpired reservation. Adjustments set an intended on-hand quantity and
cannot reduce it below reserved stock.

Never send an idempotency key that has been used for a different operation or request body. Retries
with the same key and body return the existing effect without creating another movement. Raw keys and
request bodies are absent from inventory history, API projections, audit data, and logs.

## Dependency compatibility note

The deliberate concurrent-reservation integration test can emit a `pg@8` deprecation warning from
Prisma 7.10's `PgTransaction` adapter path even though both requests complete correctly and only one
reservation wins. This originates inside `@prisma/adapter-pg`, not an application `client.query`
call. Keep `pg` below 9 until the Prisma adapter is verified against pg 9, and rerun the concurrency
suite before either dependency is upgraded.
