# Workshop customer detail

The administrator page `/admin/customers/[customerId]` uses the existing private
summary and seven related collection APIs. Admin/Super Admin plus verified MFA
are required, and each collection also checks its domain authorization. The frontend
confirms the active own profile and requested customer UUID. Staff cannot browse.
This page offers no profile/status mutation and requires no new endpoint/schema.

Summary projection: profile ID, names, contact values, account status, independent
email/phone verification, registration time and address/city/state/country. No
postal code, coordinates, address-line2, account classification, branch, portrait
or lifetime spend/activity totals are returned; the UI does not invent them.

Independent collections: vehicles (Garage), bookings, quotations, orders, payments,
enquiries and complaints. Related rows contain ID, title, nullable status, creation
time, nullable amountKobo/currency. List pages are fixed at25, UUID cursors are scoped
to the requested customer/collection, and URL collection/cursor/trail survives reload
and Back. This cursor differs from the directory's opaque filter-bound cursor.
Unrecognized/duplicate URL state stops collection reads. Failed collection reads
never become an empty account or missing customer.

The frontend preserves full references and millisecond Lagos times. NGN decimal
strings are formatted through BigInt, preserving large values and zero; unknown/
non-NGN currencies remain explicit minor-unit values without assuming the NGN
denomination. Only actual booking/order/support detail routes are linked. Garage,
quotation and payment rows do not invent individual administrator routes.

Summary and activity refreshes remain independent. Temporary summary failure
retains labelled account facts and blocks activity; denial removes summary/activity.
Activity failure/denial affects only its own records, preserving readable summary.
Strict requested identity, complete dates/amounts, bounded unique rows and cursor
validation fail closed. Private no-store headers, MFA, current authorization and
minimal collection/result-count READ audits remain server-authoritative.

Existing directory API tests cover summary/related permissions, projections, cursor
isolation and privacy auditing. Focused UI/helper checks add exact formatting,
URL state, failure isolation and responsive facts. The connected browser workflow
uses only new/preserved synthetic fixtures after asserting actual isolated `_test`
host/port/database/environment and existing restricted credentials. No application/
shared database, schema, migration, grant, backup/restore, push or deployment change
is required. Existing59 migration replay/db:check/privilege evidence is reused.

No new backend implementation gap is identified. Deploy with the existing directory
API and verify actual MFA/roles, private responses/audits, independent cursors,
reload/Back and exact returned string amounts. Customer support conversations,
privacy review, moderation, finance and deployed/application-wide acceptance remain
separate gates.
