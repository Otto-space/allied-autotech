# Operational order detail availability

Locally verified 17 October 2026 with frontend [gate 61](../../frontend/docs/page-quality/work-order-detail.md).

`GET /api/v1/staff/orders/{orderId}` and successful
`POST /api/v1/staff/orders/{orderId}/status` now add `allowedTransitions`, an array
of currently usable next status values. Direct reads and status responses explicitly
use `Cache-Control: private, no-store`.

Availability follows the existing transition graph. Non-cancellation progress
requires `paidAt`. Pending orders may cancel; cancellation from Confirmed/Processing
also requires an approved cancellation request. Ready orders may complete; terminal
orders return an empty array. The response is an availability hint: the existing
mutation still independently checks role/MFA, active Staff branch, approved review,
payment, expected version and inventory rules inside its transaction. No policy or
database schema changed. Existing invoice data remains omitted for Staff.

The frontend validates this response, exposes only supplied transitions and checks a
fresh operational snapshot before posting an observed version with CSRF. A lost or
contradictory response locks the pending action; explicit saved-record reconciliation
cannot replay the mutation. The backend change is additive. Roll out the API first;
the corresponding frontend deliberately rejects a detail response without the new
availability field rather than guessing usable actions.

Eight integration/regression cases passed with the new detailed status/permission
matrix. Real browser/API/PostgreSQL verification separately passed two audited
changes, committed response loss and reload recovery, branch isolation, financial
projection and private cache headers. Frontend browser/visual/static evidence is
recorded in gate 61. OpenAPI/types export, validation, route coverage, lint and
typecheck passed. No shared-environment acceptance is claimed.

Verification used a fresh isolated `_test` database on loopback port 55480 after
identity/absence checks, the existing 58-migration empty replay and `db:check`.
Runtime credentials had no ownership, DDL, TRUNCATE or administrative privileges.
Synthetic domain records remain preserved. No application database write, schema
migration, backup/restore rehearsal or deployment occurred.

The separate original delivery-VAT breakdown contract remains a finance follow-up;
this endpoint currently exposes aggregate saved VAT. Do not infer a historical split
or change recorded amounts using current settings.
