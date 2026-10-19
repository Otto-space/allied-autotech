# Workshop vehicle sales source audit

Preparation after milestone 71. This is not an acceptance report. Frontend route
`/admin/vehicle-sales` uses `GET /staff/vehicle-transactions`; individual records
are a separate route `/admin/vehicle-sales/[transactionId]` and separate gate.

Sources read: StaffVehicleSales, route, staff transaction schemas, transaction
projection/repository/service, customer purchase query/labels and relevant legacy
browser cases. The current index stores filters/cursors only in memory, starts
reads without its own verified profile, omits asking/reservation/creation/handover
facts and relies on a wide generic table. Preserve actual named transaction links
and existing APIs/role restrictions. This page has no mutation or creation form.

Staff are scoped to an active assigned branch; an explicit foreign branch filter
fails. Admin/Super Admin can read inactive historical branches. The existing
collection already has status/branch filters and stable createdAt/ID cursor
ordering. It exposes customer display name, stock identity, exact saved asking/
agreed/reservation amounts, lifecycle dates, version and handover state. No current
payment balance/paid sum/refund sum is included. Do not invent a ledger or imply
that purchase status proves current payment availability.

Implement a named breadcrumb/header, compact URL filters with explicit apply/
clear, reloadable cursor history, complete readable transaction records and
responsive labelled rows/cards. Reuse purchase status labels/query logic, current
own-profile gate, historical branch picker, cursor helpers, exact money and Lagos
date formatting. Gate reads, validate scope/status/IDs/money/dates/unique rows,
distinguish stale failure from empty results, remove private records on denial,
and preserve full names/references and direct detail/back paths.

Generate/inspect fresh desktop/mobile concepts and save a specification before UI
edits. Verify roles, supported filters/paging/reload/history, direct record links,
malformed/private data, seven widths/Axe and native fidelity. Use the existing
isolated database and production build cache; no migration or backend endpoint
change is currently assumed. Transaction mutation/detail controls remain separate.
