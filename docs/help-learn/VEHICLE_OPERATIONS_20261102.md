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
