# Administrator invoice discovery and draft creation

Administrator and Super Admin sessions with verified MFA may read these routes.
Staff and customer sessions are denied independently of frontend visibility.

`GET /api/v1/staff/invoices` retains status, customer profile UUID, branch UUID and
newest-first cursor paging. It also accepts a literal, case-sensitive exact
`invoiceNumber`, `sourceType` (`ORDER`, `BOOKING`, `VEHICLE_TRANSACTION`) and an optional
exact `sourceId`. A source UUID requires its type. Unknown query fields are rejected.
Historical records remain discoverable through inactive branches.

`GET /api/v1/staff/invoices/sources` requires `sourceType`. Optional `search` accepts
a literal case-insensitive prefix of an order number, service name, transaction
number or vehicle listing title, or an exact source UUID. Prefixes require two
characters. `%`, `_` and backslashes have literal meaning. Optional exact `sourceId`
resolves an off-page selection independently of the collection cursor. Cursor/limit
rules remain 25 records by default, with a maximum of 100.

Source choices contain only `id`, `sourceType`, operational `reference`, `label`,
minimal branch identity and `createdAt`/`updatedAt`. They omit customer contact
information, prices, documents, notes and policy settings. Orders must not be
cancelled; bookings require an accepted quote and must not be cancelled; vehicle
purchases require a linked customer, an agreed price and an invoiceable status.
All three exclude sources with an existing invoice. The creation transaction
remains the final authority for eligibility, approved policy and pricing.

Staff list, source and detail responses use `Cache-Control: private, no-store`.
Collection READ audits retain actor/request context and collection/result count;
source reads also retain the source type. Search text, customer references and
returned row contents are not copied into collection audit values.

`POST /api/v1/staff/invoices` continues to accept only source type, source UUID and
an optional future ISO due timestamp. Verified MFA and CSRF are required. Existing
server calculations, booking deposit/refund rules, source advisory lock, unique
source relations, document/policy snapshots and atomic CREATE audit are preserved.
Creating a draft neither issues an invoice nor creates a payment. Issuing, voiding
and private documents retain their existing separate detail routes.

The frontend stores a minimal account/role-bound pending marker before dispatch and
validates the returned draft's exact source, branch, due instant, lifecycle and
financial arithmetic. An uncertain result survives reload and is never replayed.
An explicit source-filtered GET can show the current invoice; it cannot establish
which request created it or prove that a still-running request failed. Redacted
markers require independent reconciliation. Clearing a browser draft does not
cancel a server request. Durable original-request receipts remain a separate gap.

Six integration scenarios passed against the guarded isolated test database:
minimal 25+3 source paging/exact restoration; literal search and eligibility; role,
MFA, strict-query and CSRF boundaries; exact invoice discovery and private audits;
server-priced drafts for all three source types; and simultaneous creation yielding
one invoice and one CREATE audit. No schema, migration or grant change is required.
Frontend production and connected-browser acceptance are recorded in
[gate 81](../../frontend/docs/page-quality/work-invoices.md).
