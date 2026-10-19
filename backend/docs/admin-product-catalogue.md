# Administrator product catalogue prerequisites

Reviewed 13 October 2026. ADM-06 and ADM-07 are implemented locally. The redesigned product page has passed its [separate local gate 56](../../frontend/docs/page-quality/work-products.md); target-environment acceptance remains pending. No schema or migration change is required.

## Direct administrator read — ADM-06

`GET /admin/catalog/products/{productId}` requires the existing Admin/Super Admin session and staff MFA assurance. It validates a UUID and rejects query parameters. Missing products return 404; responses use `Cache-Control: private, no-store`.

The response uses the existing administrator projection: product/category fields, string kobo prices, `updatedAt`, `mediaVersion`, safe image metadata, compatibility and active-branch availability booleans. It includes inactive products and categories independently of list paging. Raw inventory quantities/reservations and internal storage fields are not exposed. Reads create no audit event. Public discovery behavior is unchanged.

## Observed product update — ADM-07

`PATCH /admin/catalog/products/{productId}` accepts optional `expectedUpdatedAt`, a timestamp with timezone and millisecond precision copied from the administrator read. New editors must send it for every existing-product edit. The service acquires the existing product advisory lock and a PostgreSQL row lock before reading, comparing and updating the product. A mismatch returns 409 with no product change or audit. A successful catalogue edit advances `updatedAt` to at least one millisecond after its prior value, including successive writes within one clock millisecond or a previously future-dated timestamp.

Existing clients may omit the field and retain their previous behavior; those requests do not receive stale-snapshot protection. Their successful catalogue updates still invalidate older timestamp-bearing reviews. This additive compatibility phase does not claim that all deployed editors already send preconditions. No idempotency receipt or automatic replay is added. Product images retain their separate `mediaVersion` contract, and compatibility retains its existing child workflow.

The precondition is excluded from audit changedFields and cannot be the only submitted field. Current category activation, price/compare-price and active-reservation deactivation rules remain in force. CSRF and roles are unchanged. A transaction failure rolls back the update and audit together.

## Verification and database safety

The focused integration suite exercises direct active/inactive reads for Admin/Super Admin, safe media/availability projection, a record outside the first filtered page, strict query/ID validation, missing records, Staff/Customer/anonymous/MFA denial, CSRF, one audited write, stale/repeated snapshots, concurrent competing updates, monotonic timestamps, compatible older clients, malformed payloads, category activation and comparison-price constraints. The existing phase-four catalogue/cart/inventory and API boundary regressions run alongside it.

Tests run on newly created `allied_products_20261013_test` at `127.0.0.1:55440`, in the isolated local PostgreSQL 18 test cluster. The actual cluster and database target were verified before writes. All 58 migrations replayed via the supported empty-test-database workflow; `db:check` passed history/checksum/schema verification. Restricted runtime credentials own no relations and have no superuser, database/role creation, replication, bypass-RLS, schema CREATE or table TRUNCATE privilege. Provisioning grants apply only to this newly created test database. No application/shared/staging/production data or existing grants changed.

The first launcher run omitted `TEST_DB_NAME`; the harness selected its nonexistent default test database and the run failed without application writes. The launcher was corrected to pass both the verified DB name and TEST_DB_NAME. The added projection test required fixture corrections for mandatory branch address/city/state and for image source, which is derived rather than stored directly. The final fixture includes a synthetic internal publicId and asserts the exact safe response keys. No projection assertion was removed. Private logs are under `C:/Users/PC/.codex/work-products-*`.

The final run passed **20 tests**: 16 focused integration cases, one broad phase-four catalogue/cart/inventory flow and three API/contract boundary cases. Backend TypeScript, lint and build (including client generation) passed. OpenAPI export/validation and route coverage passed for 267 paths / 319 documented operations; generated frontend API types and frontend TypeScript passed. No frontend page acceptance is claimed by these checks.

## Release and remaining work

Deploy the additive API before the dependent frontend and verify the target environment. The accepted frontend uses direct reads, sends the observed timestamp, retains full mutation review and distinguishes stale conflicts from uncertain responses. Its report records 62 distinct browser cases, 40 unit cases, responsive/accessibility captures and real API/database creation/edit/media/recovery verification against a separate fresh isolated test database. Catalogue creation still needs manual reconciliation after uncertain delivery; an original-request receipt is optional future work (ADM-08). Product-detail design and verification remain a separate frontend milestone.

No backup/restore rehearsal, encrypted off-device recovery verification or shared/production deployment occurred. Follow [database safety](database-safety.md) for any release. Local integration acceptance does not establish the product-page or whole-application goal is complete.
