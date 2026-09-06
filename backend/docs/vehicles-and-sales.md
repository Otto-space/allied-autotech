# Vehicles and vehicle sales

Phase 7 separates physical vehicle inventory from the customer sales workflow. The vehicles module
owns stock records, listings, price history, media, private documents, condition reports, and saved
vehicles. The vehicle-sales module owns inspections, negotiations, reservation commitment,
transaction history, expiry, and handover.

## Route and authorization boundaries

- `/api/v1/public/vehicles` exposes only available listings at active branches. Public projections
  exclude VINs, chassis and registration numbers, acquisition costs, private document metadata,
  customer data, and storage keys.
- `/api/v1/customers/saved-vehicles`, `/vehicle-inspections`, and `/vehicle-transactions` derive
  ownership from the authenticated customer profile. Supplying another customer's identifier is not
  supported.
- `/api/v1/staff/vehicles`, `/vehicle-inspections`, and `/vehicle-transactions` require a fully
  MFA-assured privileged session. Staff access is restricted to the active branch in their profile;
  administrators may work across branches.
- `/api/v1/admin/vehicle-transactions/expire` is the bounded operational entry point for releasing
  expired commitments. Ordinary staff cannot invoke it.

All cookie-authenticated mutations require origin/fetch-metadata validation and a session-bound CSRF
token. Reservation retries additionally require an `Idempotency-Key`; only its HMAC is persisted.

## Lifecycle invariants

Listings follow `DRAFT -> AVAILABLE -> INACTIVE/ARCHIVED`; reservation and sale status are controlled
by their dedicated transaction workflows. A physical vehicle can have only one live listing. Price
changes lock the listing, require an optimistic version, and append an immutable price-history row.

Inspection and transaction changes use explicit transition maps and optimistic versions. The
reservation transaction locks the listing before the sale row, then updates both atomically. A
partial unique index is the final one-buyer backstop. Cancellation and expiry release the listing in
the same transaction. Buyer and monetary snapshots cannot change after a payment attempt exists.
Payment-pending status is reachable only after the customer reservation workflow has recorded terms
acceptance; staff cannot bypass customer acceptance through a generic status mutation.

Only a paid transaction can create a handover. Handover completion atomically marks the transaction
complete and the listing sold. Signed handover evidence becomes immutable once stored.

## Private asset handling

Production storage is a private S3-compatible bucket. Upload authorization uses a short-lived,
AES-GCM authenticated capability bound to the actor, vehicle, asset kind, MIME type, size, checksum,
and a server-generated random key. Confirmation verifies S3 metadata, SHA-256 checksum, and file
signature before committing the database reference.

Public listing images store an application URL and resolve to a short-lived inline signed URL only
while the listing remains available. Vehicle documents, condition reports, and handover evidence
never appear in public projections. Private downloads require branch authorization, CSRF, a
short-lived attachment URL, and an audit event. API responses never contain database object-key
fields.

Allowed uploads are JPEG, PNG, WebP, and PDF with kind-specific rules. Images are limited to 10 MiB;
all other Phase 7 assets are limited to 20 MiB. Filenames and client paths are never used as storage
keys.

## Operational checks

Run `npm run phase7:preflight` before applying Phase 7 indexes to an existing database. It reports
conflicting live listings, committed buyers, primary images, and reused private-object keys without
modifying data. Migration replay must still run against a newly created `_test` or `_ci` database.
