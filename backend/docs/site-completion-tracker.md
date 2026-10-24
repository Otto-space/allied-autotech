# Allied AutoTech completion tracker

## Working agreement

The user requested on 22 October 2026 that we finish the site one item at a time,
remember the decisions and continue until the agreed scope is complete. Use this
file as the durable handoff. Read it before resuming completion work, update the
current item and evidence, and do not repeat settled approval questions.

Completion means the agreed customer and staff journeys are implemented, verified,
operationally owned and supported by approved business policies. Optional additions
are separate; a configuration flag or passing build alone does not prove completion.

## Constraints and settled decisions

- No new costs, subscriptions or purchases without the user's approval.
- Frontend remains on Vercel; backend/database/storage are on DigitalOcean.
- Public accounts and enquiries are authorised. Purchase enquiries replace checkout
  for now. Service visits and vehicle inspections require staff confirmation; they
  do not allocate appointments or hold vehicles.
- Paystack is not supplied. Paystack/Monnify remain disabled; do not enable full
  transaction mode to bypass policy or provider checks.
- Preserve all application data and follow AGENTS.md database safeguards. Database
  tests use newly isolated test databases only.
- No automatic deletion of company-controlled customer records. Company staff
  authorise disposal; the approved narrow provider-expiry exception still applies.
- Expanded accounts-and-enquiries privacy wording is approved. Public provider
  wording is "website hosting, cloud storage and email service providers".
- VAT instructions and ordinary retention periods are already approved; consult
  the policy record rather than requesting the same approvals again.
- Do not send external email or other messages without explicit authorisation.
- Do not store passwords, tokens, customer records or recovery secrets here.

## Source locations and release context

This tracker lives in the user's main checkout. That checkout is not the latest
public-release source. Inspect current live state and Git history before any edit
or deployment; never deploy the older checkout merely because it is the cwd.

- Current frontend source: `C:/Users/PC/.codex/worktrees/allied-saved-items-20261023`,
  commit `6e5f9782f4c94ebfdf6521aeae28ef6eb7960462`.
- Earlier accounts/enquiries release source: `C:/Users/PC/.codex/worktrees/allied-admin-redesign-20261022`;
  detailed release record there: `backend/docs/accounts-and-enquiries-release.md`.
- Comprehensive policy evidence: `C:/Users/PC/.codex/worktrees/allied-launch-final-20261022/backend/docs/public-launch-policy-decisions.md`
- Provider/operational gaps there: `backend/docs/public-enquiry-privacy-review.md`
- Current backend observed: `43fd747e-310d-44f7-b267-9f4a96301a7c` (ACTIVE).
  This changed independently during Item 4; this task did not deploy the backend.
- Current frontend observed: `dpl_5S3aHcQdBgDxoU5bX8raZ1Ttgce2` (READY), promoted
  to the main domain on 23 October 2026. Recheck before changing production.

## Sequential work queue

Only mark an item complete with evidence and its limitations. Separate technical
work from owner decisions and optional additions. Move to useful independent work
if an item requires an owner decision; retain the pending item explicitly.

| Item | Work and acceptance requirement                                                                                                                                                   | Status                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Verify current public registration, contact/visit controls, privacy, anonymous access and paid-route restrictions on desktop/mobile; record exact scope                           | Complete for anonymous scope; verified 23 October 2026 Nigeria time                                                                                              |
| 2    | Establish a staff support/email procedure: visible replies versus notes, delivery status, mailbox recipient checks, failed-message follow-up, manual recording of mailbox replies | Guide complete; Newworld group access/send-as, backup and staff walkthrough pending                                                                              |
| 3    | Account and support email acceptance: verification/reset/expired links, guest and registered replies, preferences and failures                                                    | Complete for controlled acceptance scope, 23 October 2026; 36 isolated checks and hosted recipient acceptance passed                                             |
| 4    | Separate product favourites and vehicle saving from paid-action restrictions                                                                                                      | Implemented and deployed; local checks and live anonymous smoke passed; real-record acceptance deferred to Item 6 catalogue publication                          |
| 5    | Improve email delivery evidence and failure handling; distinguish provider acceptance from inbox delivery                                                                         | In progress: case-level retry evidence and signed Resend provider-event correlation implemented locally; production configuration and release acceptance pending |
| 6    | Catalogue and media acceptance: real content, stock visibility, profile/garage/product/service/vehicle upload ownership and replacement                                           | Pending; avoid altering real content for tests                                                                                                                   |
| 7    | Actual staff permissions, support coverage, moderators, incident backup and provider-account recovery                                                                             | Pending technical checks plus owner/staff participation                                                                                                          |
| 8    | Approved retention procedures, privacy requests, holds, mailbox/export copies and device encryption evidence                                                                      | Pending implementation/procedures; no destructive automation                                                                                                     |
| 9    | Provider-contract and overseas-processing assessment                                                                                                                              | Open; notice approval does not close assessment; Google CDPA acceptance already reported, Resend clarification not resolved                                      |
| 10   | Media recovery, backup/restore schedule, monitoring and alert ownership                                                                                                           | Pending; existing DB backups and prior separate restore evidence exist                                                                                           |
| 11   | Delivery zones/fees/timing and external courier fee collector                                                                                                                     | Owner decision pending                                                                                                                                           |
| 12   | Cancellation/returns, refund clock, invoice publication and financial duties                                                                                                      | Owner decisions and operational setup pending; VAT treatment already settled                                                                                     |
| 13   | Workshop capacity/calendars and inspection allocation rules                                                                                                                       | Owner decisions pending; customer-care opening hours are not capacity approval                                                                                   |
| 14   | Versioned vehicle reservation agreement and deposit/hold/balance/refund rules                                                                                                     | Owner approval pending; draft 70%/two-hour values are not approved                                                                                               |
| 15   | Paystack configuration, sandbox tests, reconciliation/refund/late-payment tests and authorised live cutover                                                                       | Credentials/policies pending; purchase-enquiry mode remains                                                                                                      |
| 16   | Full agreed-scope acceptance: mobile/accessibility, drafts, permissions, transaction journeys, staff training, rollback and recorded sign-off                                     | Pending earlier dependencies                                                                                                                                     |

Optional additions are browser push, SMS, marketing and automatic mailbox-to-case
synchronisation. Do not make those mandatory or buy services without an agreed need.
Marketing additionally requires consent/content/unsubscribe approval.

## Current session evidence

Item 1 completed on 23 October 2026 Nigeria time. Item 2 documentation is now
complete; its staff access/coverage acceptance remains pending as recorded below.
If the user moves on, continue independent item 3 preparation while keeping these
item 2 dependencies open. Do not repeat approved decisions or mark the whole item
complete merely because the guide exists.

Provider settings remain `browse_enquiries`, private access off and email on;
payments/SMS remain off. Main-domain MX routes to Google; DMARC remains `p=none`.
The same frontend deployment was observed before and after the browser check.

Anonymous Edge/Playwright checks passed at 390px and 1440px: registration page and
privacy link, service/inspection preference controls, approved privacy notice,
fonts, no horizontal overflow, login/register navigation, www access and service
image loading. No page errors or HTTP authentication challenges were observed.
Browser plugin was unavailable; existing Playwright was used without installing
dependencies. Expected 4xx messages from deliberate invalid probes were excluded
from console-error assertions; other error messages failed the check.

Empty registration/enquiry/complaint POST bodies returned 422; checkout,
reservation and payment POST probes returned 403; unauthenticated customer profile
returned 401. Paid customer pages redirected to contact. These negative probes
created no customer/support records and sent no email; routine operational logs
and rate-limit counters may change.

A separate mobile review-only flow filled a synthetic reserved-domain email,
selected Service, Tyre Change and Port Harcourt, added a future 10:00 Nigeria-time
preference and opened "Send this enquiry?". Review displayed the exact request
and no-guarantee wording. All API writes were intercepted in this flow, and zero
writes were attempted. The final Send button was never clicked.

Initial automation attempts used controls before loading settled, a broad option
locator and omitted the required related-service selection. Corrected the test
to wait for loading and use the current searchable selectors with keyboard
selection. The corrected checks passed; no application change was justified by
those failed test attempts.

Evidence outside Git: `%TEMP%/allied-completion-step1-result.json` (main check at
2026-10-22T22:59:43.867Z), `allied-completion-step1-register-390.png`, matching
1440px/request/privacy screenshots and `allied-completion-step1-review-390.png`.
Scripts: `%TEMP%/aat-completion-step1.cjs`, `aat-completion-review.cjs`.
This is not a full authenticated, live-email, persistence or paid-transaction test.
No new database restore rehearsal, migration or production deployment ran.

No rollout, database migration, purchase or new service is authorised merely by
updating this tracker. Existing task authorisations remain in force.

## Item 2 progress and personnel decisions

On 23 October 2026 the user confirmed that Newworld has his own website dashboard
access. A Google Support group invitation has been sent, but he has not signed in.
The backup is still undecided while the company expects a customer-service officer.
The user explicitly requested flexibility for future personnel changes.

Use role-based responsibility: Customer Care Lead and designated backup, with
Newworld currently filling the lead role as Operations Supervisor. An authorised
company handover updates the roster/effective date and verifies the new person's
actual access; no website deployment or rewriting of the approved public response
policy is needed solely for a personnel change. This does not automatically grant
access or financial powers, appoint Michael as backup, or authorise extra licences.

Created [Staff support and email procedure](staff-support-email-guide.md), covering
review versus confirmation, status/reply/internal-note visibility, complaint
acknowledgement, closure restrictions, delivery statuses and preferences, failed
email handling, mailbox recipients, manual case notes, approved response targets,
example wording and future staff handover.

Checked the guide against support service/worker and frontend controls in the
release worktree. Ran `node node_modules/vitest/vitest.mjs run
tests/unit/support-customer-email.test.ts` from that worktree's backend: all 18
tests passed. Database calls and sending were mocked; no database test, live
email, provider mutation or staff permission change ran. `git diff --check`
passed. Source review/unit tests do not prove Newworld's Google access or complete
the live-email acceptance in item 3.

To finish operational acceptance:

1. Newworld signs into the invited account, opens Support → Conversations and
   verifies that a reply can use `support@alliedautotech.com` as From. Verify
   receipt/reply with a company-authorised test recipient, not a real customer.
2. Company designates a backup and checks that person's access and coverage.
3. Lead/backup complete the guide walkthrough and record completion. Do not use
   live customer cases for trial status changes, closure or test messages.

Keep these pending until evidence arrives; the invitation is not completed access.

## Item 3 progress

On 23 October 2026 the user approved one labelled customer test account and two
test enquiries, with up to ten automated emails total to the approved test address
and support@alliedautotech.com (including normal Support group alerts). The supplied
test address is recorded only in the ignored private run records. No owner/staff
password reset, paid transaction, new purchase or permission change is authorised.

Plan: [Account and support email acceptance](account-support-email-acceptance.md).
New source test: `backend/tests/integration/identity-email-expiry.test.ts` in the
release worktree, guarded to a new local test database. It verifies expiry and
fresh-link single use for verification/reset without changing production tokens.

Created a new local PostgreSQL test target `127.0.0.1:55438`, database
`aat_support_progress_6b681448b9_test`, container `aat-intake-6b681448b9`, on Docker
context `default`. All 61 migrations replayed and schema diff passed. 34 existing
checks passed; two new expiry tests initially violated creation-before-expiry DB
constraints in their fixtures. Fixed fixture creation dates without changing app
or DB safeguards. Both new tests passed on fresh target
`aat_support_progress_e050d2fb7e_test` / `aat-intake-e050d2fb7e` with another clean
61-migration replay/schema diff. Both containers stopped, receipts in
`%TEMP%/aat-email-acceptance-<suffix>.json`. All 36 selected checks now passed across
the two runs. Backend typecheck and new-test lint/format checks passed.

Live frontend observed for this run: `dpl_68D8hFPR6pqJGwikGrjXgfvEvMS2` (Ready).
Backend remains `15a110c0-006c-49a6-82c6-34dcd67c4052`, with correct production
database configuration checked before the normal application write. Public mode,
main-domain verification/reset URLs, sender, Reply-To and disabled payments remain
as expected. No direct production database write or firewall change was made.

One registration POST through the real browser form returned 202 with no browser
page errors. The public response is deliberately generic: it does not establish
that the account is new or that an email arrived. Registration preserves an
existing account rather than replacing its password. User reported no email.
Read-only diagnosis established that the approved address already has an active,
verified CUSTOMER account from 22 October and no new verification email was queued.
The existing account/password were not changed. On 23 October the user explicitly
approved the proposed Gmail plus alias for the separate test account, still under
the original ten-email total limit. No further recipient approval is needed for
that alias or the already approved Support alerts.

Run records: original checkout's ignored
`backend/ops/digitalocean/.private/production/email-acceptance-20261023/`.
`send-ledger.json` reserves 9 of 10 possible automated emails conservatively. Read this ledger
before every send and do not replay an uncertain attempt. Test password is
Windows-user-DPAPI protected in `test-account.private.json`; it was only a candidate
and is now marked `usable:false` because registration preserved an existing account.
Do not attempt to sign in with it. Never print credentials or copy them into
chat/docs. Browser success screenshot is `%TEMP%/allied-email-acceptance-register.png`.

Diagnosis temporarily added this machine's IP to the database firewall while
preserving the two app rules. It used the restricted runtime role, strict TLS,
actual-target verification and BEGIN READ ONLY; selected only the approved
account's role/status/verification indicator and email-job metadata, not payloads,
tokens or password hashes. Finally removed the temporary IP and verified original
app rules remained. Receipt: `diagnostic-firewall-restored.json`.

Alias registration now uses `%TEMP%/aat-email-register-alias.cjs` and the same send
ledger. Its separately DPAPI-protected candidate password is in
`alias-account.private.json`. Do not confuse it with the unusable original-address
candidate. Read the ledger to resolve attempt state before any retry or resend.

Alias registration returned HTTP 202 after exactly one POST, with zero browser
page errors. On 23 October the user confirmed receipt and SPF/DKIM/DMARC PASS.
One approved resend then returned HTTP 202 after exactly one POST and displayed
"Check your email" without browser page errors. Target configuration was verified
again before the normal UI submission; no direct database write was used.
Script: `%TEMP%/aat-email-resend-alias.cjs`; replay guarded in the shared ledger.
Screenshots: `%TEMP%/allied-email-acceptance-alias-register.png` and
`%TEMP%/allied-email-acceptance-alias-resend.png`.
On 23 October the user confirmed resend receipt, older-link rejection, successful
first verification with the newest link, and rejection when that link was reused.
Hosted verification acceptance passed. Do not request another resend automatically.
Test-alias sign-in passed and the normal session endpoint confirmed the expected
CUSTOMER identity. One password-recovery request returned HTTP 202 with exactly
one POST, no browser page errors and the expected "Check your email" screen.
The user confirmed recovery email receipt, reset completion, new-password sign-in
and recovery-link replay rejection on 23 October. Hosted recovery passed.
Script: `%TEMP%/aat-email-reset-alias.cjs`; screenshot:
`%TEMP%/allied-email-acceptance-alias-recovery.png`.
The first script attempt stopped before any recovery request because its browser
fetch check incorrectly called Response.status as a function. Corrected the test
script, then repeated sign-in and submitted the single guarded recovery request.
Pre-reset browser session is encrypted with Windows-user DPAPI at
`email-acceptance-20261023/pre-reset-session.dpapi`; the normal session GET then
returned HTTP 401, independently confirming old-session rejection. Check recorded
in the private ledger; script `%TEMP%/aat-email-session-check.cjs`. No email sent.
The stored alias password becomes obsolete after reset; do not use it for further
normal sign-in. User now controls the test password. Guest/registered support
acceptance followed as recorded below. Item 3 is now complete for its controlled scope.

Guest support test: subject "Email acceptance check - guest - 23 October 2026",
anonymous public form, approved alias, General enquiry, Port Harcourt branch.
One POST returned HTTP 202 without browser page errors. The temporary script
incorrectly asserted 201; source controller confirms 202 is expected. Stopped
without a resend, so the displayed reference was not captured. Recover reference
from Support alert or staff dashboard; do not create another guest enquiry.
Script: `%TEMP%/aat-email-guest-enquiry.cjs`. User subsequently confirmed all guest
steps worked: Support alert received, internal note saved without customer email,
customer-visible reply received, and Customer email delivery marked Sent. Recorded
as user-reported acceptance, not an independent inspection of the staff session.
No guest reference supplied; use the exact labelled subject to locate it if needed.
Do not repeat the guest enquiry/reply. Guest acceptance passed.

Registered-customer check: the user confirmed Support alert receipt, customer email,
conversation link/reply, account notification and Customer email delivery Sent.
Recorded as user-reported acceptance; no independent staff/customer session used.
Subject: "Email acceptance check - registered - 23 October 2026". Do not repeat the
enquiry or reply. The user retains the reset password; never request it or reuse
the obsolete stored candidate.

Operational-email opt-out/restoration: user confirmed all requested steps worked
on 23 October. Disabled preference persisted, the registered enquiry status change
showed Not sent with the opt-out explanation, no customer email was received,
account status/notification remained available, and Operational email was restored
to Enabled and persisted. Evidence is user-reported. Ledger records the completed
action; conservative budget remains 9/10 reserved, including the zero-email checks.

Item 3 passed for the controlled scope. Expiry and provider failure/retry handling
were verified only in isolated tests; no live failure injection was performed.
No new production deployment, migration, backup restore or purchase was needed.
Preserve test records. Newworld mailbox access, backup and staff walkthrough remain
open in Item 2; richer delivery evidence remains Item 5. Current work moves to
Item 4, reviewing favourites/saved vehicles without enabling paid actions.

## Item 4 initial review

The newer local branch `fix/brand-logo-help-20261022` at `39e51edf` is in
`C:/Users/PC/.codex/worktrees/allied-brand-assets-20261022` and currently clean.
Its ProductActions and VehicleActions return only enquiry controls in
`browseEnquiriesOnly()` mode, bypassing the existing customer save/favourite
controls together with paid actions. This is a source finding, not yet a fresh
authenticated production acceptance result. No application code changed yet.

The read-only Vercel deployment check returned HTTP 403 on 23 October. Current
deployment/source reconciliation and publishing therefore need working Vercel
access; do not overwrite a newer live release with either older worktree. Do not
change the public launch mode to enable saving: checkout/reservations/payments
must remain restricted. Backend route gating, saved-items routes and existing
customer/CSRF/session protections still need review before implementation.

## Item 4 implementation and validation — 23 October 2026

Worktree: `C:/Users/PC/.codex/worktrees/allied-saved-items-20261023`, branch
`fix/saved-items-enquiry-mode-20261023`, based on `39e51edf`. Vercel reconnection
succeeded. Management API confirmed current production deployment
`dpl_9rxQTnDxSogYDedtj5sfvSAJzrb2` was built from that exact base commit. Existing
branding changes are preserved; do not deploy from the original main checkout.

ProductActions and VehicleActions now reuse their existing authenticated save
operations in browse/enquiries mode. Catalogue-only mode continues to hide
customer controls; full-mode cart behaviour remains. Paid actions are separately
guarded in handlers and omitted from the limited-mode UI. Scoped enquiry-button
spacing was added to the two detail pages. Backend routes already permit saving
through authenticate/requireCustomer/requireCsrf; no backend/schema changes.

Validation: 24 focused Vitest checks passed, TypeScript and changed-file ESLint
passed. All eight public-launch browser scenarios passed across corrected runs,
including 390px/1440px save -> saved list -> reload -> confirmed removal for both
collections, with CSRF and no transaction writes. Browser API/SSR data were
isolated synthetic fixtures, not production accounts or a real database. Existing
Playwright/Edge was used (Browser plugin unavailable); screenshots reviewed at
`%TEMP%/allied-saving-{product,vehicle}-{390,1440}.png`.

Initial browser fixtures omitted the required response message, used the wrong
removal-button selector, and a PowerShell rewrite temporarily corrupted an existing
en-dash assertion. Corrected these test issues; no application weakening. One
overlapping test invocation encountered its fixture port already in use; stopped
the earlier run before rerunning. No live records or messages were affected.

Predeployment inspection found seven daily managed backups, newest
23 October 2026 05:22:11 UTC, and reviewed existing separate managed PITR restore
evidence. That rehearsal predates production recovery; its scope is documented
in digitalocean-production-release.md. No new restore cluster, migration or backend
rollout is part of this frontend-only fix. Vercel upload dry-run excludes secrets,
local env files, private files, dependencies and generated test/build artifacts.
Production build and deployment subsequently passed as recorded below. Existing
test customer's password remains user-only.

Commit `6e5f9782f4c94ebfdf6521aeae28ef6eb7960462` contains the six scoped frontend
and test files. Optimised local build passed, including TypeScript and all 76
static pages. Final changed-file formatting/lint passed. No dependency changes.
Vercel deployment `dpl_5S3aHcQdBgDxoU5bX8raZ1Ttgce2` was created in the existing
project with production settings and `--skip-domain`. Remote build passed; verified
READY status, exact commit and the unchanged prior main-domain alias, then promoted
the deployment. Management API confirms the main domain now uses this release.
Previous deployment `dpl_9rxQTnDxSogYDedtj5sfvSAJzrb2` is the frontend rollback
target; never restore or reset the database for this UI change.

Public catalogue reads returned HTTP 200 but zero products and zero vehicles on
23 October. Therefore live authenticated saving on real published records cannot
yet be accepted. Do not invent production listings for tests. Complete publication
with accurate business content in Item 6, then verify real save/reload/remove with
the existing test customer. Isolated browser fixtures already cover both flows.

Post-promotion live Playwright checks passed at 390px and 1440px: parts, vehicles,
anonymous saved-items sign-in guard and cart-to-contact restriction. Both customer
save-list APIs returned 401 anonymously. No page errors, external sign-in redirect
or horizontal overflow; all API writes were blocked and zero writes occurred.
Receipt: `%TEMP%/allied-saving-live-result.json`; script:
`%TEMP%/aat-saving-live-check.cjs`; screenshots:
`%TEMP%/allied-saving-live-guard-{390,1440}.png`.

Final provider inspection still shows browse_enquiries, private access off,
email enabled and Paystack/Monnify/SMS disabled. Backend active deployment changed
independently to `43fd747e-310d-44f7-b267-9f4a96301a7c` during this frontend task;
no backend mutation was performed here. Live smoke checked against that current
backend. No purchase, production data write, email send or new restore rehearsal
was performed for Item 4. Technical implementation is delivered; real-record
acceptance remains explicit, not passed by inference. Item 5 is next when the user
continues; keep Item 2 operational gaps and Item 4/6 acceptance pending.

## Item 5 progress — 23 October 2026

Current source worktree: `C:/Users/PC/.codex/worktrees/allied-email-evidence-20261023`,
branch `fix/email-evidence-20261023`, based on merged release source `dfc9beb6`.
The current case view already reported queued, sending, sent, retrying, failed and
not-sent statuses. `SENT` came from an accepted Resend HTTP request and did not
prove recipient-server or inbox delivery. The worker used one generic failure code
for both permanent provider rejection and exhausted transient retries.

Local change: expose the existing outbox attempt count and scheduled next retry to
authorised case staff; distinguish `PROVIDER_REJECTED` and `RETRY_EXHAUSTED` from
generic transient failure; explain provider acceptance and staff follow-up clearly
in the case screen. No schema, migration, sending settings or retry-budget change.
The API still omits recipients, message contents and provider response bodies.
Design and operational limits: `backend/docs/email-delivery-evidence.md` in that
worktree. No Resend webhook secret/endpoint is configured, so delivered, delayed,
bounced and complained provider events cannot yet be displayed in the website.
Do not present provider acceptance as confirmed inbox delivery.

Committed as `717dfdef` (Show support email retry evidence and failure reasons).
Generated private OpenAPI contract and frontend types were updated; OpenAPI
validation passed for 324 paths. The change has not been deployed. Before rollout,
reconcile current backend/frontend sources and required backup/restore evidence,
then release both compatible sides and verify the authorised case view. Provider
event correlation remains separate work and is needed to claim delivery evidence
beyond provider acceptance.

Focused backend support-email tests: 18 passed. Focused frontend status tests:
24 passed. Backend/frontend TypeScript, changed-file lint and formatting passed
after generating a local Prisma client against a dummy `_test` configuration;
the generator did not connect to or write a database. The new backend worktree
needed local dependency junctions to existing installed packages. No production
database write, real email, provider configuration or purchase occurred. Source
is not yet released, and full provider-event acceptance is pending.

Follow-up source commit `f8b8a8f1` adds a raw-body, signature-verified Resend
webhook, an opaque Support-outbox tag, idempotent storage of delivered/delayed/
bounced/complained/failed/suppressed outcomes and a staff-only provider-event
display. It uses the existing outbox table and has no Prisma schema change.
Resend has one unused webhook endpoint slot according to the account holder; no
plan upgrade is needed. The production send-only API key cannot create or list
webhooks. The account holder has been asked to register the exact endpoint in
Resend and save its signing secret locally, without sharing it in chat.

Backend focused tests (23) and frontend status tests (24), changed-file lint,
TypeScript, OpenAPI export/check (325 paths), route coverage (384 documented
operations plus four infrastructure routes), backend build and frontend build
passed. Four immutable images were built and pushed from clean commit
`f8b8a8f15740a8b2e2dc795c44bc280b3757432e`. DigitalOcean deployment
`b0e22da8-0616-4413-b2db-d86319c931eb` is ACTIVE with all deployment steps
successful. Its reviewed app-spec change was limited to four image digests and
one API-only `RESEND_WEBHOOK_SECRET`; the predeploy database-safety check stayed
in place. Before rollout, the operator confirmed seven managed backups, latest
2026-10-23T05:22:11Z, and the 2026-10-23 isolated restore rehearsal receipt
showing archive verification, unchanged source rows and a pass. No new database
migration or restore ran during this release. Signed synthetic webhook request
returned 204; the altered-signature replay returned 401. Neither wrote a
customer record nor sent a real email.

Vercel production deployment `dpl_BEz6Pax6hEZqLdaNHSYTDH79fDzJ` is Ready and
assigned to alliedautotech.com according to Vercel CLI inspection. It includes
frontend commit `6203c4f4`, which displays the provider event time in Nigeria
time. The prior compatible deployment was `dpl_FLT9mBQfFKfcQ4ku9GepDpH3G1kv`.
The Resend
account holder created the one available webhook endpoint and saved the signing
secret locally. Provider-origin event receipt and staff case-view acceptance
still require a post-release controlled Support reply; older untagged emails
cannot acquire provider-event evidence retroactively. No additional purchase.

## Requested discovery and fitment implementation - 23 October 2026

The user requested implementation of the pasted vehicle/parts discovery, reviewed
fitment, saved configurations, notification navigation and branding requirements.
No PDF conversion or production deployment is requested. Implementation lives in
`C:/Users/PC/.codex/worktrees/allied-discovery-fitment-20261023`, branch
`feat/discovery-fitment-20261023`, based on release `8968a1a1` plus `952178f0` rollout
evidence. The existing email provider-origin acceptance remains pending; this work
does not claim to settle it or change the production release.

Vehicle attribute implementation is in progress. An additive migration preserves
legacy USED/unknown values. Prisma generation, a complete 63-migration replay on a
new localhost `_ci` database, schema comparison and `db:check` passed. Fifteen
focused vehicle discovery/schema-guard integration tests passed, including a
10,000-listing fixture and real missing-column rollback. No shared database was
accessed or modified. Frontend TypeScript passed after regenerating API types.
Further fitment, notification, full-suite and rendered acceptance work remains.
See `discovery-fitment-implementation.md` for scope and ongoing evidence.

Discovery/fitment checkpoint: complete 64-migration replay and `db:check` now
pass on a second new private `_ci` target. Vehicle frontend full unit suite passed
969 tests; the new desktop/mobile browser workflows passed with axe/focus/history
checks. Fitment engine unit tests (13) and authenticated PostgreSQL HTTP scenarios
(4) passed. New contract export validates 338 paths; route coverage matches 397
operations plus four infrastructure routes. These are local checkpoint results,
not a production release or complete acceptance of the full pasted requirements.
The current implementation work is connecting the reviewed fitment foundation to
parts search/admin screens and saved configurations; notification read-on-arrival
and final full-scope regressions remain pending. Original provider-origin email
acceptance remains separately pending and unchanged.

Parts checkpoint: normalized search and verified totals now precede paging;
customer parts finder and contextual enquiry are connected; staff product/category
attributes and scoped fitment author/reviewer/history screens are implemented.
New orders are collection only; historical delivery snapshots remain readable.
Frontend unit suite passed 975 tests. Focused backend validation passed 62 tests
plus 13 engine cases; discovery's 12 integration scenarios include 10,000 synthetic
products. Current private `_ci` `db:check` remains compatible with 64 migrations.
See `discovery-fitment-implementation.md` for exact browser evidence and remaining
scope. Saved configurations, notifications and final release-wide acceptance are
still required. No push or production rollout occurred; existing support-email
provider-origin acceptance remains separate and pending.

Saved garage checkpoint: owner-scoped nickname/default, normalized model links,
optional specifications, edit/remove and parts-search selection are implemented
using CustomerVehicle. Six private PostgreSQL HTTP scenarios and desktop/mobile/
session-race browser checks passed. The current frontend full unit suite passes
977 tests. No new schema migration was needed; no production write or deployment
occurred. The feature branch still requires notification navigation/read-after-
display, public subcategory controls, the final filter audit and release-wide
verification. Existing provider-origin support-email acceptance is unchanged.

Notification checkpoint - 24 October 2026: server-authorized destinations, scoped
sidebar navigation, an attention queue and read-after-display are implemented.
Exact workforce booking/payment views and validated support-message anchors
cover off-page records. Eight private PostgreSQL HTTP scenarios plus five
workforce boundary cases passed; the full frontend unit checkpoint passed 979
tests. A clean run passed 25 notification/payment browser regressions, with
existing sorting, financial confirmation focus and uncertain-result recovery
preserved. No new migration, production write, push or deployment occurred.
Public subcategory controls, the remaining vehicle-filter audit and final full-
scope verification are the next items. Provider-origin support-email acceptance
remains a separate pending item.
