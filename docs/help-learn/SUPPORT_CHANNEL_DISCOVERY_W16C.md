# W16C shared Care discovery, recovery and quiet reconciliation

Local continuation of [W16B](SUPPORT_CHANNEL_LIFECYCLE_W16B.md), in the existing
`allied-home-restoration-20261025` worktree. This is not production publication or
staffed live-chat acceptance. Migration 77 remains additive and unchanged from
its isolated replay. The full Revision 4 goal and 106 route decisions remain open.

## Implemented server behaviour

- Incoming channels are a bounded, permission-scoped view of existing Enquiries
  and Complaints. Filtering covers kind, active/queued/joined/ended state and branch.
  Metadata contains no contact information, message body or internal notes.
- Queue cursors bind current user, session, role, access revision and filters.
  Stable creation-time/ID positions survive a row closing or being reconciled.
  A short or empty page can have a continuation; it is not proof the queue is empty.
- Transfer candidates require separate case-assignment authority. Every candidate
  has current live/reply/view eligibility, branch coverage, opted-in session presence
  and shared capacity. Scans and result pages are bounded; signed continuations bind
  the channel revision and current access. A live duty alone never grants transfer.
- Actor/action receipt lookup recovers a saved operation without retaining its
  private transfer reason or original payload in the browser. Every outcome rechecks
  canonical ownership and current branch/action authority. Missing receipts remain
  unknown. Original-key replay does not imply the current channel state is unchanged.
- Explicit cancellation durably blocks an unsaved original request under the same
  receipt lock. A concurrently saved operation is preserved and reported as saved;
  no case, channel, audit or message is deleted. The old delayed body cannot create
  another action after a cancellation marker commits.
- The general worker now runs a bounded shared reconciliation scan every 30 seconds.
  It uses the existing database checkpoint, a nonblocking organization-access lock
  and stable positions. Quiet channels are revisited fairly across restarts. Lost
  presence/duty/session/coverage returns active channels to the same Care queue;
  a closed business case ends its channel. It does not silently close the case.
- Channel and case lookup expose only the latest customer-public message ID. Private
  internal-note anchors and message bodies are excluded. Existing scoped message
  endpoints remain the only transcript path.

## Native evidence

The final restricted-runtime HTTP/PostgreSQL run passed all 23 lifecycle and 13
discovery/recovery/worker tests, followed by schema, OpenAPI export/validation and
mounted-route checks. Its target is the task-owned newly created
`allied_w16c_discovery_20261028_45c46556f2e2_ci` on 127.0.0.1:63888. The runtime role
does not own tables and lacks schema/TRUNCATE or migration-ledger write privileges.
Fresh 77-migration replay and the earlier populated additive-forward evidence are
retained. The migration was not rewritten or applied to a shared database.

Earlier runs also passed the 20 availability cases, 38 existing creation/reply
receipt cases and 60 Care/session/handoff regressions. The later public-anchor
addition was checked by the final focused 36-case run; those earlier regression
suites were not all repeated for that additive field alone. No real provider call,
external delivery, customer message or production seed occurred.

Receipts and synthetic logs remain outside Git at
`%TEMP%/allied-w16c-discovery-20261028-db/`. The final `checks.json` records successful
completion. Browser/UI evidence is tracked separately below, not inferred from
native test success.

## Care UI continuation

Local components add channel request/join/transfer/end, reference-only reload
recovery, reviewed durable cancellation, visible status polling, an explicit
jump to a new public update, and a compact queue/availability disclosure in the
existing Care workspace. They preserve the canonical reply/internal-note forms,
drafts, manual notification-read actions and current permission checks. Presence
requires deliberate review; hidden/disconnected pages do not renew indefinitely.

The customer detail and legacy `/admin/support` workspace have rendered fixture
acceptance across all 13 new scenarios, using corrected reruns where required.
Customer widths are 390/1024px; legacy Staff/Admin/Super Admin are 360/768/1440px.
These cover reviewed requests for both case kinds, lost-acknowledgement recovery
after reload, durable cancellation, public-anchor jumps with drafts/unread state
preserved, reviewed join/transfer, explicit opt-in/withdrawal, disabled joining and
channel-access revocation. Axe found no violations in the five layout cases;
runtime-error/overlay checks passed in the accepted runs. The Super Admin fixture
also saved the transfer and verified its private reason did not enter public history.
Screenshots and JSON reports are in `%TEMP%/allied-w16-care-ui-20261028/`.

The first browser run had three passes and six failures: cold/load waits, a
development chunk reload during source edits, and an overly strict select-label
locator. The stable run then passed nine of eleven cases; its two incomplete
fixtures omitted a response envelope and valid CSRF setup. Four affected/polished
cases passed in the next run and the corrected availability case then passed.
Initial failed reports are preserved. An initial frontend unit run also had worker-
start timeouts under local memory pressure; its nonzero exit is not counted as a
passing check. A subsequent serial frontend run passed all 37 contract/timeline/
detail/scope unit cases. Final source results are recorded below.

Three existing browser regressions then passed: stale-record submission blocking,
unknown-reply recovery after reload, and reviewed internal-note single-flight saving.
The task preview on 3171 was stopped to release memory; other previews were retained.
The customer learning article is version 6 with the explicit queue/update/recovery
guidance; it does not promise staffing or a read receipt.

The final review reproduced a notice disappearing when an update was already on
the current page. Customer and staff notices now remain until explicitly opened.
Passive case/history refreshes preserve editor focus and drafts while review/send
remain locked until fresh checks finish. Pending, storage-error and rate-limit
locks are preserved. All three new polling/focus cases and all three existing Care
regressions passed together after that fix. Choosing the update focuses its timeline
entry; no notification read action is sent. The shared composer change is opt-in;
other consumers retain their previous locking behaviour.

Final local frontend types, scoped lint/format and backend types/full lint pass.
All 27 availability/help-guidance backend units pass; the intentional customer
article revision increase required its existing exact-version assertion to advance
to six. The secret guard passed all 3,421 non-ignored files. Production builds,
exact-source hosted CI, publication and the remaining journey work below are not
substituted by these local results.

## Remaining acceptance and release boundaries

- Complete exact-source release checks and publication when this bounded batch is
  committed. Extend
  the shared controls to responsibility-managed enquiry/complaint views and their
  actual permission subsets; legacy role fixtures do not prove those views.
  Verify actual browser/API composition; intercepted browser fixtures
  plus native HTTP tests do not establish an end-to-end hosted connection.
- Add the owner-only support-coverage editor and verify approved staffing/hours.
  Workshop hours are not support hours. No live enablement is authorized by a
  passing fixture or a signed-in administrator alone.
- Verify multi-instance reconciliation, load/backpressure, proxy/deploy reconnect,
  and the actual hosted worker heartbeat before live readiness. Review any future
  canonical case ownership/branch-rerouting workflow explicitly; current stale
  channel routing is rejected rather than silently reassigned.
- Follow the guarded migration/publication workflow, fresh backup and separate
  populated restore-and-forward rehearsal. Prepare a schema-77-compatible recovery
  composition before publishing this migration. Do not reverse database history.
- Retain the full route/responsibility and AI evaluation gates. The existing real
  provider evaluation call ceiling is exhausted; do not reset its ledger or make
  further paid calls without a new explicit bounded allowance.
