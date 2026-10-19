# Customer detail audit, gate 75

Route `/admin/customers/[customerId]`. Gate74 accepted the directory separately.
Existing administrator/MFA-protected direct summary and seven independent related
collections (garage, bookings, quotations, orders, payments, enquiries, complaints)
support this read-only view. Each collection also checks its domain permission.
Profile UUID scope, per-customer cursors, private no-store responses and minimal
READ audits are server-authoritative. No profile/status mutation route is offered.

Current issues: generic breadcrumb/back/header duplication, ungrouped contact and
address facts, in-memory activity selection/paging, horizontal mobile table and
generic date-only display. Related amounts convert strings through Number, losing
precision for large values. The detail parser does not require the requested UUID,
unique rows or cursor validity. Profile/related refresh failures are not independent
or consistently labelled, and denial must clear all protected activity as well as
profile facts. Missing/empty/failed collections must remain distinct.

Reuse accepted customer identity gate, strict row schema, exact money/time helpers,
URL/cursor operations, grouped panels, full-reference wrapping and actual route
navigation. Preserve address components/nulls without invented locations. Do not
invent activity/spending totals, purchases/invoices absent from the API, photos,
mutation controls or unsupported garage links. Existing22 API contract cases cover
direct/related projections, permissions, cursor isolation and privacy auditing.
