# Inventory discovery and creation reconciliation

Local implementation — 17 October 2026. Frontend evidence is recorded in
[gate 63](../../frontend/docs/page-quality/work-inventory.md).

`GET /api/v1/staff/inventory` now accepts optional trimmed `search` text, 1–100
printable characters. It finds a case-insensitive literal substring of the recorded
product name or SKU, including inactive historical products/categories. Percent,
underscore and backslash are ordinary characters, not wildcard syntax. SQL uses
Prisma parameters and `strpos`, with the existing exact branch/product, low-stock,
UUID keyset and limit constraints. Search does not imply active catalogue eligibility.
Successful list responses explicitly use `Cache-Control: private, no-store`.

Staff remains restricted to its assigned active branch, regardless of a supplied
branch query. Administrators can read historical inactive branches. Authentication,
MFA, role checks, public catalogue eligibility and stock mutation rules are unchanged.
No endpoint, schema, migration or global count was added. Existing partial active
catalogue search indexes do not cover this full historical substring search; no
production-volume performance benchmark is claimed.

The inventory creation API already enforces a unique branch/product pair and creates
only an empty stock record. The frontend now checks current administrator access,
persists a minimal account-scoped branch/product marker before POST and validates the
returned pair and empty balances. Lost or contradictory responses preserve a reload
lock. Explicit reconciliation uses the existing exact branch/product list query and
never resends creation. A found record is described as an existing saved record;
the UI does not infer which request or administrator originally created it. Backend
uniqueness remains authoritative if another creation races with reconciliation.
Unreadable browser storage fails closed.

Ten distinct backend cases have passing evidence across inventory discovery,
phase-four integration/API boundaries and policy tests: nine passed initially; the
remaining validation case passed after its assertion was corrected from HTTP 400 to
the API's established 422 validation status. These cover literal search, inactive
records, case-insensitive SKU, stable paging, combined scope, low-stock equality,
Staff override/active-branch enforcement, invalid/repeated query values and denied
role/MFA/anonymous access, alongside existing inventory mutation regressions.

Real production-browser/Express/PostgreSQL verification passed reviewed creation,
cancel with zero POSTs, one audited empty record after committed response loss,
reload lock and explicit recovery without replay. Duplicate creation returned 409
without a second audit; Staff creation and Customer inventory reads were denied.
No physical stock, reservation or movement was created by inventory creation.
Backend typecheck/lint, regenerated OpenAPI/types, validation (269 paths) and route
coverage (322 operations) passed. Deploy the additive search contract before the
matching frontend and verify private caching and role/branch scope in the target.

Checks used only `allied_work_aftercare_20261017_test` on `127.0.0.1:55480`, created
for the preceding local gate. Actual target identity was checked before each helper's
writes. Its recorded 58-migration empty replay, db:check and restricted-runtime
verification were reused because no schema changed; they were not needlessly
repeated. Fixtures are additive and preserved; helpers remove only their own
synthetic sessions. No application/shared data or grants changed, and no migration,
backup operation, restore rehearsal or deployment occurred.
