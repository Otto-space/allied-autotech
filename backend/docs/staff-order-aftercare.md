# Operational aftercare recovery and branch scope

Locally verified 17 October 2026 with frontend
[gate 62](../../frontend/docs/page-quality/work-aftercare.md).

`GET /api/v1/staff/order-requests/{id}` returns the existing full Staff aftercare
projection for one saved request. It permits explicit recovery when a pending review
has fallen outside the latest-100 order history. Authentication, staff/MFA checks and
the request's order/branch authorisation apply. Missing requests return 404; the read
does not repeat or mutate a review. Responses use `Cache-Control: private, no-store`.
The frontend also verifies that the returned request belongs to its current order.

Staff history, direct request reads, review and evidence now consistently require an
assigned, matching **active** branch. Administrator historical access remains
available. History and successful review/evidence responses explicitly use private
no-store headers. Customer history also uses private no-store headers. Review stages,
live financial approval grants, expected-status conflicts, fee/condition validation,
one-time evidence, CSRF and audit behaviour remain enforced by the existing services.
Approval does not cancel an order, change inventory or execute a refund.

The frontend rechecks current order/history/profile before POST and persists a
minimal pending marker first. Lost or contradictory responses block further writes,
including through reload. Explicit reconciliation reads current saved records,
including this direct endpoint for a pending review; it never replays a mutation.
Latest-100 history remains a bounded list, not a new historical browsing contract.

Eight integration/regression cases passed, including direct access outside recent
history, private headers, customer/unassigned/no-MFA/anonymous rejection and inactive
Staff branch denial for reads and writes without domain mutation. Real browser/API/
PostgreSQL verification passed receipt, inspection, approved fee, four audited
actions, cancel with zero writes, committed-response loss/reload reconciliation for
review and evidence without replay, unchanged stock/order/payment and customer
denial. Frontend browser/visual/static evidence is recorded in gate 62. OpenAPI/types,
269-path validation, 322-operation route coverage, lint and typecheck passed.

Deploy the additive backend endpoint before the corresponding frontend. No schema
or policy change is required. Target-environment role, branch, recovery and private
cache behaviour still need deployed acceptance.

Verification used fresh isolated `allied_work_aftercare_20261017_test` on loopback
port 55480, after target identity/absence checks. Existing 58-migration empty replay
and `db:check` passed. Restricted runtime credentials had no ownership, DDL, TRUNCATE
or administrative privileges. Synthetic domain fixtures are preserved. No shared
database change, backup/restore rehearsal or deployment occurred.
