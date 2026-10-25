# Notification experience — 25 October 2026

Scope: notifications only. Source starts at frontend release receipt `0253a651`
(runtime `e9f48ef5`) combined with current backend `ff42b0e2`. Reused the clean
home-restoration worktree on `feat/notifications-experience-20261025`; the preferred
Home and audit fixes are retained. The released Shop/Vehicles R2 source `71d3f60d`
was merged as `628d6add` after independently checking the current hosted releases.
Its catalogue/enquiry changes and 70-migration history are retained. Other
worktrees and the main checkout's unrelated edits remain separate and preserved.
No publication, real messages, production roles or production fixture writes.

## Contracts and acceptance cases established before implementation

| Boundary       | Required fixture outcome                                                                                                                                                                    | Initial finding                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Personal inbox | Customer `/dashboard/notifications`; STAFF/ADMIN/SUPER_ADMIN `/admin/notifications`, authenticated own records only                                                                         | Existing shared account inbox and exact workforce endpoint exception               |
| Responsibility | Mechanical/electrical technicians, workshop lead, sales supervisor/cashier, accountant, customer service and executive; current assigned/branch/delegated grants, never position title      | Existing workforce policy and recipient fixtures; verify revoked access            |
| Private source | Missing/revoked source has generic unavailable text and no resource identifiers/destination; raw historical content never returned                                                          | Target is checked but original payload is still returned: fix                      |
| Read state     | GET/render/preview no writes; explicit read/unread idempotent, CSRF/ownership checks, no business mutation                                                                                  | Read exists; unread missing                                                        |
| Bulk           | Whole owned inbox through one server timestamp; later arrivals stay unread; response includes cutoff; expired rows may be dismissed                                                         | Existing whole-account update has no explicit cutoff                               |
| Badge/preview  | Global summary independent of filters/page; safe recent preview, capped visual/full accessible count; keyboard dismissal/focus restoration; no insertion while open                         | Badge correct; preview missing                                                     |
| Reconciliation | Local/other-tab read changes refresh without private broadcasts; hidden/offline polling paused; session switch clears private state                                                         | Existing summary broadcast/polling; inbox needs reconciliation                     |
| Settings       | Focused inbox plus full-width settings disclosure; explicit reviewed saves and unknown-result recovery preserved; honest defaults/channel capabilities/marketing consent                    | Long narrow sidebar and technical labels                                           |
| Device         | Unsupported/default/granted/denied/revoked/offline/unconfigured distinguishable; no permission prompt on mount; enabled requires local permission/subscription AND confirmed server binding | Existing UI uses OR and does not reconcile revoked permission                      |
| Push           | Existing genuine service worker/outbox, generic IDs-only payload, session-bound subscription, logout cleanup, bounded retries/410 retirement; no foreground polling presented as push       | Existing implementation; real-device/configured delivery not yet verified          |
| Delivery       | Trusted producers + transactional dedup/outbox; delayed opt-out respected; provider failure cannot fail domain transaction; disabled channels do not retry forever                          | Existing delivery worker rechecks opt-out; disabled provider retries unnecessarily |

## Event / recipient / channel inspection

| Producer                                             | Recipient and access                                                                                                                                                                                      | Existing optional channels                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Support reply/status/acknowledgement                 | Owned linked customer; internal notes excluded by customer-email layer                                                                                                                                    | Operational email; guest support email uses separate encrypted outbox              |
| Support created/customer reply/assignment            | Current branch/responsibility or assigned recipient; actor excluded; dedup per persisted event/recipient                                                                                                  | Assigned reply email only; generic team text                                       |
| Workforce job assignment                             | Assigned technician from persisted work event                                                                                                                                                             | Inbox; inspect existing job producer                                               |
| Booking/quotation/work order lifecycle and reminders | Owning customer from persisted booking                                                                                                                                                                    | Existing selected EMAIL/SMS rules; no blanket category policy change               |
| Payments/refunds/expiry                              | Owner/approved operational recipients; release capabilities retained                                                                                                                                      | Existing transactional channel selection                                           |
| Operational alert worker                             | Existing explicit alert eligibility, not every administrator                                                                                                                                              | Existing worker policy                                                             |
| Account/security                                     | Password reset, password change and MFA-method removal now also persist a deduplicated SECURITY inbox event inside the existing identity transaction; trusted persisted IDs/timestamps, no secret content | Existing required identity email policy retained; no new email/SMS category policy |

These contracts were established before implementation. The actual implementation
and verification checkpoint follow. All fixtures remain isolated; no claim of
real authenticated production/device/provider acceptance.
Browser plugin not available; use installed Edge with existing Playwright.

## Implemented contract and release notes

One shared Notifications workspace serves `/dashboard/notifications` and
`/admin/notifications`, including represented managed-workforce scopes. The inbox
is the default; delivery/device settings are deliberately disclosed above it.
Readable labels, All/Unread filters, optional technical filters, explicit read and
unread controls, whole-account bulk scope, recovery, pagination and Lagos dates
are retained together. Customer Help is inline so floating controls do not cover
notification actions. Shared typography and unrelated business pages are unchanged.

The header preview uses the authoritative global summary rather than counting its
five displayed rows. It never marks rows read, freezes its displayed row set while
open, retains the updated global count, supports keyboard/Escape/outside dismissal
and restores focus. Foreground status uses the existing bounded polling and
account-scoped broadcasts, pauses hidden/offline, and reconciles on return. No
sound or redundant native/toast alert stream was introduced. Routine action
feedback stays temporary; not every successful button click becomes an inbox event.

Access is re-evaluated when projecting source references. Revoked/missing sources
become generic dismissible rows without their old title/message, resource IDs or
destination. Stored history is preserved. Summary groups also suppress private
source classification while preserving the current account's unread total.
Internal support notes remain excluded. Source-record pages require an explicit
"Mark displayed updates as read" action; rendering/scrolling never writes read
state, steals focus, or completes a business action. Limited-release historical
commerce notices retain a permitted Contact fallback without enabling commerce.

Compatible additive API changes: POST `/:notificationId/unread` on both existing
customer/staff routers; optional delivery-channel availability in preferences;
the existing bulk response adds one server `cutoff`. Individual updates are
idempotent; bulk excludes arrivals after that cutoff. Authentication, ownership,
MFA, CSRF and exact managed-workforce endpoint boundaries remain enforced. All
notification responses are private/no-store. OpenAPI and generated frontend types
are regenerated from the combined released source. This notification work adds
no schema migration; the merged existing 70 migrations were replayed separately.

Browser "on" requires permission, a native local subscription AND confirmed
server binding to that exact endpoint fingerprint. The additive `endpointHashes`
push-status field exposes only this account/session's saved endpoint hashes, never
raw endpoints/keys. A renewed local endpoint cannot be confused with an older
saved binding. Missing hash confirmation fails closed and offers reconnection.
Unsupported, unconfigured, blocked, missing/expired subscription,
offline and registration failures are distinct; no permission prompt runs on
mount. Device-off does not revoke the origin's OS/browser permission or another
session's subscription. Failed registration cleans its tentative subscription.

The existing Web Push worker adds the subscription endpoint SHA-256 fingerprint
to the minimal generic payload. Release the compatible API and worker **before**
the new service worker/frontend: old clients ignore the extra fields, while the new
client rejects missing/mismatched fingerprints and retired endpoints. No private
key reaches the browser. Bounded opaque-ID IndexedDB receipts suppress simultaneous
and replayed native alerts across worker restarts; native display failure releases
its receipt for a later retry. The stable native tag is a storage-failure fallback,
not an exactly-once guarantee. Clicks only focus/open a validated inbox URL.

The existing delivery outbox, current preference checks, bounded retries and
permanent-endpoint retirement are retained. A now-disabled EMAIL/SMS provider is
terminal `CHANNEL_DISABLED` rather than consuming all retries. Read state and
delivery state remain separate. Marketing execution is still disabled; existing
deliberate future-preference consent remains clearly labelled.

## Verification checkpoint after released-source integration

- All 70 migrations replayed on new isolated loopback database
  `allied_notifications_20261025_b5787eefbccb_ci`; history/schema `db:check` passed.
  The actual native PostgreSQL host/port/data directory were checked before writes.
  A task-specific non-owner runtime role has DML only, no DDL/TRUNCATE/admin rights;
  no shared/production database, grant or application record was changed.
- Backend: 477/477 unit tests; 42/42 notification/context/preference/retry/identity
  integration checks, 5/5 fake-provider push cases (including current-endpoint and
  separate-device preservation) and 4/4 ownership/summary cases.
  TypeScript, lint, formatting, secret guard and 410-operation route coverage passed.
  OpenAPI validates 350 paths. These counts are the post-merge checks, not added
  together with the earlier partial runs.
- Frontend: 1,018/1,018 unit tests. Final rendered regression and build/check
  outcomes are recorded below when their running stages finish.
- Desktop/mobile populated fixture inbox, preview and settings screenshots were
  inspected. Synthetic fixture records remain outside production. Original
  before-state screenshots were unavailable while preview startup was blocked;
  do not mislabel these after captures as baseline evidence.
- Native transport probe: isolated headless Microsoft Edge 156.0.4314.42 supported
  ServiceWorker/PushManager and reported notification permission granted, but
  native subscription failed with `AbortError` ("Registration failed - permission denied").
  No provider send occurred. The ephemeral registration/profile were
  cleaned and browser closed. Fake-provider and browser-handler logic passes do
  **not** establish genuine background delivery or OS-alert click acceptance.
  An actual supported device/browser/provider delivery-and-click check remains.
- Read-only live configuration inspection found existing API/general-worker Web
  Push enabled with VAPID keys present; identity worker push is disabled as expected.
  Email is enabled, SMS disabled. No credential/configuration values were printed
  or changed. Therefore do not describe missing production VAPID setup as the blocker.

Evidence: `%TEMP%/allied-notifications-final-20261025/` (fresh migration, database,
integration, native-probe and final browser receipts) and
`%TEMP%/allied-notifications-cycle-20261025/` (role/width screenshots). Frontend
unit/lint/format logs use `%TEMP%/allied-notifications-final-frontend-*.log`.
The original interrupted 145-case browser attempt is not a completed passing run.

Disk continuity: when C: fell below 20 GiB the owned browser run was stopped and
substantial writes paused. Automatic review rejected the later owner-approved
1.94 GiB cleanup batch; no retry through another tool was used. The owner separately
completed CapCut's registered uninstaller; app/registry removal and approximately
5 GiB host recovery were verified, leaving 21.16 GiB at the resumed 1 GiB preflight.
Chrome and its AI model were left untouched. No project source, Codex history,
database/backup, Docker image/volume or current/rollback release was deleted.

Final rendered checkpoint: 155 distinct browser scenarios have passing latest
outcomes across the recorded runs; this is not one clean full-suite run. The
147-case run first passed 143: one cold development redirect exceeded its wait and
passed unchanged on recheck; three old workforce assertions omitted the existing
Fitment link. Assertions were corrected only for the three already eligible
templates; all eight workforce scopes then passed. Nine focused context/focus/
doubled-text/reduced-motion cases passed, including seven permitted source-record
journeys. All four roles' 390/1440 inbox/preview/settings captures were refreshed
in an eight-case passing run. Restricted full-mode customer commerce context pages
remain inaccessible in the current browse/enquiries preview and were not counted
as passing. Physical-device zoom and full screen-reader speech remain unsampled.

Final device correction: push-status now returns only the current account/session's
endpoint hashes. A saved binding for an older endpoint cannot make the renewed
local subscription appear enabled. Six focused device tests passed after this
correction, including actual SHA-256 comparison and no repeated permission prompt;
five isolated push API/worker cases passed, including endpoint renewal and keeping
another session's device enabled. The earlier full frontend suite passed 1,018;
the six-case focused recheck includes one newly added regression (not 1,024 distinct
tests). Frontend types and full formatting passed; full lint exposed one unused
test import, removed and validated along with all subsequently changed source/tests.
The final endpoint-hash contract/types were regenerated and checked separately.

The optimized frontend build and standalone postbuild now pass on source
`0def5c64`, using the existing dependencies and `browse_enquiries` configuration.
It was initially blocked by the mandatory disk preflight. The owner subsequently
removed all four approved redundant installers (1,147,739,384 measured file bytes,
about 1.07 GiB); their absence and retention of both installed extensions were
verified. The 1 GiB build preflight passed with 22.08 GiB free, and the postbuild
reading was about 22.04 GiB. Chrome was untouched. No dependency install, duplicate
worktree or Docker resource was needed. The former disk/build blocker is resolved.
Build log: `%TEMP%/allied-notifications-final-frontend-build.log`; manual-cleanup
receipt: `%TEMP%/allied-notifications-final-20261025/owner-cleanup-verified.json`.

Installed Next is 16.3.8 versus the lockfile's 16.4.3; exact locked-dependency CI and
optimized hosted browser acceptance remain release checks. The rendered scenarios
were verified in the local development preview; this successful optimized build
does not turn them into production-mode browser evidence. Genuine native delivery
and OS-click acceptance remain unverified for the device reason above.

Live release was rechecked read-only: main/www still serve
`dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe`; backend remains ACTIVE
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19` with no pending rollout.
No notification deployment was performed. Release API/general worker before the
frontend, then verify native delivery/clicks on a supported consented test device.
