# Administrator dispute overview

`GET /admin/operations/payment-disputes` remains a read-only Admin/Super Admin
overview under the existing verified privileged session and workforce boundary.
Current active administrators can inspect it without `DISPUTE_MANAGE`; Staff,
Customer and anonymous callers cannot. The separate `/staff/disputes` handling API
requires a live `DISPUTE_MANAGE` capability even for administrators, and Staff must
also be assigned as primary or backup. The overview's handling destination now
follows that current capability rather than role alone. No grants were broadened.

Successful overview responses now explicitly set `Cache-Control: private, no-store`.
Existing safe selection, successful minimal queue READ audit, strict status/category/
UUID-cursor filters and bounded limit (1–100/default25) are preserved. Records are
ordered by opened time and ID descending. Copy `nextCursor` unchanged; it is the
last returned record's UUID. Paging is live, not a frozen snapshot.

Amounts remain exact decimal kobo strings in NGN. A nullable confirmed chargeback
is distinct from the disputed amount. Evidence availability describes the recorded
application metadata and does not prove upload bytes, submission or provider
acceptance. Raw evidence keys/checksums and private source reasons are excluded.
Provider observation status, resolution, review warning and update time remain
distinct from canonical dispute state and confirmed accounting.

No new route, mutation, schema, migration or durable operation receipt is needed for
this read-only overview. Evidence assignment, preparation/access and provider receipt
recording remain in the separate work queue; this gate does not verify that workflow
or external provider/storage delivery.

Two isolated API/database scenarios passed for private safe/audited paging, validation,
role/MFA boundaries and unchanged existing financial rows. Twenty-six synthetic
disputes were added only to the confirmed restricted local test target
`127.0.0.1:55480`, `allied_work_aftercare_20261017_test`, to support actual25+1 paging.
No pre-existing disputes were present in this target. Synthetic fixture rows are
retained; cleanup removes only owned temporary sessions.

Connected production Edge/API/PostgreSQL verified Admin and Super Admin inspection,
actual25+1 paging/reload/Previous, disclosure without another request, capability-bound
handling navigation and Staff/Customer/anonymous API boundaries. It made zero UI
POSTs, five overview GETs and five READ audits, preserved all26 fixture disputes and
all38 payments/38 attempts/31 refunds/37 invoices/eight ledger rows, and left zero
temporary sessions. It performed no external provider or storage operation.

Existing60-migration compatibility evidence was reused. No application/shared database,
schema/migration, grant, backup/restore or deployment operation ran. Off-device backups
and a restore rehearsal were not checked by this local read-only page gate.
