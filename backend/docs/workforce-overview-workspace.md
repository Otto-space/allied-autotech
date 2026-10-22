# Managed workforce overview

The existing `GET /staff/workforce/overview` now returns `counts`, `generatedAt`, its own current `access` snapshot and `branches` containing only `{ id, name }` for active assignments. The additions are backward-compatible for existing clients; release the compatible backend before the updated frontend. There is no new endpoint or database migration.

## Authorization and meaning

The existing workforce/access locks, authenticated active account, verified email, MFA, role/enrollment checks and assignment scope remain authoritative. Counts and branch projections use the authorized transaction's snapshot. This does not promise that independently changing operational tables form one simultaneous aggregate snapshot. Existing private/no-store behavior, empty-query validation and minimal successful READ audit remain.

Jobs, bookings and orders count all records in their respective permitted scope. Enquiries and complaints exclude RESOLVED and CLOSED. The accountant's FINANCE_READ permission provides a finance destination without an invented payment total. An enrolled account with no active assignments receives empty counts and branches. Only branch identifiers already present in the own-access projection and their names are added; there is no broader branch directory access.

The frontend validates known, safe nonnegative counters, exact permission/counter correspondence, unique complete assigned branches and assignment ownership. It compares the response's actor, staff identity, access version, active assignment IDs and privileges to the shell. Failed refreshes or mismatched access hide operational facts and links. Personal notification/security access remains available according to existing account authorization. Existing queue endpoints independently recheck permission when followed.

## Verification

Five API/database scenarios passed on `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`: nine managed identities including a revoked technician and managed Admin, finance-only access, empty revoked scope, weak MFA/suspended/customer/legacy denials, and forged query rejection. Eleven successful reads produced eleven READ audits. Original row hashes for accounts, staff profiles, branches, workforce access/assignments, bookings, orders, enquiries, complaints and all 652 policy versions were unchanged. All owned temporary sessions were removed. Runtime privileges were verified non-elevated, without database/table ownership or TRUNCATE privilege.

OpenAPI export/validation and route coverage passed with 313 paths and 367 operations. Frontend types and inventory were regenerated. This schema-free change reuses the prior 60-migration replay and db-check evidence; it does not claim a new migration replay, shared database check, backup verification, restore rehearsal or deployed acceptance. The [accepted page quality report](../../frontend/docs/page-quality/workforce-overview.md) records final browser, native visual, build and connected evidence.

Connected production Edge/Express/PostgreSQL verified Operations, Accountant and a revoked technician: actual branch names/counters, refresh, empty revoked state and navigation to permitted bookings/payment queues. Six overview reads and two queue reads produced eight READ audits. Own-access reads are not audited by that endpoint; the harness initially included them in its audit expectation, then corrected the expectation and repeated only these read flows. Neither pass sent business mutations. Final hashes for 15 domain tables were unchanged, all owned sessions were removed and no browser runtime errors occurred. Financial tables were empty; this does not establish populated financial preservation or real provider behavior.
