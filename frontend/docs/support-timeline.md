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

The release also retains the previously deployed support email delivery, workflow
progress and dashboard spacing changes (through `7354337`). The shared support
email service creates one in-app notification and one email outbox intent per
customer-visible update. Timeline integration tests verify that internal notes
create neither, and that the generic notification delivery path does not duplicate
support emails. The existing encrypted email payload remains compatible with the
previous worker during rollout. After merging, backend types/lint, OpenAPI checks,
24 focused backend tests and all five HTTP/database scenarios passed again.

The additive production migration completed through the guarded runner at
2026-10-22 10:12 UTC, with target `db:check`, restricted role verification and removal
of the temporary operator firewall rule. No second migration is required for the
merged application release because its Prisma schema and migrations are identical.

## Live release ? 22 October 2026

Application source `5d54211b56142837ca30ae74092f388af3580d0b` is deployed on
`https://alliedautotech.com` and `https://api.alliedautotech.com`:

- DigitalOcean deployment `8cb36e20-5140-447e-baca-6ff1fb7360a0` is ACTIVE;
  all four component image digests match the clean source release manifest.
- Vercel deployment `dpl_BF9NNyZf4ZJqzUWCdRm9DPFUpv17` is READY and was
  promoted to the actual domain only after the backend became active.
- At 10:31 UTC, provider identity checks confirmed both releases use that commit.
  Hosted checks passed for API liveness/readiness, served timeline and notification
  badge CSS, the support entry URL, private access and unauthenticated API rejection.
- The final merged build passed the seven timeline browser scenarios again and
  both existing support progress/email delivery scenarios at 390px and 1440px.
  Frontend production build, focused lint and the 2,862-file secret guard passed.
- Guarded production migration and target `db:check` passed with 61 migrations.
  The fresh backup/isolated restore rehearsal above preserved existing rows and
  original-column hashes. Managed encrypted off-device backups, seven-day retention
  and PITR configuration were verified using the existing provider evidence and
  current backup availability. The temporary operator firewall rule was removed.

Private deployment, image, migration, restore and hosted-check receipts are retained
under the existing protected operations evidence directory. Existing support email
and progress behavior and the newer dashboard spacing are included. Private access
and the enquiry-only launch restrictions remain enabled.

Browser tests used synthetic accounts; no real customer account or owner MFA session
was used. Hosted route/asset checks do not replace an authenticated owner acceptance
session or establish that an email reached a recipient's inbox.
