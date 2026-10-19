# Workshop customer directory

The `/admin/customers` list uses the existing private administrator directory API.
Admin/Super Admin and verified MFA are required; Staff cannot browse. The frontend
additionally confirms the current active own-profile identity before loading records.
This gate adds no endpoint, permission, domain mutation, schema or migration.

Supported search fields: normalized full-name/last-name prefix, email prefix,
normalized phone prefix (>=3 digits), or complete customer profile UUID. Status,
email verification and newest/oldest registration sorting combine with search.
Name/email require >=2 characters and search is bounded at120. Literal SQL wildcard
characters are escaped. Search submits explicitly; typing does not create audited
directory requests. The UI fixes pages at25 records and persists filters/opaque
cursor history in the URL. Cursors bind the filter/sort snapshot and must not be
interpreted as profile UUIDs. Changing filters restarts paging.

Rows contain profile ID, name, email, phone, account status, independent email/phone
verification and registered time. No current spending/activity aggregates, portraits,
branch filters or status-management actions are supplied. The frontend preserves
full values and millisecond Lagos times. Detail/related collections are a separate
page gate and retain their existing authorization checks.

Collection/detail/related reads produce privacy READ audits containing collection
and result count, without contact/search text. Responses are private/no-store. The
frontend rejects malformed/duplicate/over-limit rows, filter mismatches and malformed
or repeated next cursors. Temporary refresh failures retain labelled old records with
paging blocked; access denial clears protected facts. No query/profile/contact data
is written into test result logs.

Existing directory API validation, cursor, wildcard, privacy and role tests were
reused. Fixtures run only after verifying actual isolated `_test` target and restricted
runtime credentials. No application/shared database, grant/schema/migration,
backup/restore, push or deployment operation is needed for this list. Existing
59-migration replay/db:check/privilege evidence remains applicable.

Deploy the list with the existing directory API and verify role/MFA boundaries,
privacy audit logging, filters/cursors, reload and named-detail/Back in the target.
No new backend implementation gap is identified by this list. Existing handover,
policy, finance, receipt and release gaps remain separate.
