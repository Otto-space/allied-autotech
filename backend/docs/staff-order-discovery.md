# Staff order discovery

Locally verified 17 October 2026 with frontend [gate 60](../../frontend/docs/page-quality/work-orders.md).

`GET /api/v1/staff/orders` accepts an optional `orderNumber` query value, trimmed and
matched by case-sensitive equality. It must contain 1–120 characters and no control
characters. This is a full reference lookup, not prefix or customer-text search.
Existing branch, customer, status, limit and cursor parameters remain compatible.
The query uses the existing unique `Order.orderNumber` index; no migration is added.

Staff require MFA and an assigned active branch. That branch takes precedence over
a supplied branch filter. Admin/Super Admin retain authorised cross-branch filtering,
including historical inactive branches. Customers and anonymous callers are denied.
Staff responses omit invoice data. Successful list responses now explicitly set
`Cache-Control: private, no-store`.

The new integration suite checks lookup beyond the first 25 rows, cursor continuation,
exact case, trimming, combinations with status/customer/branch, foreign-branch
isolation, administrator access, invoice projection, denied actors and malformed
queries. Seven cases passed with existing transaction-flow and API-boundary
regressions. A real production-browser/Express/database run separately checked
25+3 paging, URL reload, inactive branches, customer scope and Staff boundaries.
OpenAPI/types export, 268-path validation, 321-operation coverage, lint and typecheck
passed. Source tests are `tests/integration/staff-order-discovery.test.ts`.

Verification used only the newly created loopback database
`allied_work_orders_20261017_test` on port 55480 after identity/absence checks.
The existing 58-migration empty replay and `db:check` passed. Runtime credentials
were separately verified without table ownership, schema modification, TRUNCATE or
administrator privileges. Domain fixtures remain preserved. No shared database
write, backup/restore rehearsal or deployment was performed. Deployment acceptance
remains open; this report does not certify production recoverability.
