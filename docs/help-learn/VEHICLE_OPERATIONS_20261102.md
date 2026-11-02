# Administrator vehicle operations checkpoint

Code published in `6f3cf203` with compatible production migrations, matching API/
worker images and the held-then-promoted frontend. Exact-source CI, isolated HTTP
role/audit checks and private full-catalogue retrieval passed. Actual signed-in
owner/Admin acceptance remains unavailable; no feature flag was changed. See the
backend report for separate synthetic, hosted and real production evidence.

vehicle-operations v1, reviewed 2 November 2026, remains backend-owned and private.
Its vehicle-admin gate requires verified current Admin/Super Admin access. Public,
Customer, Staff and unverified sessions cannot receive its body. This matches the
existing global vehicle-operations role boundary; ordinary Staff remain branch
scoped. No tutorial grants permissions or enables a feature flag.

Instructions distinguish stock records, draft listings, initial and changed asking
prices, document evidence review and publication prerequisites. New audit attribution
uses the authenticated User without creating employee profiles. Grouped NGN is
normalized exactly, never guessed from malformed grouping. MFA, current versions,
committed listing rules, owner controls and independent financial approval remain.

Acceptance covers eligibility across managed/legacy accounts and roles, denial of
owner/finance authority, exact grouped values, actual HTTP create/edit/price/document
operations on a new isolated database, stale/concurrent/expired access and audit
preservation. Publication and actual results belong in the backend change report.

Allie's navigation allowlist includes the existing vehicle-management route. The
catalogue remains the permission boundary: retrieval cannot reveal this article
to public, customer, Staff or unverified accounts. Full-catalogue retrieval checks
cover both administrators and the owner, including the permitted navigation action.

## Version 2 authoring follow-up

The reviewed source adds explicit View details and Edit details on each current
stock row. Edit details opens the existing specification editor without saving;
the header can reopen it. Record sections stay horizontal on laptop and scroll
locally when needed. Price, branch, review, current-version, uncertainty and
committed-listing checks remain authoritative. Eligibility and /admin/vehicles
are unchanged. Version 1 publication above is historical; version 2 awaits this
batch release. See docs/RECORD_AUTHORING_20261102.md for results and limitations.

Version 2 publication: runtime 9be4e66b and its matching ACTIVE backend are live.
All three exact-source gates and isolated learning HTTP acceptance pass; fresh
actual-account acceptance remains unavailable. See docs/RECORD_AUTHORING_20261102.md.
