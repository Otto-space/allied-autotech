# Support conversation events

Status changes, replies and internal notes share one chronological timeline with
distinct labels, icons and presentation in customer, admin, Super Admin and managed
staff conversation views.

- **Status update:** records the previous and new status and the customer-visible
  explanation. Every successful transition produces one event, including transitions
  without an explanation. Resolution still requires an explanation. The status,
  event, audit and notification commit together; stale transitions create no event.
- **Reply:** an ordinary customer or staff message. Both staff reply implementations
  create customer notifications when the conversation belongs to a customer account.
- **Internal note:** only available to authorised staff. Customer history queries and
  entry selectors exclude it, and customer components also refuse to render it.
- **Historical message:** existing messages retain their body, author, visibility,
  timestamp and identifier. They receive `LEGACY` as the compatible column default;
  their purpose is not inferred from text or timestamps. Historical internal notes
  retain their existing private visibility.

Staff buttons identify the action: Review/Confirm status change, assignment change
or priority change; Review reply/Send reply; Review internal note/Save internal note.

New customer notifications use distinct titles, store the exact support message
identifier, and open that entry even beyond the first page of history. The selected
entry receives keyboard focus and a visible outline. View full conversation returns
to the beginning. Notification destinations stay on allowlisted application routes;
the backend rechecks conversation ownership and entry visibility. Older notifications
without an entry reference still open their related conversation.

## Storage and rollout

`20261022110000_support_timeline_events` adds an event-kind enum, previous/new status
columns and a nullable notification-to-message reference. It adds integrity checks
and a foreign key without deleting or rewriting historical messages. Existing
append-only message protections and body-length rules remain in force. A status
event without an explanation stores “No additional explanation was provided.”

Deploy the additive migration through `npm run db:migrate` before the matching API
and worker images, followed by the frontend. Old API instances can still insert
legacy messages during a rolling deployment. The new frontend accepts older API
responses without event metadata. A full release requires the repository's backup,
isolated restore rehearsal, migration history and target `db:check` safeguards.

Git attributes preserve the established CRLF checkout bytes for all migration SQL
on every OS, matching the checksums verified against production. No applied SQL
was edited or migration-history checksum changed.

## Verification

- Empty PostgreSQL replay: all 61 migrations passed in a newly created isolated
  `allied_support_timeline_20261022_ci` database on `127.0.0.1:50768`.
- Restricted-role database check passed; tests do not use an application database.
- Five HTTP/database scenarios cover event storage, empty explanations, duplicate
  transitions, resolution history, private/foreign entry rejection, long-history
  links, legacy messages, invalid event shapes, managed staff projections and reply
  notifications for enquiries and complaints.
- 390 backend unit tests and 44 focused frontend unit tests passed.
- Backend types/lint, OpenAPI/route checks, frontend types and lint of changed files
  passed. Full-repository frontend lint was stopped after running slowly; the
  focused lint completed successfully.

- Production frontend build passed. Three existing browser regression tests also passed:
  internal-note cancellation/single submission, reviewed resolution and closure preflight.
- Seven browser scenarios passed: customer notification to exact entry and full history
  at 390px and 1440px; admin, Super Admin and staff status confirmations; managed
  enquiry and complaint history. Customer axe accessibility checks found no violations,
  no horizontal overflow or runtime page errors. Screenshots were inspected.
- Fresh production backup restored to a separate newly created database
  `allied_support_timeline_restore_20261022_test` on `127.0.0.1:50768`.
  Guarded migration rehearsal passed from 60 to 61 migrations; original-column
  hashes and row counts were unchanged across 84 tables (196 rows).
- Production inspection verified strict TLS, 60 matching migration checksums,
  exactly the expected pending migration, six managed backups and restricted runtime
  privileges. The temporary operator firewall rule was removed after backup.

Production rollout is pending. Browser tests used synthetic accounts;
no real customer account or owner MFA session was used.
