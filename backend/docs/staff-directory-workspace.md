# Staff directory workspace

Implemented locally on 18 October 2026. Compatible backend/frontend deployment and deployed acceptance remain pending.

## Contract

`GET /admin/staff` retains its current active, MFA-verified Admin/Super Admin boundary and privileged-account scope. Optional `q` accepts trimmed 2–100-character text without control characters. Email matching uses the complete query; name matching requires every whitespace-separated term in either first or last name, case-insensitively. SQL pattern characters `%`, `_` and backslash are escaped as literals. Existing role/status/branch filters combine with search.

Existing UUID cursor, ascending ID order and limit(default 25, maximum 100) remain authoritative. The response documents the actual safe user/profile/branch projection and optional next cursor; capabilities and credentials are excluded. Successful reads return `Cache-Control: private, no-store` and retain the atomic minimal STAFF_PROFILE READ audit with returned count. No schema, migration, grant or mutation change is required.

## Client behavior

The directory validates current own-profile identity/role/ACTIVE status before loading. URL filters and bounded cursor history support reload and Back/Previous. Strict response parsing checks safe fields, identity, order, role/status/branch scope, branch consistency and cursor boundaries. Search matching remains server authoritative. Recoverable refresh failure labels prior facts and disables paging; denial clears private records and links. Account detail and promotions/invitations are separate page gates.

## Evidence and limits

Two API/database cases passed against the verified isolated 127.0.0.1:55480 / allied_work_aftercare_20261017_test using restricted credentials. Twenty-eight additive synthetic accounts/profiles exercise search, wildcard escaping, full names, filters, pagination, audit/projection, invalid queries and authorization; existing users/profiles/capabilities were hash-checked and fixtures retained.

Connected production Edge/API/PostgreSQL passed server paging, reload, combined search/filters and actual account navigation. Eight directory reads matched eight READ audits; zero UI mutation requests and page errors occurred. All 470 users,317 profiles,47 capability grants and 122 branches remained unchanged; owned temporary sessions were removed. A test-only ambiguous Next selector was corrected before the successful read-only rerun, without recreating fixtures.

Frontend evidence includes 21 production browser cases, three units, responsive/accessibility checks and native visual inspection. Build, type, lint, OpenAPI generation and route coverage passed. Existing 60-migration evidence was reused. No application/shared database, schema, existing-grant, backup/restore, external provider or deployment operation ran. Large-directory search performance has not been load-tested. See the [page acceptance report](../../frontend/docs/page-quality/work-staff-directory.md).
