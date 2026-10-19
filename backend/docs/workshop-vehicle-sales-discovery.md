# Workshop vehicle sales discovery

`/admin/vehicle-sales` uses the existing authenticated
`GET /staff/vehicle-transactions`. Status, branchId, UUID cursor and limit are the
supported filters. Ordering is createdAt/ID descending. Staff require an active
assigned branch and cannot query a foreign branch; Admin/Super Admin may include
historical inactive branches. MFA and private/no-store boundaries remain enforced
by the API. Collection reads do not create domain audits; individual privileged
detail reads create READ audits.

The collection provides transaction number, customer display name, stock/listing
identity, numeric version, exact recorded asking/agreed/required-reservation
amounts, creation/payment/reservation dates and handover state. Protected existing
stock thumbnails are available when supplied. Contact email/phone and acquisition
cost are absent from this projection. No current collected/refunded sum, payment
balance or payment eligibility is provided; purchase status and paidAt must not be
treated as that ledger. Current branch activity and a public listing's actual
availability are not guaranteed by a listing status alone.

The accepted index verifies current own identity/Staff assignment before reads,
validates unique records, scope, status, versions, exact integer-kobo amounts and
dates, and persists supported filters/cursor history in the URL. Temporary errors
retain factual records with paging disabled; denial clears protected records.
Malformed responses fail closed. Named transaction links continue into the
existing separate detail workflow. No mutation/creation action is added here.

Local verification is recorded in the
[frontend acceptance report](../../frontend/docs/page-quality/work-vehicle-sales.md).
No new backend gap, endpoint, permission, schema, migration or request-contract
change was identified for this index. Existing receipt/policy/payment/deployment
backlog items remain independent, and transaction detail has its own page gate.
