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

- Current frontend release source: `C:/Users/PC/.codex/worktrees/allied-audit-copy-current-20261024`,
  commit `5e7deb6a` based on dashboard-quality release `d5269cb3`.
  Backend runtime remains the verified discovery/fitment release; its source is
  `C:/Users/PC/.codex/worktrees/allied-discovery-fitment-20261023`.
- Previous release and ongoing separate audit worktree: `C:/Users/PC/.codex/worktrees/allied-email-evidence-20261023`,
  committed gallery/navigation source `098b580c`. Preserve its independent pending
  audit/copy changes and merge them against the new release before any future rollout.
- Earlier accounts/enquiries release source: `C:/Users/PC/.codex/worktrees/allied-admin-redesign-20261022`;
  detailed release record there: `backend/docs/accounts-and-enquiries-release.md`.
- Comprehensive policy evidence: `C:/Users/PC/.codex/worktrees/allied-launch-final-20261022/backend/docs/public-launch-policy-decisions.md`
- Provider/operational gaps there: `backend/docs/public-enquiry-privacy-review.md`
- Current backend observed: `5c1ea9a7-6211-46d2-995f-c45e504bf9e9` (ACTIVE),
  all four verified images; read-only predeploy passed and 64 migrations compatible.
- Current frontend observed: `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` (READY),
  assigned to both main and www domains on 24 October 2026. Recheck before changes.
- Full release evidence: `backend/docs/discovery-fitment-release-review.md` in this
  worktree. Earlier release pointers/checkpoints below describe their historical state.

## Sequential work queue

Only mark an item complete with evidence and its limitations. Separate technical
work from owner decisions and optional additions. Move to useful independent work
if an item requires an owner decision; retain the pending item explicitly.

| Item | Work and acceptance requirement                                                                                                                                                   | Status                                                                                                                                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Verify current public registration, contact/visit controls, privacy, anonymous access and paid-route restrictions on desktop/mobile; record exact scope                           | Complete for anonymous scope; verified 23 October 2026 Nigeria time                                                                                                                                                                                                                           |
| 2    | Establish a staff support/email procedure: visible replies versus notes, delivery status, mailbox recipient checks, failed-message follow-up, manual recording of mailbox replies | Guide complete; Newworld group access/send-as, backup and staff walkthrough pending                                                                                                                                                                                                           |
| 3    | Account and support email acceptance: verification/reset/expired links, guest and registered replies, preferences and failures                                                    | Complete for controlled acceptance scope, 23 October 2026; 36 isolated checks and hosted recipient acceptance passed                                                                                                                                                                          |
| 4    | Separate product favourites and vehicle saving from paid-action restrictions                                                                                                      | Implemented and deployed; local checks and live anonymous smoke passed; real-record acceptance deferred to Item 6 catalogue publication                                                                                                                                                       |
| 5    | Improve email delivery evidence and failure handling; distinguish provider acceptance from inbox delivery                                                                         | Complete for controlled live Support-email acceptance, 23 October 2026; user confirms the test worked; inbox placement/read receipt is outside provider evidence                                                                                                                              |
| 6    | Catalogue and media acceptance: real content, stock visibility, profile/garage/product/service/vehicle upload ownership and replacement                                           | In progress: signed-in live list/detail garage galleries accepted after custom-domain correction; public empty states, one real service image, profile-photo and garage upload lifecycle verified. Staff media and real product/vehicle publication remain open until approved content exists |
| 7    | Actual staff permissions, support coverage, moderators, incident backup and provider-account recovery                                                                             | Pending technical checks plus owner/staff participation                                                                                                                                                                                                                                       |
| 8    | Approved retention procedures, privacy requests, holds, mailbox/export copies and device encryption evidence                                                                      | Pending implementation/procedures; no destructive automation                                                                                                                                                                                                                                  |
| 9    | Provider-contract and overseas-processing assessment                                                                                                                              | Open; notice approval does not close assessment; Google CDPA acceptance already reported, Resend clarification not resolved                                                                                                                                                                   |
| 10   | Media recovery, backup/restore schedule, monitoring and alert ownership                                                                                                           | Pending; existing DB backups and prior separate restore evidence exist                                                                                                                                                                                                                        |
| 11   | Delivery zones/fees/timing and external courier fee collector                                                                                                                     | Owner decision pending                                                                                                                                                                                                                                                                        |
| 12   | Cancellation/returns, refund clock, invoice publication and financial duties                                                                                                      | Owner decisions and operational setup pending; VAT treatment already settled                                                                                                                                                                                                                  |
| 13   | Workshop capacity/calendars and inspection allocation rules                                                                                                                       | Owner decisions pending; customer-care opening hours are not capacity approval                                                                                                                                                                                                                |
| 14   | Versioned vehicle reservation agreement and deposit/hold/balance/refund rules                                                                                                     | Owner approval pending; draft 70%/two-hour values are not approved                                                                                                                                                                                                                            |
| 15   | Paystack configuration, sandbox tests, reconciliation/refund/late-payment tests and authorised live cutover                                                                       | Credentials/policies pending; purchase-enquiry mode remains                                                                                                                                                                                                                                   |
| 16   | Full agreed-scope acceptance: mobile/accessibility, drafts, permissions, transaction journeys, staff training, rollback and recorded sign-off                                     | Pending earlier dependencies                                                                                                                                                                                                                                                                  |

Optional additions are browser push, SMS, marketing and automatic mailbox-to-case
synchronisation. Do not make those mandatory or buy services without an agreed need.
Marketing additionally requires consent/content/unsubscribe approval.

## Current session evidence

23 October 2026 audit follow-up: the user requested a comprehensive site/role QA
pass, beginning with P0 payment, refund and session boundaries. The current
release worktree remains `allied-email-evidence-20261023` at `098b580c` before
the uncommitted audit-report/test-fixture changes. Initial read-only production
checks found live/ready 200, anonymous payment/session endpoints 401, and no
horizontal overflow on eight core public routes at 320px. `/shop` now redirects
to `/parts`. Two backend focused Vitest runs passed (34 and 18 tests, with a
repeated file); local Help/search and corrected sign-in/MFA browser fixtures
passed (2 and 5 cases). No isolated database, live provider, authenticated-role
or full responsive acceptance had been run at that initial checkpoint. The reports at
`C:/Users/PC/.codex/worktrees/allied-email-evidence-20261023/docs/qa/` are
explicitly in progress. No production deployment or database write occurred.
This audit does not close Item 6 or change the settled browse/enquiries mode.
The published Tyre Change detail was also inspected read-only at 390px; its
generic preparation advice has a small local copy correction in the release
worktree. The header-session fixture now matches the current Sign in label
and workforce MFA step; five focused browser cases pass. Two Help search
fixture cases pass. Targeted ESLint, Prettier and frontend TypeScript checks
pass. No production rollout was made.
The later read-only public responsive sweep covered eight core routes plus the
published Tyre Change detail at nine requested widths (81 combinations):
main H1 present and no document-level horizontal overflow in all. This was a
rendering smoke check; interactive responsive states still need review.
P0 isolated financial verification was attempted in a fresh localhost-only
PostgreSQL 17 Docker database `aat_p0_16286610bc_test` after host/port/name/test
environment confirmation. All 62 migrations replayed with no Prisma schema
difference. The focused Vitest run returned one passing suite, two failing
suites, 22 passing tests, four failing and six skipped. `work-payments` could
not pass its direct-host guard because Docker NAT reports the server's internal
`172.17.0.2:5432` rather than client `127.0.0.1:55432`. Three large
reconciliation tests timed out; one later mocked-failure assertion resolved
unexpectedly. This does not establish a production financial defect or close
the P0 gate. The test container was stopped/removed. See `docs/qa/TEST_RESULTS.md`
in the release worktree. No application database was written.
A fresh second isolated Docker database `aat_reconcile_2cb84e43_test` replayed
all 62 migrations with a clean schema comparison. The previously failing
mocked reconciliation persistence-failure case passed alone (1 pass, 15
name-filter skips), narrowing the mixed-run failure to order/timing effects.
The Docker NAT target guard and three large-batch timeouts remain open. The
second disposable container was stopped and removed after the test.
The local frontend production build passed after the small copy/fixture changes,
including TypeScript, 77 static-page generation steps and standalone postbuild.
This does not verify deployment or close the full frontend regression gate.
A third newly created isolated Docker database `aat_refunds_8626fc8c_test` on
localhost port 55434 replayed all 62 migrations with no schema difference.
Four refund suites passed 49/49 tests with one worker and a 30-second timeout.
The disposable container was stopped and removed. This supports the tested
refund boundaries, but the Docker NAT payment-suite guard, three reconciliation
large-batch timeouts, provider settlement and authenticated role checks remain
open. No application database was written and no production release was made.

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

The user replied "Everything works" after being asked to send one controlled
customer-visible reply from the existing registered-customer test case, check
receipt at the test Gmail alias, and inspect the provider event in the Support
case. Record this as user-reported live acceptance of that path on 23 October 2026. The exact case reference, provider label and event time were not copied
into this tracker, so do not claim a specific delivered/bounced outcome from
independent observation. The successful synthetic signature tests, deployment
state and user acceptance close Item 5's agreed controlled scope. Provider
acceptance, recipient-server delivery, inbox placement and reading remain
distinct facts; the site does not claim an inbox/read receipt. Item 6 is next.

## Item 6 initial inventory — 23 October 2026

Read-only production API checks returned HTTP 200 for services, products and
vehicles. The services page has one published item, Tyre Change, with a WebP
image; a GET of its public image returned HTTP 200 and `image/webp` (72,782
declared bytes). Its public fields include descriptions, duration, image alt
text and `QUOTE_REQUIRED` pricing. No service category is attached; this is a
content-organization choice to review during catalogue acceptance. Public
products and vehicles each returned zero items. No
catalogue/media record was written, and no listing was invented. These checks
establish current publication and image availability only; they do not verify
private profile/garage media ownership, replacement, stock visibility after
publication or customer save/reload/remove on a real product or vehicle.

The owner confirmed on 23 October 2026 that neither a real product nor a real
vehicle is ready for public listing. Do not invent a product or vehicle to fill
the catalogue. At 390-pixel mobile width, the live Parts and Vehicles pages
both showed their intended no-listings messages, contact action and disabled
pagination. The Vehicles page also passed a desktop visual check. The public
Services page displayed Tyre Change, its image and quote-required treatment on
mobile. Two read-only anonymous requests to the private customer-photo and
service-admin image-content routes returned HTTP 401. The browser checks made
no production write or email request.

These checks do not establish that authenticated owners can upload, replace or
remove profile/garage images through deployed Spaces, or that staff can manage
the real service image. Product/vehicle image, stock and save controls need
real owner-approved records before production acceptance. Existing isolated
managed-media tests use injected storage; they do not prove the deployed Spaces
upload/CORS path. Keep Item 6 open for those checks. The intentional empty
product/vehicle catalogues are not a launch defect while the business has no
approved listings.

Two neutral 256-pixel PNG fixtures were prepared under the main checkout's
ignored `output/playwright/item6-media-fixtures/` directory. The test customer
was asked to check production profile-photo upload, persistence after reload,
replacement and manual removal using those fixtures. The user reported on
23 October 2026 that all four steps worked in the existing test customer
account. This is user-reported live acceptance of that account's profile-photo
path, including deployed upload/storage, browser reload, replacement and
removal. It does not establish cross-account privacy or the separate garage,
service, product and vehicle write paths. The removed test photo is no longer
attached in the application; provider backup and cleanup timing were not
independently measured.

The next controlled live check uses the same test customer account to create a
clearly labelled private garage vehicle, attach both synthetic images, reload,
then manually remove the images and test vehicle. This does not create a public
marketplace listing. The user reported that creation, both uploads, persistence
and manual cleanup worked. They also found that `/dashboard/vehicles` showed
only the generic car icon after upload, while the detail page rendered the
photos. Item 6 remains open until that list defect and the requested larger,
slide-style photo view are verified in the current production release.

The gallery release `ad550f7c` fixes the cause: the owned-vehicle list now
projects each vehicle's private image URLs, ordered by cover/sort position,
without exposing storage keys. The customer vehicle cards now show a larger
photo stage with previous/next controls; the vehicle detail page has a larger
gallery with thumbnails. The old icon remains only as the empty or failed-image
fallback. No marketplace listing was created and no database schema changed.
An isolated PostgreSQL `_test` database replayed all 62 migrations with no
schema difference, and the focused garage-media integration tests passed 8/8.
The gallery Playwright scenario passed at desktop and mobile sizes, including
reload, thumbnail navigation, no horizontal overflow and accessibility checks.
The frontend and backend production builds and targeted lint passed; the full
frontend lint command still reports 10 unrelated existing errors in the support
email component and an older review-rendering script.

The DigitalOcean API release changed only the API image digest after checking
the latest managed backup, app-only database firewall and successful separate
restore rehearsal. The deployment's read-only database safety job and service
deployment succeeded. API deployment `92fb65ee-dfc7-4a81-9124-92f4913574c7`
is ACTIVE. Vercel preview `dpl_A2aTb4j58zUGQNn2b1czA19Wn7Qi` responded
successfully, then production deployment `dpl_2DeoDPFfxv7BTGMdkQunCQVPEwB4`
became READY and was assigned to alliedautotech.com. Anonymous live requests
returned 200 for the frontend and public services, and 401 for the private
garage API. The user was asked to repeat the photo/card gallery check in the
existing test customer account, because they had already removed its photos
and test vehicle. Keep Item 6 open for that live authenticated visual check,
staff image acceptance and future approved real product/vehicle listings.

## Dashboard Browse parts / missing-page correction — 23 October 2026

The owner identified the exact broken journey: Dashboard → Overview → Latest
order → Browse parts opened `/shop`, which returned the generic site 404. Live
HTTP confirmed `/shop` was 404 while `/parts` was 200. The dashboard action now
targets `/parts`, and old `/shop` links receive a permanent redirect to `/parts`.
The generic 404 page now includes the site header and footer, a clear explanation,
branded mark and working recovery links. Missing routes still return HTTP 404.

The change was committed as `e3d99983` on the older release source, then
cherry-picked as `098b580c` onto the newer gallery release `ad550f7c` after a
concurrent deployment was detected. The first 404 deployment temporarily
superseded the gallery frontend. The combined deployment
`dpl_GaG2tZE9e7YbQ1U2pSq7LnHGxUcS` was promoted to alliedautotech.com; its
source contains `ad550f7c`. Vercel reports READY and the custom domain resolves
to the combined deployment. The previous gallery deployment
`dpl_2DeoDPFfxv7BTGMdkQunCQVPEwB4` remains the rollback target for gallery
behavior, though it lacks the 404 fix.

Local production builds and targeted lint/formatting passed. The exact dashboard
empty-order click passed in an isolated customer browser fixture. The anonymous
live route suite passed 3/3 against the final domain at 390px and 1440px:
`/shop` reaches `/parts`, missing routes remain 404, the site chrome renders and
the Help Centre recovery link navigates. No authenticated production customer
record, email or database write was made for this correction. Provider API
inspection before the frontend rollout found the managed database online and
seven backups, latest 23 October 05:22:11 UTC. The existing separate managed
PITR restore rehearsal was verified from its recorded receipt; it predates the
final production recovery and was not repeated for this frontend-only release.
Item 6's authenticated gallery acceptance and other media checks remain open.

The customer then reported that private garage photos persisted on Manage photos
but the list and detail pages still showed the old car icon under
`mike.saviour08@gmail.com`. A fresh Vercel inspect and alias listing found both
custom domains pointed to `dpl_HWtHz6Wv6TEZrpBZGreHRhu8Zy6L` from
`e3d99983`, which does not contain gallery commit `7dbc863f`. This occurred
after the earlier promotion report, so READY status and the deploy command's
alias message were not enough to establish the current live source. The newer
READY deployment `dpl_GaG2tZE9e7YbQ1U2pSq7LnHGxUcS` comes from `098b580c`;
Git ancestry confirms it includes the gallery and 404 fixes. The main and www
aliases were explicitly re-assigned to it. A fresh Vercel inspect resolved the
main domain to that deployment; the main pages returned 200 and www redirected
to the main domain. The customer was asked to refresh the existing photo-bearing
vehicle on both pages. Future frontend releases must verify each custom
domain's actual deployment ID after concurrent deployments settle.

After that alias correction, the customer refreshed both pages in the account
with the persisted private test photos and confirmed that the list and detail
galleries work. This closes the specific old-icon/gallery defect for the live
customer journey. Item 6 remains open for staff-managed image acceptance and
future real product/marketplace vehicle publication and stock checks; no fake
public listings should be created.

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

Discovery final-verification checkpoint - 24 October 2026: explicit category and
subcategory controls and multiple vehicle conditions/powertrains are implemented
locally. Root/child filtering, resets, history and mobile/desktop hierarchy checks
passed at the checkpoint. A fresh private empty _ci database replayed all 64
migrations; schema comparison and db:check passed. The full backend/browser/build
verification remains in progress, including patched dependency installation after
fresh audit findings. The full requirement/release review is in
`discovery-fitment-release-review.md`; no push, shared database write, provider send
or deployment occurred. Existing provider-origin support-email acceptance remains
separate and pending.

Production release authorization - 24 October 2026: the user explicitly requested
production deployment after completion. The final frontend production pipeline
passed 985 tests plus lint/types/build/format; both production dependency audits
report zero vulnerabilities. Final discovery/fitment/garage/notification browser
acceptance passed all 90 scenarios without failures, skips or flaky results.
Backend full-suite verification and production source/recovery checks remain in
progress. Preserve the newer live garage gallery and independent documentation.
Existing support-email provider-origin acceptance remains separately pending.

Release continuity correction - 24 October 2026: the newer main tracker records
user acceptance of Item 5 and the live garage gallery fix. Those accepted paths
remain settled. Earlier discovery checkpoints referring to provider acceptance as
pending are historical and superseded by that evidence. Item 6 staff-managed
images and future real catalogue publication remain separate from this release.
The combined feature source includes garage `7dbc863f`, gallery merge `ad550f7c`,
navigation recovery `098b580c` and support procedure documentation `71ce089f`.

## Discovery/fitment production release - 24 October 2026

The requested vehicle/parts discovery, category hierarchy, independently reviewed
fitment, owned saved configurations, collection policy, scoped notification
navigation/read-after-display and active slogan changes are implemented and live.
The user explicitly authorized production deployment after verification. Final
backend acceptance passed 1,422 tests (156 intentional fixture/owner/queue skips);
frontend checks passed 985 tests plus lint/types/build/format; all 168 combined
browser scenarios passed without failures, skips or flaky results. Both production
dependency audits report zero vulnerabilities. Pushed GitHub frontend, database-
safety and secret-guard checks passed.

A new empty localhost-only _ci target replayed all 64 migrations. A fresh production
archive was actually restored into another new _ci database (86 tables), then the
two additive migrations rehearsed from 62 to 64 with existing rows preserved. The
protected production runner created/verified another fresh backup, applied only
the reviewed migrations, passed db:check and runtime privilege/schema verification,
and restored the app-only firewall. No staging data or existing grants changed.

Backend deployment 5c1ea9a7-6211-46d2-995f-c45e504bf9e9 is ACTIVE with 16/16
successful steps and all four pinned digests verified. Eight live backend GET
checks passed. Vercel dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr is READY and separately
verified on both custom domains. Keep the previous compatible app releases and
backups; review newly used enum values before a code rollback. No database
downgrade/reset or provider/payment activation is part of this release.

The service index fixture now supplies its own unrelated catalogue baseline rather
than depending on test order; all final backend tests passed on another new target.
Legacy provisioned harnesses remain explicitly gated, with skips reported rather
than treated as passes. Bounded Docker cleanup removed only the never-deployed
032fe09c API image; current/rollback images, all containers/volumes and warm caches
were retained. See discovery-fitment-release-review.md for exact evidence and
remaining acceptance limits. Item 6 and other settled operational decisions keep
their current scope; this feature rollout does not close the whole site queue.


## Current frontend handoff - UI quality cycle 1, 24 October 2026

The standing 29-section UI/UX directive is preserved byte-for-byte in
frontend/docs/Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md, referenced by
AGENTS.md. frontend/docs/UI_UX_QUALITY_REGISTER.md owns scope, source inventory,
coverage evidence, remaining gaps and future finite review cycles. Inventory:
104 route patterns (14 public, 7 authentication, 25 customer, 58 work) and 294
interaction/boundary source files; source discovery is not rendered acceptance.

Current frontend release worktree is
C:/Users/PC/.codex/worktrees/allied-ui-quality-20261024, branch
feat/continuous-ui-quality-20261024, implementation bd0ac141 (pushed), based on
the prior af9d8b94 release. Vercel dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx is READY;
both alliedautotech.com and www.alliedautotech.com were separately verified on
that ID at 20:08:48 UTC. Rollback frontend: dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr.
Backend remains ACTIVE 5c1ea9a7-6211-46d2-995f-c45e504bf9e9. Recheck provider
state before selecting source for another release.

The batch corrects parts Help for enquiry/collection mode and reviewed fitment,
aligns booking/payment preparation, and reuses role-aware Help actions in Quick
Help with loading/error/retry, focus wrapping/restoration and contrast fixes.
Full frontend lint/types/format/build passed; 988 unit tests and 75 distinct
browser scenarios passed across the documented runs/rechecks, including 15/15
against the optimized enquiry-mode production build. Release GitHub frontend,
database-safety and secret-guard checks passed. Initial dev chunk-loading and
outdated MFA-search test failures/rechecks are recorded honestly in the register.
Rendered QA was local production-build plus hosted baseline; final live release
was verified by provider READY and both domain IDs, not real private actions.

Provider preflight confirmed the database online, eight managed backups (latest
24 October 05:22:10 UTC) and the same-day prior restore evidence was reviewed.
This frontend cycle ran no database commands/writes, migration, backup or restore,
and created/removed no Docker images, containers or volumes. Existing runtime,
backup, payment-disabled, enquiry-only and collection policies remain in force.
All earlier Item 6 staff-media/real-publication and operational decisions retain
their recorded scope. Other worktrees' pending audit/copy edits were preserved.


## Current frontend handoff - dashboards and managed workforce, 24 October 2026

The owner's page-by-page UI directive is now applied to the dashboard/workforce
review queue. All 83 customer/work route entries were inspected, with a per-page
evidence index and managed-workforce subpage index in
frontend/docs/UI_UX_QUALITY_REGISTER.md. The reproducible selection is
frontend/tests/quality/dashboard-pages.txt. Source review, synthetic rendered
samples, intentionally restricted launch pages and actual live acceptance remain
distinct; this is not a claim of exhaustive role/state or WCAG acceptance.

Current frontend release worktree:
C:/Users/PC/.codex/worktrees/allied-dashboard-quality-20261024; branch
feat/dashboard-workforce-quality-20261024; runtime implementation 7e522931
(pushed). Vercel dpl_42w1rg4PojUn7a81eD4KrrRVnaW2 is READY. Both main and www
aliases were independently verified on it at 20:57:29 UTC / 21:57:29 Lagos.
Frontend rollback: dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx. Backend remains ACTIVE
5c1ea9a7-6211-46d2-995f-c45e504bf9e9. Recheck actual provider state before
choosing source for the next change.

The batch removes stale work navigation/content after unverifiable workforce
access, provides legacy capability retry and clear session states, contains
mobile drawer focus, fixes repeated workflow landmarks, adds a staff-directory
path for responsibility management, and repairs review-detail retry/heading
hierarchy. No permission, business policy, schema or API contract was broadened.

Local lint/types/format/production build and 988 unit tests passed. The selected
production-build matrix covered 167 distinct scenarios across 82 suites: 164
initial passes, three corrected findings/test assumptions and a fresh-build 6/6
targeted recheck. Initial runner trace collisions, restricted-route test setup,
relative redirect parsing, stale booking-link assertions and Next.js streaming
not-found semantics are documented in the register. Existing overview baseline
was 75/75. No final selected case is left skipped or unresolved; real-directory
API acceptance remains explicitly outside the fixture pass. GitHub frontend
release, database-safety and secret checks passed for runtime implementation.
Rendered verification used the local optimized build; published acceptance here
is provider READY and both actual alias IDs, not real authenticated operations.

Provider preflight confirmed the database online with eight managed backups,
latest 24 October 05:22:10 UTC; same-day separate restore evidence was reviewed.
No local/production DB command, migration, new backup/restore, staff enrollment,
responsibility assignment or real financial action was made. GitHub DB checks
used isolated CI. Docker resources and warm caches were retained; no Docker
resource was created/deleted and dependencies were reused. Task-owned previews
were stopped. Payments and deferred customer transaction routes remain disabled.
Original main-checkout edits and all other worktrees were preserved. Item 6's
settled media/real-catalogue and operational decisions keep their existing scope.

24 October evening audit/copy release: the live source advanced during this audit
from `af9d8b94` to dashboard-quality `d5269cb3`. The two customer-facing copy
fixes were cherry-picked onto that newer source as `5e7deb6a`; no older frontend
was promoted over it. The final branch is
`C:/Users/PC/.codex/worktrees/allied-audit-copy-current-20261024`.
Vercel production deployment `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` built READY
with automatic custom-domain promotion paused. Protected deployment checks
confirmed enquiry-mode Parts copy and a published service detail's preparation
copy. After promotion, both `alliedautotech.com` and
`www.alliedautotech.com` independently resolved to that exact deployment.
Public main-domain Parts and service pages returned 200 with the expected copy.
Backend remains `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`; no schema,
application-database, payment-provider or message action was made. Payments
remain disabled in browse/enquiries mode. The preceding dashboard deployment
`dpl_42w1rg4PojUn7a81eD4KrrRVnaW2` is the immediate frontend rollback
candidate, subject to the normal compatibility check.

The audit's financial suites passed 49 refund and 22 payment/reconciliation
tests on separate disposable isolated databases, but those were run against
the older audit worktree and do not replace the newer dashboard release's
recorded CI or provider settlement acceptance. An attempted full
`header-session.spec.ts` run on the newer source passed 6/19 and exposed
stale fixture assumptions around extra Help session probes and one success
toast. That fixture change was excluded from the production copy release;
header/auth runtime code was untouched. Follow up on the fixture and the
customer toast separately. No real authenticated role journey or live provider
transaction was claimed for this release. Item 6 and owner/operational
dependencies remain open.


24 October 2026, 23:17 Lagos - scoped catalogue/customer-care design release:
runtime `1aacb6af5ffbe72c23e1f0f7d35b78fadf5f4447` on
`C:/Users/PC/.codex/worktrees/allied-catalogue-care-ux-20261024`, branch
`feat/catalogue-care-ux-20261024`. This is the current frontend release source.
It includes the separate copy release and receipt; the older main checkout was
not deployed. Vercel `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB` is READY and
both main/www domains independently resolved to it at 22:17:35 UTC. Rollback
frontend is `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ`; backend remains ACTIVE
`5c1ea9a7-6211-46d2-995f-c45e504bf9e9`.

Shop search precedes fitment tools; catalogue filter/price guidance is clearer.
My Vehicles starts its form with required identity and has clearer navigation
and removal styles. Customer Care has task anchors, associated writing guidance
and a full-width privacy note. Customer and care records have responsive filter
rows, removable constraints, readable blue links and expandable reference facts.
The customer directory remains admin/super-admin only; staff retain their scoped
care/managed queues. Broader testing also fixed lost managed-workforce drafts and
success feedback during access refresh: pending work stays mounted but hidden
and inert; failure or a changed responsibility scope still discards it.

Local 988 unit tests plus lint/types/build/format passed. Initial browser matrix:
349 passed/10 failed; five refresh-lifecycle failures were repaired, four upload
failures corrected a local fixture-host setting and one Shop assertion was
aligned with the existing enquiry-mode copy. All 11 critical rechecks and the
fresh-build 179/179 final checks passed. The passed-case union covers all 385
distinct selected scenarios across 22 suites; it is not a single clean 385-case
run. Final implementation frontend CI/secret checks passed; unchanged backend
safety passed isolated CI on the preceding UI commit. Full evidence, matrix and
remaining manual/real-role limits are in the central quality register.

Read-only preflight confirmed database online/eight managed backups (latest
24 October 05:22:10 UTC); existing encrypted retention/PITR and separate restore
receipts were reviewed. No local/production DB command, migration, new backup
or restore, real message or financial action was performed. Production verification
was provider READY/actual alias identity; browser checks used local synthetic
fixtures. Payments stay disabled. Dependencies and Docker resources were retained;
preview port 3155 stopped. Original main-checkout edits remain untouched except
the guarded documentation handoff. Item 6 and owner dependencies retain scope.


25 October 2026 - Home/Parts/Vehicles implementation checkpoint (not released):
`C:/Users/PC/.codex/worktrees/allied-home-discovery-20261025`, branch
`feat/home-discovery-ux-20261025`, based on latest release `93e2501b` after checking
both actual production aliases. Home sections/motion, direct Parts search and grouped
fitment, simpler vehicle filters, catalogue empty/failure handling and Product enquiry
context are implemented. A separate explicitly fictional `/demo` has 20 products/parts,
12 vehicles and four services; genuine catalogue/database records were not seeded.
Code is uncommitted in that worktree; main-checkout application edits were preserved.

Full lint/types/format, 988 frontend unit tests, four later fixture-contract tests,
10 focused backend unit tests, 347-path OpenAPI validation and the final optimized
build passed. Latest selected development-browser run was 16 passed/1 failed; the
remaining fixture-count assertion was corrected but not rerun. Final Home and broader
127-case optimized regression matrix are incomplete: automatic approval review
rejected loopback preview startup as "blocked by policy", including after the user's
explicit approval. Preview/API ports 3165/5021 are closed; no workaround was used.
See Cycle 4 in that worktree's `frontend/docs/UI_UX_QUALITY_REGISTER.md` for exact
commands, evidence, limitations and resume steps. Do not count this as release-ready.

The compatible public Product-enquiry API expansion must be deployed before the
matching frontend. No schema change, database check/write/migration, backup/restore,
real submission, push or deployment occurred. Docker images/caches/volumes were
retained; no new Docker resource or package installation was needed. Existing useful
dependencies and the built review artifact are retained. Current release/rollback,
launch restrictions, database safeguards and settled Item 6 decisions remain unchanged.

25 October 2026, 08:07 Lagos - public Home/Parts/Vehicles release:
worktree `C:/Users/PC/.codex/worktrees/allied-home-discovery-20261025`,
branch `feat/home-discovery-ux-20261025`. Frontend runtime `b9162cc4`
is live on READY Vercel `dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`; both actual
main/www aliases independently matched at 07:07:45 UTC. Backend source
`2fc02bafdde75385fffad9c46767615a506f5eb2` is ACTIVE in deployment
`da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`, with 16/16 successful provider steps
and all four actual immutable image digests verified. This is the current release
source; the older main checkout and independent pending f0062282 work were preserved.

Home hierarchy/motion, direct Parts search and grouped fitment, vehicle priorities,
distinct empty/error states and editable Product enquiry context are released.
The public, noindex `/demo` shows 20 fictional products/parts, 12 vehicles and
four services, explicitly separate from genuine availability. Real public stock
and make choices remain empty; no genuine catalogue/customer/workforce/financial
seed or real enquiry/payment submission was made.

Release review corrected the initial API-only assumption: existing SQL required
a product reference even for anonymous Product enquiries. New forward migration
`20261025050000_public_unlisted_parts_enquiries` permits only anonymous unlisted
Product enquiries; customer-linked and other source requirements remain intact.
All 65 migrations replayed on a new isolated target; 13 real persistence/security
tests, 43 packaged-image/release checks and all final release CI passed. A fresh
production archive was actually restored and rehearsed separately across 89
tables, with existing row counts preserved. A new 06:56:39 UTC exact-target
verified backup preceded `npm run db:migrate`; production `db:check`, all 65
checksums and runtime least privilege passed. An expected runtime denial when a
postcheck tried to read the migration ledger was resolved using the migration
account read-only, without changing grants or rerunning the migration. All
temporary operator firewall access was removed and original app-only rules verified.
Nine managed backups were listed, latest 25 October 05:22:10 UTC; existing managed
encryption/retention/PITR and restore evidence were reviewed. No production reset,
business DML, data deletion, history repair or restore-over-live was performed.

Selected hosted acceptance passed 22 scenarios (real data, browser-only fixtures
and explicit pause/play), then all 13 real-data journeys passed again on production
at 320/390/768/1024/1440. API readiness/public reads returned 200. The full 127-case
local matrix remains unexecuted because local preview startup was tool-blocked;
real devices, screen-reader speech and real authenticated operational acceptance
are not claimed. Exact evidence/remaining scope is in Cycle 4 of this worktree's
`frontend/docs/UI_UX_QUALITY_REGISTER.md`.

Immediate frontend rollback: `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB`; backend:
`5c1ea9a7-6211-46d2-995f-c45e504bf9e9` with its protected pinned manifest.
Retain the compatible expanded database constraint on any application rollback.
Future backend sources must include migration 65; never bypass unknown history
to deploy an older branch. Existing launch restrictions and Item 6 remain settled.

Bounded cleanup removed two obsolete never-deployed task API images, five
interrupted never-started test containers, one unused internal network and the two
task-created isolated verification databases through the supported test-only
command after target/connection checks. Existing 14 data volumes, useful current/
rollback/other-task images, warm caches and verified backups were retained.
Docker cleanup totals: 39 -> 37 images, rounded 11.84 -> 11.81GB; 18 -> 13
containers. Isolated database logical sizes totalled 34,606,462 bytes. Host free
space measured 12,582,514,688 bytes afterward; no equivalent physical-reclamation
claim is made. Task preview/API ports 3165/5021 remain closed.

25 October 2026, 09:08 Lagos - preferred homepage restoration released:
worktree C:/Users/PC/.codex/worktrees/allied-home-restoration-20261025, branch
fix/home-restoration-20261025. Runtime bb92ca529c3c75e8ed0b6439051412996184c0c0
is live on READY dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU; main/www aliases both
independently matched at 08:08:20 UTC. The baseline was the actual Home at
93e2501b before b9162cc4, confirmed against file history and saved screenshots.
Trust-led hero, original imagery/type, partner/workshop/principles sections,
vehicle/parts editorial bands and feedback/FAQ are restored. New service detail,
three-step process, truthful states, enquiry restrictions, retry and paused
marquee remain. Extra lifestyle grid omitted; no unrelated application rollback.
Customer feedback remains visible when empty and links to public /reviews.
/demo and production sample catalogue code/data are removed; HTTP 404 verified.
No fake inventory or review was published. Existing Parts/Vehicles/Contact,
permissions, auth and backend/migration improvements are preserved.

992 frontend tests plus lint/types/format/build passed; final-source frontend
release CI 40174871261 and secret guard 40174871259 passed. Final hosted candidate
passed 16 real/isolated-fixture scenarios and seven stability/focus/enlarged-text/
long-name/media checks; unchanged review code passed 23 public-review regressions.
All nine real-data checks passed again on production at 320/390/768/1024/1440,
with zero page exceptions, scoped axe, loaded images and working CTA/menu/FAQ/
carousel/review links. Source Home's 18-case optimized localhost suite remains
unexecuted because automatic review blocked startup; hosted evidence is distinct.
Real devices, screen-reader speech and real authenticated submissions remain
untested. Exact evidence and screenshots: this worktree's Cycle 5 quality register
and %TEMP%/allied-home-restoration-20261025/production/.

Backend remains ACTIVE da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9, source 2fc02baf.
Read-only rollout review verified database online, nine managed backups (latest
05:22:10 UTC), existing encryption/retention/PITR evidence and the successful
06:48:38 UTC separate 89-table/65-migration restore rehearsal, original rows
unchanged. No new database command, migration, backup/restore, grant change,
business DML, real enquiry/review/payment or Docker build occurred. Immediate
frontend rollback: dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv. Preserve migration 65.
Temporary hosted review access was revoked; existing protection retained; browsers
and local ports 3166/5021 are closed. Main-checkout unrelated edits are preserved.

Disk review retained useful current/rollback/other-task images, warm caches,
13 containers, 14 data volumes and backups. No Docker resource was created by
this frontend task. Concurrent image/cache growth was retained without ownership
evidence. Automatic approval review rejected bounded removal of the task's
superseded .next build output as blocked by policy; 143,481,750 bytes remain,
plus 451,146,323 bytes of useful warm cache. No deletion workaround was used.
The homepage correction is complete; broader manual acceptance and settled Item 6
keep their existing scope.

25 October 2026 - staff vehicle stock query release integrated into this source:
The backend fix on commit `ff42b0e2` was tested on the `2fc02baf` backend base
with full type/lint/format, 407-operation route coverage, 347-path OpenAPI,
an empty isolated migration replay and 3/3 focused stock integration cases.
It was pushed as image digest
`sha256:6ceab2563f0f15dc6b877aac02de89542113e98f5079c9d85803b383a7bbafb3`.
DigitalOcean deployment `f9239c36-d4b7-4ef0-b8ba-479cda926a13` is ACTIVE;
only the API digest changed. The two workers and read-only predeploy job retained
the previous `2fc02baf` digests. Provider build/deploy/component steps passed;
live API readiness, public products and public vehicles returned 200, and
anonymous staff vehicles returned 401. The 25 October managed backup and earlier
separate restore rehearsal were reviewed; this API-only release did not apply a
migration or write application data. Hosted authenticated staff-filter acceptance
is still open. Item 6 remains open for real catalogue publication.

25 October 2026 - legacy product compatibility concurrency correction in progress:
implementation source `C:/Users/PC/.codex/worktrees/allied-compatibility-concurrency-20261025`,
branch `fix/compatibility-concurrency-20261025`, integrating the verified homepage
source `a69b4397` and stock-query source `ff42b0e2`. The API's administrator
compatibility update and retirement now optionally require the child's current
version and compare it inside the existing product mutation lock. New editor
clients always supply the version; versionless old responses cannot be edited or
retired by that editor. Public product fields remain limited. A stale write is a
409 before mutation/history, and the review disables repeat confirmation while
retaining the draft for explicit reload. Bare legacy DELETE remains compatible.

Verification: all 65 migrations replayed in a new isolated loopback `_test`
PostgreSQL database with no schema diff. Nine focused backend integration cases
passed against a restricted non-owning role; the concurrent-write case recorded
one success, one conflict, a single history increment, and stale-retirement
rejection. No schema change or application database write. Backend typecheck,
lint, OpenAPI (347 paths), route coverage (407 documented operations), format,
build and generated client passed. Frontend types, lint and optimized build passed.
All 13 Edge/Playwright product-editor cases passed locally, including the mobile
write-time conflict and accessibility checks; the follow-up no-repeat assertion
passed. Final-source formatting, release identity and deployment checks remain
open. The temporary test container was removed by Docker `--rm`; useful shared
images/caches, other tasks' containers, data volumes and existing backups were
retained. No production mutation, migration or deployment has occurred in this
correction yet. Hosted authenticated acceptance requires an authorised QA session;
do not infer it from mocked browser data. Item 6 and the broader site goal remain
open.
