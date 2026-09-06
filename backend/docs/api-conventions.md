# API conventions

All public HTTP contracts live under `/api/v1`. Route surfaces are separated into `/public`,
`/auth`, `/customers`, `/staff`, `/admin`, webhook, and internal-worker boundaries.

Responses contain `success`, `message`, optional `data`, and `meta.requestId`. Failures add a stable
`error.code` and may include field-level validation errors; they never return stack traces, rejected
credentials, provider payloads, or persistence details.

Browser sessions use the host-only opaque session cookie. The frontend must call `POST /auth/csrf`
after login or session rotation and submit the returned value in `X-CSRF-Token` for each authenticated
mutation. Verification and reset values belong in POST bodies. Frontend email links keep tokens in a
URL fragment so browsers do not send them to proxies, access logs, or referrers.

All input objects are strict allowlists. Unknown fields are rejected, including attempted role or
ownership assignment. Sensitive endpoints have route-specific rate limits in addition to the global
limit and PostgreSQL-backed authentication throttles.

Phase 3 adds cursor-paginated branch, staff, and customer-vehicle collections. Limits are bounded to
100 and cursors must identify a resource visible inside the caller's authorization scope. Staff and
administrator registration is invitation-only. Invitation tokens are submitted in POST bodies and
kept in frontend URL fragments.

Phase 4 catalogue reads live under `/public/catalog`; favourites and carts are customer-owned
resources; catalogue maintenance is under `/admin/catalog`; and inventory is under
`/staff/inventory` with creation under `/admin/inventory`. Monetary values cross the API as decimal
digit strings containing integer kobo. Stock movements and reservation changes require an
`Idempotency-Key`; the server stores only its HMAC and rejects reuse with a different request.

Phase 5 service discovery lives under `/public/services`, customer booking and quote decisions under
`/customers/bookings`, staff operations under `/staff/bookings`, and service administration under
`/admin/services`. Mutable service-operation resources require `expectedVersion` or
`expectedRevision`; stale values return `STALE_VERSION`. Updating quote lines returns a new quote ID
and version because previously stored quote rows and lines are retained as immutable history.

Phase 6 checkout lives at `/customers/orders/checkout` and requires `Idempotency-Key`. Customer
orders, promotion previews, and invoices remain under their `/customers` ownership boundary;
branch fulfilment and billing operations are under `/staff`; promotion administration and expiry
processing are under `/admin`. Checkout bodies never accept item prices, totals, discounts,
currencies, inventory balances, customer IDs, or invoice amounts. Order, promotion, and invoice
mutations use optimistic versions and return stable conflict codes for stale state.

Phase 7 public vehicle discovery lives under `/public/vehicles`; customer saves, inspections, and
sales are under `/customers`; vehicle inventory and sale operations are under `/staff`; reservation
expiry is under `/admin`. Price, customer, currency, branch, storage-key, and status-history fields
are server-owned. Reservation mutations require `Idempotency-Key` and optimistic versions.

Phase 8 customer payment intents, provider initialization/verification, and manual evidence are under
`/customers/payments`; branch-scoped review and refund requests are under `/staff/payments`; approval
decisions are under `/admin/payments`; and Paystack delivery uses `/webhooks/paystack`. The webhook is
the only JSON API surface parsed from exact raw bytes and does not use browser session or CSRF
authentication. Browser payment mutations still require the session cookie, CSRF header, and, where
applicable, `Idempotency-Key`. Provider signatures and server-owned financial values are authoritative.

The generated OpenAPI 3.1 contract is served at `/api/v1/openapi.json`, with Swagger UI at
`/api/v1/docs/`, when `API_DOCS_ENABLED=true`. Both are no-store resources. Documentation is enabled
by default outside production. Production startup rejects hosted documentation; release operators
share the private generated artifact in `docs/api/allied-autotech.openapi.json` through an approved
private channel. Runtime validation and OpenAPI request contracts use the same Zod schemas.
