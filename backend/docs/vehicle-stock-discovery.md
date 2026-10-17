# Vehicle stock discovery

`GET /staff/vehicles` remains a private, MFA-protected stock-record read. Customer
access is forbidden. Staff need an active assigned branch and cannot request a
different branch. Admin/Super Admin can read across branches, including historical
inactive branches. Acquisition cost and currency are omitted from Staff responses.
The stock index does not display acquisition costs for any role.

## Supported stock filters

- `search`: case-insensitive literal substring of stock number, make, model or VIN.
- `make`, `model`: case-insensitive exact literal matches.
- `year`, `branchId`: exact record facts, subject to Staff branch scope.
- `status`: a record containing any listing with that status. Other historical
  listings on the same record remain in the response.
- `listed=true`: at least one sale listing, including drafts/history.
- `listed=false`: no sale listings. Combining it with `status` returns 422.
- `limit`, UUID `cursor`: existing descending createdAt/id paging. The next cursor
  identifies the last returned row. No global count is provided.

Percent, underscore and backslash are escaped before PostgreSQL pattern matching.
The new `listed` filter is additive; existing stock routes and write contracts are
unchanged. Staff-router responses explicitly use `Cache-Control: private, no-store`.

The UI checks the current own profile before loading records, validates returned
identities/branch facts/listing prices and managed-image IDs, and rejects unexpected
Staff acquisition fields. Applied filters/cursors survive reload through the URL.
Temporary refresh failure retains labelled old facts with paging blocked; denied
reads remove them. Branch selection uses the existing administrator choices and a
direct read when a selected branch is outside the loaded choice page.

## Remaining query-contract gap

The existing staff query schema inherits public-discovery `bodyType`,
`transmission`, `fuelType`, `featured`, `minPriceKobo`, `maxPriceKobo` and `sort`.
The stock repository does not apply these parameters. They are not offered by this
index, and unsupported frontend URL parameters are rejected before fetching.

Backend follow-up: define record-level listing-price/featured/sort semantics when
several current/historical listings exist, then implement them consistently, or
introduce a reviewed stock-specific query contract that explicitly rejects
unsupported parameters. Preserve supported clients through a documented compatible
transition. Do not silently promise that accepted filters work. Add API cases for
each supported or explicitly rejected parameter, combined filters, multiple
listings, stable paging, branch scope and acquisition privacy; update OpenAPI and
regenerate client types together. This follow-up is distinct from the completed
filters listed above.

## Validation and release

Focused integration coverage is in
`tests/integration/vehicle-stock-discovery.test.ts`; production browser, contract
tests, native-concept fidelity and real API evidence are recorded in the
[frontend page report](../../frontend/docs/page-quality/work-vehicle-stock.md).
No schema, migration, grant change or data backfill is required. Deploy the
additive API behavior before the dependent index and verify the target environment.
Creation and vehicle detail are separate page gates.
