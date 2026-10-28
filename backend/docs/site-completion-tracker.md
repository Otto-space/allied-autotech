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

- Current frontend/backend runtime source: `345847d5`, branch
  `feat/notifications-experience-20261025` in
  `C:/Users/PC/.codex/worktrees/allied-home-restoration-20261025`.
  On 25 October 2026 the notification release replaced Shop/Vehicles R2 while
  preserving its 70 migrations, preferred Home, reviews, audit fixes and enquiry
  behaviour. Frontend main/www: `dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3` (READY);
  backend: `1876e3d1-ab99-4e26-8a58-1ea4fcb0d46a` (ACTIVE).
  Recheck provider state before further changes. Full notification evidence:
  `backend/docs/notifications-experience-20261025.md` in that worktree.
- Previous release and ongoing separate audit worktree: `C:/Users/PC/.codex/worktrees/allied-email-evidence-20261023`,
  committed gallery/navigation source `098b580c`. Preserve its independent pending
  audit/copy changes and merge them against the new release before any future rollout.
- Earlier accounts/enquiries release source: `C:/Users/PC/.codex/worktrees/allied-admin-redesign-20261022`;
  detailed release record there: `backend/docs/accounts-and-enquiries-release.md`.
- Comprehensive policy evidence: `C:/Users/PC/.codex/worktrees/allied-launch-final-20261022/backend/docs/public-launch-policy-decisions.md`
- Provider/operational gaps there: `backend/docs/public-enquiry-privacy-review.md`
- Backend observed on 25 October 09:07 UTC:
  `f9239c36-d4b7-4ef0-b8ba-479cda926a13` (ACTIVE), API image from
  `ff42b0e2cf1b4c0b5907d928b2bad21c52d0d9d2`. The other component
  images remain on the verified `2fc02baf` release. The immediately preceding
  deployment was `da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`.
- Current frontend observed: `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` (READY),
  assigned to both main and www domains on 24 October 2026. Recheck before changes.
- Current stock-query integration worktree:
  `C:/Users/PC/.codex/worktrees/allied-staff-vehicle-current-20261025`,
  branch `fix/staff-vehicle-filters-current-20261025`, based on the newly
  active `2fc02baf`. Its `ff42b0e2` API change is deployed. The prior
  `f0062282` stock audit branch is preserved;
  its image was not promoted after the concurrent deployment changed the
  production source. Authenticated production staff-filter acceptance remains
  open; local isolated integration tests and live anonymous boundary passed.


### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/staff-vehicle-filters-20261024; it is not a claim of current production identity.

- Current stock-query audit worktree: `C:/Users/PC/.codex/worktrees/allied-staff-vehicle-filters-20261024`,
  branch `fix/staff-vehicle-filters-20261024`, based on `c3f4076f`. Its backend
  changes are local until release checks and a matching backend rollout complete.
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

The release branch was pushed to GitHub at `origin/release/audit-copy-current-20261024`.
Its automatic Vercel **preview** status was canceled before build because Vercel
reported that the commit signature could not be verified; the preceding
dashboard-quality release branch shows the same status. Do not disable commit
verification to turn that preview green. The CLI-created production deployment
had already built READY from the reviewed source and both production aliases
remained on `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` after the branch push. A
verified signing/identity workflow is a separate release-pipeline follow-up.


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
25 October stock-query audit: `GET /staff/vehicles` accepted featured,
price-bound and year/mileage sort parameters but ignored them. The isolated
worktree now applies listing filters to the same stored listing (including
history), rejects price sorting and incompatible unlisted combinations, and
uses deterministic cursor sorting for newest/year/mileage. Its stock UI has
not changed. TypeScript, full backend lint/format, route coverage (407
operations), generated OpenAPI validation (347 paths), and 3/3 focused
integration tests passed after clean migration replay in a new
`aat_stock_*_test` PostgreSQL database on the earlier `c3f4076f` base. The
disposable database container was removed. A separate deployment then made
`2fc02baf` and deployment `da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9` active;
its newer migration and support changes were not in that test image. The stock
fix was reapplied to that exact source. On the combined source, TypeScript,
full lint/format, 407-operation route coverage, regenerated 347-path OpenAPI,
clean isolated migration replay and all 3 stock integration tests passed. The
first combined run stopped at a stale generated OpenAPI artifact; it was
regenerated before the passing isolated rerun. Both task-created test database
containers were removed. The previous stock image was pushed to the existing
registry but not deployed. No application database was written by this stock
audit. Item 6 remains open for real catalogue publication and authenticated
staff acceptance.

25 October stock-query release: commit `ff42b0e2` was pushed on the current
backend source. Its `linux/amd64` API image was pushed under its immutable
revision tag with registry digest
`sha256:6ceab2563f0f15dc6b877aac02de89542113e98f5079c9d85803b383a7bbafb3`.
The active production deployment was checked immediately before updating:
`da8e5b3a` was ACTIVE with no deployment in progress. The new app spec changed
only the API digest, preserving the existing encrypted secrets, browse/enquiry
launch mode, disabled payment modes, two worker digests and the migration-job
digest/read-only `db:check` command. Schema-only app-spec validation passed;
the provider's full _new-app proposal_ validation rejected already-encrypted
secret references, so it was not used as an existing-app update gate. The
existing-app update succeeded. Deployment `f9239c36` is ACTIVE with successful
build/deploy/component steps, including the predeploy migration job; all four
image digests were verified after promotion.

The managed production database's encrypted off-device backup list had a fresh
25 October 05:22:10 UTC backup. The earlier separate-database production-archive
restore rehearsal and provider retention/PITR evidence were reviewed; no new
restore rehearsal was run for this API-only rollout. No application database
write, migration, grant change or payment change was made by the stock fix.
Live read-only checks returned 200 for API readiness, public products and public
vehicles; anonymous `GET /staff/vehicles?sort=year_desc` returned 401. The
authenticated staff filter combinations were covered by 3/3 isolated integration
tests, but are still awaiting a live staff QA account for hosted acceptance.
The prior `da8e5b3a` deployment and its four component images remain rollback
evidence; the superseded `f0062282` image was not deployed. No Docker cache,
container, volume or image was removed during this release.

25 October 2026 - Shop/Vehicles revision 2 implementation is IN PROGRESS in
C:/Users/PC/.codex/worktrees/allied-shop-vehicles-r2-20261025, branch
feat/shop-vehicles-r2-20261025, based on merged current source b45513f1.
Provider reads confirmed restored frontend dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU
READY and staff-filter backend f9239c36-d4b7-4ef0-b8ba-479cda926a13 ACTIVE.
This is not a release receipt. Other worktree edits remain intact.
Contracts and the acceptance checklist are in backend/docs/shop-vehicles-search-r2.md.
Isolated loopback PostgreSQL uses task-owned tmpfs storage, no application data.
69 forward migrations replayed with no Prisma difference; 67-migration db:check
passed before search extension. Vehicle intent/persistence/queue and product
family checks passed (22 focused checks); search/discovery regressions passed
33 checks, including a 10,000-listing fixture. New scoped product choices plus
search/domain checks passed 15 checks. Frontend transfer/draft and adjacent units
passed 52 checks; admin helpers passed 31 checks. These are separate runs, not
one complete final matrix. Browser acceptance and final release checks remain
pending. No production database command, migration, seed, enquiry or deployment.
Owner's new 20 GiB disk reserve is enforced before substantial operations;
small checks use a documented 0.25 GiB estimate above the reserve. No new package
installation/image build/pull; existing dependencies and cached postgres:18 reused.

25 October 2026 - audit action/correctness batch in progress:
Reused allied-home-restoration-20261025 on fix/audit-actions-20261025; merge
b45513f1 preserves both the preferred homepage and the current ff42b0e2 backend
vehicle fix. Live main/www still resolve to dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU;
DigitalOcean remains ACTIVE f9239c36-d4b7-4ef0-b8ba-479cda926a13. Fully read the
25 October audit and implemented A01-A07: saved-item navigation, valid finance
return destination, release-aware overview links and historical summaries,
verified review/profile-photo disclosures, shared utility actions, and persistent
support reply audience. No commerce restriction, permission, media access or
sending safeguard changed. No new production deployment, application database
write, migration, backup/restore, real message/policy/transaction, Docker build,
dependency installation or copied editor profile. Main uncommitted edits remain.
Acceptance/check results and the exact finite checkpoint are in Cycle 6 of the
release worktree's frontend/docs/UI_UX_QUALITY_REGISTER.md. Finish the outstanding
checks before treating this batch as complete; do not expand into A08-A15 or
redesign the restored homepage without a verified journey problem.

25 October 2026 - audit A01-A07 local batch completed:
All 996 frontend tests (149 files), lint, route type generation/TypeScript,
formatting, optimized webpack build and standalone preparation passed. The
31-case responsive matrix plus focused navigation, permission, saved-fitment,
support recovery, validation, short-screen/doubled-text and console regressions
passed after the documented fixture/output-directory corrections. Six backend
portrait unit tests passed on identical reviewed media/test code without any DB
write. Coverage and evidence are recorded in Cycle 6; this is local fixture
acceptance, not real authenticated operations, physical-device or hosted-release
acceptance. A08-A15 remain the next finite backlog. The preferred Home, public
reviews, removed /demo, backend ff42b0e2 and all security/commerce boundaries are
preserved. Production main/www and API were not changed by this batch.

The owner's new fixed 20 GiB C: reserve is enforced at task preflights. Check
chain was stopped when the instruction arrived and restarted with 0.25 GiB
small-check allowances and a separately justified 1 GiB warm-build allowance.
The build preflight passed at 24.52 GiB free against a 21 GiB threshold. No
Docker resource, duplicate worktree/dependency installation or editor profile
was created. Only a resolved 1,581,764-byte task diagnostic trace was removed;
current build/cache, source, records, backups and other tasks were retained.

25 October 2026, 12:13 Lagos - audit A01-A07 frontend promoted:
Owner-authorised runtime e9f48ef525b80cc215f340015b0553e5b1e3af73 is READY on
Vercel dpl_5vyykAdQnDsAshfCKRU9KNkePJgb. Actual main/www aliases independently
matched at 11:13:48 UTC. Frontend/database-safety/secret CI passed on the runtime;
test-only 8b5fe871 fixes production absence of the development error portal, with
its frontend/secret CI also passing and no runtime-input difference. Hosted
optimized acceptance passed 34/34 isolated audit scenarios and 9/9 real-data
public candidate checks. All 9 production public scenarios subsequently passed, plus 3 live Privacy/restriction checks on main/www, with zero page exceptions; expected anonymous-session 401 and intentional demo 404 remain distinct.
Backend remains ACTIVE f9239c36-d4b7-4ef0-b8ba-479cda926a13 / ff42b0e2; no image,
migration, business-data write, permission, policy approval or real message/payment
was changed. Fresh managed backup inventory and today's separate 89-table,
65-migration restore receipt were reviewed; no new DB command or restore ran.
Existing restrictions/protection remain, temporary hosted QA keys were revoked.
Rollback frontend: dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU. The separate R2 worktree is
still in progress and must retain the new audit frontend before a later rollout.
Exact acceptance and limitations: Cycle 6 of the quality register.

Audit rollout completion: additional production checks finished 11:15:50 UTC /
12:15:50 Lagos. All candidate/production checks passed. Real operational-account
submissions remain untested; no fabricated data was published. Browsers are closed,
owned temporary QA keys revoked, existing protection preserved, and final C: reserve
check passed at 23.83 GiB free. Docker totals unchanged; no task images/volumes,
local rebuild, dependency copy, additional worktree or editor profile created.
25 October 2026 — Shop/Vehicles revision 2 is released.
Authoritative release worktree: C:/Users/PC/.codex/worktrees/allied-shop-vehicles-r2-20261025,
branch feat/shop-vehicles-r2-20261025. Backend image source 91455d10, ACTIVE
264c3f8e-324d-42bd-86cb-0dffa2eb9f19; frontend reviewed tree cfba360d, READY
dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe on main/www. Existing audit/homepage source
8b5fe871 was merged; the previously deployed audit frontend 5vyykAdQ is retained.
Unrelated worktree/source edits were preserved. See backend/docs/shop-vehicles-search-r2.md
and Cycle 7 of frontend/docs/UI_UX_QUALITY_REGISTER.md for complete evidence/limits.

Implemented persisted Vehicle requirements intent, validation/branch routing and
authorised queue projection; compatible legacy listing/idempotency handling; typed
replacement-part/engine-oil authoring and filters; cross-field word/code search,
explicit sort precedence and versioned complete cursors; scoped recorded product
choices; paired budgets in main/footer Contact and bounded WhatsApp handoffs; both
drafts retained with Keep/Start/resume and identity/storage-failure protection.
Category-only emptiness is distinct. No other-family specialist fields, homepage
restoration or broader dashboard redesign was introduced by this bounded task.

All 70 migrations replayed in a new isolated _ci target and passed db:check. Fresh
production archive restore into a separate _ci database verified all 89 table hashes/
counts after UTC normalization; all original values/history survived 65→70. The
protected production migration used a fresh exact-target backup receipt, then
history/schema checks passed at 70. Runtime privileges and new-column reads passed;
no grants changed. The first receipt attempt used runtime credentials for history
and correctly received a permission denial; read-only follow-up used the separate
migration role. No repeat migration/repair was performed. Managed backup/PITR/
encryption/retention evidence was checked; original app-only firewall rules restored.

Backend safety CI 40188786919 passed on its unchanged backend source; frontend CI
40192109661 and repository secret guard passed on cfba360d. Full frontend units:
1003/1003 (150 files); lint/type/format/optimized build passed; production dependency
audit returned zero vulnerabilities. All 18 final hosted fixture cases passed at
360/390/768/1024/1440, then 2 real read-only cases passed on the candidate and again
on production at 390/1440. Sampled main-state WCAG scans and console/runtime checks
passed. Mocked browser submission is distinct from real isolated API persistence;
no real enquiry, fixture publication, customer message or payment was performed.
Real authenticated operational queues, physical devices and full screen-reader
acceptance remain unsampled. Real products/listings/recorded oil/fitment data remain
business inputs; public catalogues currently return zero records. Item 6 retains
its publication/operational scope and prior broader quality backlog.

All four deployed image digests match the manifest. The predeploy job remains
read-only db:check. Rollback retains old application images/frontend, migration 70
and the updated history-aware migration artifact; never reset/restore application
data to undo this release. Temporary hosted review keys were revoked, existing
protection retained, and browser contexts/fixture servers closed. Local Next startup
was rejected by automatic review; hosted verification completed without retrying
another local startup method.

Removed only the owned synthetic tmpfs PostgreSQL container e9812340f10b after
verifying no persistent volumes or other consumers. Docker changed 15→14 containers
at cleanup; other active tasks were retained. Images 42/11.88GB, volumes14/1.012GB,
cache96/6.798GB retained; no image/cache/volume prune or unknown-file deletion.
Kept private backups, native recovery database, current/rollback/base/tool images,
warm dependencies/builds, source and all unrelated work. Final C: reserve reading
was approximately 23.74 GiB free, a point-in-time observation rather than an OS quota.


25 October 2026 - notification-only local implementation checkpoint.
Source branch feat/notifications-experience-20261025 in the reused
C:/Users/PC/.codex/worktrees/allied-home-restoration-20261025. Initial checkpoint
04559c7a; released Shop/Vehicles source 71d3f60d merged as 628d6add, preserving its
70 migrations, Home/audit fixes and catalogue/enquiry behaviour. Other worktrees
and existing main-checkout edits remain untouched. No notification rollout occurred.

Implemented shared role inbox/settings and header preview, explicit idempotent
read/unread and cutoff bulk scope, current source/privacy projection, quiet bounded
foreground reconciliation, precise native-endpoint/session binding, generic push
payload/deduplication and disabled-channel termination. Added persisted password/
MFA-removal security inbox events without expanding approved outbound policy.
API/general worker must precede frontend rollout. Existing permissions and release
restrictions remain; no real customer message, transaction or published fixture.

Evidence: backend/docs/notifications-experience-20261025.md and Cycle 8 of the UI
quality register. 70 migrations replayed on a new isolated native loopback _ci
DB and passed db:check; 477 backend units, 51 isolated integrations, 1,018 full-suite
frontend units plus 6 final focused device cases, and 155 distinct browser scenarios
with passing latest outcomes across documented runs. Final backend build/types/
lint/routes/secret checks and frontend types/format/scoped final lint passed.
Initial browser failures and corrected assertions remain recorded, not hidden.
Screenshots: %TEMP%/allied-notifications-cycle-20261025/. Final receipts:
%TEMP%/allied-notifications-final-20261025/. No claim of real operational-role,
physical-device, full screen-reader or genuine native transport/click acceptance.

Remaining required checkpoint: optimized frontend build blocked at about 20.95 GiB
free by the 21 GiB preflight (20 reserve + 1 growth). Manual deletion of four already
approved redundant installers is pending; automatic review blocked agent deletion.
The owner completed CapCut uninstall (~5 GiB recovered); Chrome was left untouched.
Do not retry blocked deletions through another tool or lower the 20 GiB reserve.
Native Edge subscription probe reported permission granted then AbortError:
Registration failed - permission denied; no provider send occurred. Existing live
VAPID configuration was verified read-only, so missing keys are not the prerequisite.
Installed Next 16.3.8 differs from lock 16.4.3; exact locked CI and optimized hosted
acceptance remain release checks. Main/www still serve dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe;
backend ACTIVE 264c3f8e-324d-42bd-86cb-0dffa2eb9f19, no pending rollout.

No Docker resource was created or deleted; retained 42 images, 14 containers,
14 volumes and 96 cache entries, including the unrelated active compatibility DB.
Source, histories, secrets, databases/backups and current/rollback resources retained.


25 October 2026 - notification build blocker resolved.
Owner confirmed manual cleanup; all four approved redundant installer files were
verified absent (1,147,739,384 measured prior file bytes, approximately 1.07 GiB).
Both installed extensions and Chrome remain intact. C: passed the 1 GiB build
preflight at 22.08 GiB free. Optimized frontend build, built-in TypeScript/prerender
checks and standalone postbuild passed on runtime source 0def5c64. Postbuild free
space was about 22.04 GiB, above the 20 GiB reserve. Source/worktree remained clean.
No install, extra worktree, Docker build/resource or application database write.
See %TEMP%/allied-notifications-final-frontend-build.log and cleanup receipt in
%TEMP%/allied-notifications-final-20261025/. The previous disk/build blocker is
resolved. Existing installed Next 16.3.8 differs from lock 16.4.3; exact locked CI
and optimized hosted browser acceptance remain release checks. Native device
subscription/delivery/click acceptance retains its documented permission-denied
limit. No notification production deployment occurred; API/general worker must
precede frontend rollout. All previous fixture/live evidence distinctions remain.


## Production notification release - 25 October 2026, 17:26 UTC

Notification runtime 345847d5 is deployed: backend 1876e3d1-ab99-4e26-8a58-1ea4fcb0d46a
ACTIVE; frontend dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3 READY on main/www. API and
general worker preceded frontend promotion. Home/reviews, R2 and audit fixes,
permissions, database history at 70 and browse/enquiries restrictions are preserved.
No production fixture, customer message, transaction, migration or grant change.

Exact locked Next 16.4.3 CI passed: 1,019 frontend units, lint/types/format/build
and production audit; backend safety and secret CI passed. Nine image checks,
production read-only db:check, runtime least privilege and current worker heartbeats
passed. Today's separate 89-table restore and nine managed backups were verified.
Temporary exact-IP database access and hosted review keys were removed.

155 hosted fixture browser cases passed across 142+13 complete runs, including
four role families and eight workforce scopes. An outdated opt-in fixture failed
initially; adding its actual endpoint/hash contract resolved it without app changes.
Live Edge checks on both domains at 390/1440 passed Home/Reviews, authentication,
/demo 404, images, wrapping and console/runtime checks; no API writes. Native
delivery/OS clicks, physical devices, full screen-reader and authenticated real-role
acceptance remain unverified. Item 6 and broader operational acceptance remain open.

Full release/rollback/evidence details: backend/docs/notifications-experience-20261025.md
in the reused allied-home-restoration-20261025 worktree. Runtime remains 345847d5;
subsequent edits are evidence and the E2E fixture correction only. C: postflight
29.54 GiB free; current/rollback images, warm cache, databases/backups and other
tasks retained. No broad prune, duplicate install/worktree or image archive.
25 October 2026 — Customers/Customer Care implementation checkpoint.
Working source feat/customers-care-20261025 in the reused Shop/Vehicles R2 worktree.
Notification release 17bc43fc merged after main/www and backend provider verification;
its inbox/push changes are preserved. Other worktrees/main edits are untouched.
This task covers actual customer tables, reviewed suspension/reactivation, scoped
Customer Care hierarchy/drafts and per-operator delivery notice dismissal, plus
shared semantic state presentation. Homepage and broader redesign remain excluded.
Forward migration 20261025170000_support_delivery_notice_dismissal is committed;
71 migrations replayed on new isolated targets and restricted runtime db:check passed.
A fresh production archive restored into a separate local database and protected
70-to-71 migration preserved original row hashes and ledger. This was a logical
restore rehearsal, not a new managed PITR cluster. Production migration/promotion
are pending final CI and compiled responsive acceptance. See the task evidence doc
and UI quality Cycle 10; do not treat the remaining real-role/device acceptance or
the broader site-completion Item 6 as completed by mocked role fixtures.

25 October 2026 - legacy compatibility concurrency release candidate:
branch `fix/compatibility-release-20261025` applies the isolated compatibility
correction to the actual 70-migration notification release source, preserving its
inbox/push, Shop/Vehicles and audit changes. The administrator editor sends the
child version on compatibility update/retirement; the API checks it under the
product mutation lock and returns 409 before any stale mutation/history write.
The draft remains available for explicit reload and duplicate confirmation is
disabled. Legacy bare DELETE remains compatible; public product fields remain
limited. No schema change or production database write is needed for this fix.

On the pre-integration source, 65 migrations replayed in an isolated `_test`
database with no schema diff; nine focused integration tests passed under a
restricted runtime role, including concurrent writes and stale retirement. The
13-case local Edge editor suite passed, including 320px conflict, draft recovery,
no horizontal overflow and automated accessibility checks. The matching source
then passed a focused no-repeat confirmation test. Final-source verification and
release evidence follow separately. The independent Customer Care branch with
unreleased migration 71 is preserved; this candidate does not publish it. Item 6
and the broader site goal remain open.

Release-source verification: all 70 migrations replayed in a new isolated `_test`
database with no schema difference; `db:check` and all nine focused integration
cases passed with a non-owning runtime role. The final API contract validated 350
paths and 410 documented operations. Backend and frontend types, lint, formatting
and builds passed. In the optimized local browser run, 11 of 13 editor cases
passed; the preflight retry assertion caught an overly broad repeat block and a
mobile screenshot timed out under concurrent checks. The repeat rule now allows
retry only when no write was sent and disables it once a write has been attempted.
The preflight, write-time conflict and mobile accessibility cases all passed on
the rebuilt final source. No synthetic customer or catalogue data was published.

## Customers and Customer Care production release - 25 October 2026, 19:32 UTC

Runtime source dc0322f0fd68df99c45971ea325036dc397e2b2f, branch
feat/customers-care-20261025 in C:/Users/PC/.codex/worktrees/allied-shop-vehicles-r2-20261025.
Backend 9ed4a4f2-683a-41f2-ab43-39673783a4a5 ACTIVE; frontend
dpl_JAEZULBoPpBYEhTSywcqCSVYVWig READY on main/www. Preserves notification
release 17bc43fc and the concurrent compatibility correction 313c4f9c: production
change was detected, then merged and artifacts rebuilt before promotion.

Actual customer tables/details, authorised audited suspension/reactivation with
session enforcement, conversation-first Customer Care, retained audience/drafts,
operator-local persistent notice dismissal and shared semantic tones are released.
Protected migration/backup/db:check succeeded at 71; all checksums, runtime least
privilege, backup SELECT and eight worker heartbeats verified. No existing grants
changed, no real customer mutation used for acceptance, temporary DB firewall access
removed. Separate actual logical restore rehearsal preserved 89 original tables and
ledger through 70-to-71; nine managed backups reviewed. Not a new physical PITR test.

Final merged CI green: 1,024 frontend units, production audit zero, backend migration/
safety and secret checks. Real isolated combined API suite 55/55; compiled fixtures
15/15 care and 13/13 compatibility; 61 conversation regressions across full run and
focused rerun. Twelve real read-only journeys passed on both domains. Evidence and
screenshots: backend/docs/customers-care-20261025.md and UI quality Cycle 10 in the
release worktree; fixture/real/physical evidence limits are explicit. Operational
real-role, native clipboard/device/screen-reader acceptance and broader Item 6 remain
open. Homepage and broader redesign were excluded. Production keeps browse/enquiries
restrictions. Rollback retains schema 71 and requires a 71-aware migration checker.

Owned Docker tmpfs fixture and superseded candidate tags removed; all 14 volume
identities, backups, current/rollback/tool/base images and other tasks retained.
C: postflight 28.77 GiB free at measurement. Existing main-checkout content was
preserved by append-only continuity updates; no unrelated source was overwritten.


25 October 2026, 19:44 UTC - final customer-detail refinement released.
Frontend fd19aabc9d0a0843857821cf2eb12651f2ce505c /
dpl_BVUgeibwBeTL3EvTZPiiCM9nMNgf is READY on main/www; backend remains
9ed4a4f2-683a-41f2-ab43-39673783a4a5 at dc0322f0, with verified migration 71.
Collapsed address/reference panels now retain their natural height; garage activity
omits payment fields. The garage-shaped fixture and matching predecessor captures
were corrected. All 19 customer-detail and 15 new acceptance browser cases passed
on the final compiled candidate; final locked CI passed 1,024 units, types/lint/
format/build and zero production audit findings. No further backend/schema change.
Live read-only smoke and the prior fixture/real-role/device/recovery limitations
are recorded in the release evidence doc and UI quality Cycle 10.

25 October 2026 - reviewed cart clear correction in progress. Source branch
`fix/cart-clear-atomic-20261025` merges the latest customer-care refinement. The
server now checks an exact reviewed item/quantity/price snapshot under the cart
lock before clearing; stale contents return 409 without deletion. Item edits use
the same lock, and the old empty-body clear is rejected. No schema/payment mode
change. Fresh isolated 71-migration replay and schema comparison passed; two
related integration files, 13 compiled cart browser fixtures, types, lint, format,
OpenAPI/route checks and frontend build passed. See `cart-clear-atomic-20261025.md`.
Production deployment and real signed-in acceptance are pending; existing customer
care and notification releases must be preserved. The broader Item 6 and site
acceptance remain open.

26 October 2026 - Help, Learn and Practice Phases 0-3 completed locally.
Branch feat/help-learn-practice-20261026 reuses allied-shop-vehicles-r2-20261025
from released runtime 76377d43. Backend contract commit e33c9e3e and frontend
implementation 6b83a4d6 add 17 server-filtered articles, three optional guides and
11 isolated fictional scenarios; no schema migration, AI or operational action tool.
Current permissions, launch restrictions, drafts and unrelated branches are retained.
The separate customer-table responsive branch remains untouched and unbundled.

Final evidence: 1,032 frontend units, 77 backend checks, 18 compiled Edge cases,
71-migration fresh isolated replay/db:check, runtime privilege verification, types,
lint, format, build/postbuild, API contracts and private-bundle checks passed.
Practice produced no operational/external requests. Source flags default off.
See docs/help-learn/IMPLEMENTATION_STATUS.md and UI quality Cycle 14 in that
worktree; screenshots %TEMP%/allied-help-learn-20261026/. Local proxy/crypto/pg
notices and physical-device/screen-reader/locked-CI/hosted limitations are explicit.

This brief explicitly limits deployment to local/test. No push, production or
preview publication, shared-database write or real business submission occurred.
Task servers stopped; Docker daemon unavailable, all existing resources retained.
C: measured 29.84 GiB free after work. Existing main-checkout tracker bytes are
preserved by append-only update. Site completion Item 6 remains open.
Next separately scoped action: business-copy review and current-release/locked-CI
reconciliation before any publication request; generative AI remains deferred.

26 October 2026 - fitment and product-media local implementation candidate.
Branch feat/fitment-media-20261026 in reused allied-home-restoration-20261025,
based on recorded release 76377d43. No reset or whole-commit revert. The local
customer-table correction, pending staff revision, Help work and other worktrees
remain preserved. Reproduced legacy Toyota/Camry empty editor without a write;
implemented explicit reconciliation/current-ID hydration, retained draft snapshots,
evidence-led authoring/review and separate product Images/Compatibility tasks.
Added compatible atomic, audited gallery ordering without changing main flags,
permissions, uploaded assets or existing CRUD. Hosted URL writes reject private/local
literal and common expiring forms. No schema change or production business write.
71 migrations replayed in a fresh verified isolated native _ci database; db:check,
21 real integration cases, seven backend units and 40 frontend units passed. Full
frontend lint/types/build and backend lint/types/OpenAPI/route checks passed.
Compiled fixture and real API/browser acceptance/evidence is recorded in
backend/docs/fitment-product-media-20261026.md in the candidate worktree. Backend
must precede the frontend for the new ordering endpoint. No production deployment;
real-role/provider/device/locked-CI and wider Item 6 acceptance remain open.
Final candidate acceptance: 36/36 compiled scope browser cases plus 12/12 adjacent
regressions, including actual isolated API media persistence/public access/removal,
passed. Owned preview/test API stopped. Current screenshot index is in
%TEMP%/allied-fitment-media-review-20261026/. Removed 54.78 MiB superseded browser
output; C: 29.88 GiB free at measurement. No Docker resources, duplicate dependencies
or additional worktree created; databases/current cache/other tasks preserved.
Final gallery spacing follow-up rebuilt successfully and passed all five gallery
width cases again; current screenshots updated and preview stopped. Functional
48-case acceptance above remains the baseline; this is a bounded CSS correction.

26 October 2026 - owner-authorised fitment/product-media runtime a28753ab is live.
Frontend dpl_CucTTefbZ71ApHiWsYA8P9JrPoH9 READY on apex/www; backend
caeac741-805b-47a5-bb2d-d9e703cdff77 ACTIVE, all four manifest digests verified.
Backend-first rollout retained configuration, browse/enquiries and permission rules.
Three locked CI workflows and nine image cases passed; hosted Next 16.4.3 verified.
Read-only production db:check passed before/after at 71; least privilege and three
worker heartbeats passed; original app-only firewall restored. Fresh managed backup
inventory and existing separate 89-table restore rehearsal reviewed. No migration,
business DML, real upload/review/message or grant change. Thirteen read-only Edge
journeys passed at 390/1440; captures inspected. Real-role/provider/device acceptance
remains separate. See backend/docs/fitment-product-media-20261026.md and
%TEMP%/allied-fitment-media-production-20261026/. Current/rollback/pending resources,
all containers/volumes and useful caches retained; C: 29.82 GiB free. Unrelated
Help/Learn, customer-table and staff-revision work not bundled. Main tracker existing
bytes preserved by append-only update. Broader Item 6 remains open.


26 October 2026 - Help, Learn and Practice production deployment completed.
Owner explicitly authorised publication after the original local/test milestone.
Frozen runtime adef02f9d7d0d23818b8dbfcae9e938a27a40ee4, branch
feat/help-learn-practice-20261026 in reused allied-shop-vehicles-r2-20261025.
Merged actual preceding production a28753ab before rollout, preserving fitment and
product media; separate staff/customer-table branches and other worktrees preserved.
Backend 1dbceb73-075e-4f41-bd76-deb3daf71354 ACTIVE; Vercel
dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD READY, both main/www aliases verified to it.
API learning/guides/practice flags and frontend build flag enabled; AI remains off.
All three exact-source CI workflows passed; locked Next 16.4.3, 1,036 frontend tests,
production dependency audit zero findings (three existing development findings).
Merged local regression 26/26, deployment spec 32/32, packaged contracts 10/10 passed.
Production readiness, public catalogue/scenario and private-denial reads passed.
No schema changes/migrations or production business submissions. Existing read-only
predeploy check job SUCCESS. Eight managed backups present, latest 26 Oct 05:22Z;
retained separate 25 Oct logical restore receipt/archive checksum verified. No new
cloud restore/PITR rehearsal; packaged isolated synthetic restore is separate evidence.
Hosted authenticated-role, physical-device, full screen-reader and production UI
acceptance remain open. Full identifiers, rollback, CI links and precise evidence:
docs/help-learn/PRODUCTION_RELEASE.md in the release worktree.
Removed only four never-deployed superseded task-local bb9dea4d images without force;
current/rollback resources and all 13 containers/14 volumes retained, no cache prune.
C: measured 29.81 GiB before/after cleanup; reserve passed, no physical-reclaim claim.
Main tracker updated append-only with original bytes preserved. Item 6 remains open.

25 October 2026 - cart correction released from source `76377d43`. DigitalOcean
`98401193-fb85-48d9-8c51-462dcadd6d19` is ACTIVE with all four expected image
digests; Vercel `dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u` is READY on main/www. The
three GitHub workflows passed. Existing 71-migration schema was unchanged;
predeploy ran the read-only database checker, and the same-day separate restore
evidence plus eight managed backups were reviewed. API live/ready and public
Home/Help/Parts returned 200; `/shop` redirects to `/parts`; anonymous cart
remains 401. No real cart or payment write was used for acceptance. Details and
remaining limits: `cart-clear-atomic-20261025.md`. Item 6 and authenticated
operational acceptance remain open.

25 October 2026 - required staff revision candidate. Status, branch and role
mutations now require the reviewed account revision and compare it under the
account lock. Missing revisions fail 422; competing stale decisions fail 409.
The deployed dashboard already sends the revision. A fresh isolated `_test`
database replayed all 71 migrations with no schema difference; 13 focused
integration tests, seven compiled dashboard fixtures, type/lint/format and
API contract checks passed. See `staff-revision-required-20261025.md`.
Production rollout and real signed-in role acceptance remain open. This does
not close Item 6 or the wider site goal.

26 October 2026 - customer table/sidebar responsive correction implemented locally.
Branch fix/customer-table-responsive-20261026 reuses allied-shop-vehicles-r2-20261025
from released 76377d43. Expanded/collapsed rows now keep matching compact actions;
desktop columns fit, visible table/sidebar/drawer scrollbars are removed, and
necessary scrolling plus keyboard focus remain usable. The 1024px partially clipped
focus case is fixed. Permissions, account safeguards, data and unrelated work retained.
Final optimized local Edge acceptance: 22/22 browser cases; four related units,
TypeScript/lint/format/build/postbuild passed. See UI quality Cycle 13 and
%TEMP%/allied-customer-table-20261026/ for screenshots, metrics and honest limits.
Installed Next 16.3.8 differs from locked 16.4.3; locked CI/hosted/real-role/device
acceptance remains separate. Vercel management read returned 403; no production
deployment or database/business write was performed. Item 6 remains open.

Task preview servers stopped. C: postflight 29.99 GiB; useful build/cache and 8.4 MiB
review evidence retained. No Docker resource/duplicate install/worktree created.

26 October 2026 - all three identified pending functional batches deployed together.
Runtime 3ccee21a includes customer table/sidebar 3500b3a0, required staff revisions
1aaa39a9 and Help/Allie 38e7df62/d0272949/aa54fba8, preserving actual preceding
adef02f9 and all earlier releases. Backend e8c5297d-93f5-41e0-97bd-0c7851fa5daa ACTIVE;
Vercel dpl_5hGWpdJyGqQgG69dcumqFQ2RU7HQ READY, apex/www exact aliases verified.
Only four backend image digests changed; schema remains 71, no migration/grant/
production business submission. All three exact-source CI workflows, 1,039 units,
nine image cases, fresh isolated replay/db:check, 41 integrations, 57 hosted-candidate
fixture browser cases and 22 recorded live read-only checks passed. Three provisioned
cases skipped. Local preview policy rejection resolved via protected hosted candidate,
with isolated API/page fixtures and writes blocked; host/identity harness adjustments
are documented. Real-role mutations, physical and screen-reader acceptance remain open.
Production schema/privileges and three worker heartbeats passed; original app-only
firewall restored. Latest managed backups and retained separate restore/archive hash
verified; no new restore. Temporary source/cookie files removed, owned API stopped;
current/rollback/data/other-task resources retained. C: 28.16 GiB free. Evidence and
rollback: backend/docs/pending-commits-production-20261026.md. Main tracker existing
bytes preserved append-only. Broader site-completion Item 6 remains open.

Revision 4 implementation is active on feat/workforce-allie-r4-20261026, based on
verified production runtime 3ccee21a (documentation HEAD 9b1728fe). Canonical brief:
docs/help-learn/REVISION_4_BRIEF.md. Its precedence replaces the older optional-AI
completion criterion. Workforce access is the first dependency. Existing account
tiers, eight responsibility templates plus CEO position, legacy reviewed enrollment
and protected owner/promotion policies are retained. W1 adds a real scoped workforce
directory in place of the UUID-first lookup; implementation is under verification.
Remaining: complete effective-access provenance/versioning, atomic role/delegation
changes, full navigation/session/subscription coverage, actual conversational AI,
all-dashboard learning coverage, reviewed persisted handoff and gated human chat.
Do not mark the goal complete from this first batch. No new production publication,
purchase, invitation or real customer communication is authorised by this revision.

Revision 4 W1 local acceptance: directory and existing editor verified with 31
restricted-runtime isolated HTTP/DB cases, 14 focused units and 18 distinct
fixture browser scenarios. No schema change or shared/application DB write.
Full evidence/limits: docs/help-learn/WORKFORCE_DIRECTORY_W1.md. Effective-access
provenance, template evolution and role dependencies remain the next foundation
batch. Actual AI, full learning matrix, human handoff/chat and evaluations remain
required. No new production publication. Broader Item 6 stays open.

Revision 4 W2 local checkpoint: owner demotion atomically removes role-dependent
delegation, advances workforce version and records reason without deleting valid
scoped duties, independent financial grants or histories. Invitation acceptance
cannot revive dormant delegation. The review submits both account/workforce
revisions. All 37 isolated HTTP/DB tests, 1,053 frontend units and optimized build
passed. Updated W2 browser specification is not rerun: compiled preview start was
blocked by automatic approval review; no alternate startup. W1 browser evidence
is separate. No schema migration, production rollout or real communication.
Evidence: docs/help-learn/WORKFORCE_ROLE_DEPENDENCIES_W2.md. Remaining foundation,
actual AI, all-route learning, handoff/live chat and evaluations stay required.

Revision 4 W3 local checkpoint: assignment/delegation definitions pinned to reviewed
version 1, using forward migration 72 with portable LF checksum. Fresh empty replay,
schema comparison/db:check, preserved reduced populated fixtures and existing
non-destructive SQL guard passed. Fixed a reproduced delegated-admin copied-target
branch bypass (200 before, 403 after); canonical versioned fitment, assignee and
support-recipient eligibility align. Strict legacy mutation receipts preserved;
updated clients explicitly request version metadata. All 57 isolated HTTP/DB cases,
five backend units, 1,057 frontend units, lint/types/contracts and optimized build
passed. W2/W3 rendered QA remains open after policy-blocked compiled preview start.
No production migration/deployment, real messages, provider call or published stock.
Evidence/rollback dependencies: docs/help-learn/WORKFORCE_TEMPLATE_VERSIONS_W3.md.
Current C: postflight 28.12 GiB free; same useful Docker/current/rollback resources
retained, no pruning. Complete effective-access/transition matrix, actual AI, full
learning coverage, reviewed handoff, gated chat and evaluations remain required.

26 October 2026 - current backend was rechecked as ACTIVE deployment
`b1c75306-9ea7-4f5a-97cc-156ddf412d67`, image source `8c11c3a0`, with no
pending rollout. Its ancestry includes the earlier `3ccee21a` release.

Payment-source concurrency candidate `fix/payment-expiry-race-20261026` was
initially tested against `3ccee21a` and then merged with current `8c11c3a0`.
An isolated order expiry schedule reproduced creation of an intent from a stale
payable read. Intent creation, online initialization and manual submission now
lock the owned source before validating status, amount and deadline. A fresh
`_test` database replayed 71 migrations with no schema difference and passed
db:check; eight integration files passed 48 cases, including three
source-cancellation races. Backend types, lint and format passed. The exact
merged source still requires revalidation before release. No provider transaction,
schema or financial policy changed. See `payment-source-concurrency-20261026.md`.
Production release and real provider/role acceptance remain open; Item 6 is unchanged.

The exact merged candidate `1f2e8c89` was then revalidated on a second newly
created isolated `_test` PostgreSQL 17 target: 71 migrations and schema comparison
passed, as did `db:check`, eight integration files/48 tests, backend typecheck and
lint. The disposable test container auto-removed; all 14 pre-existing Docker
volumes were retained, and C: postflight was 28.14 GiB free. This does not change
the release or live-provider acceptance status. The next step is backend image,
release and hosted readiness verification against the latest active deployment.

26 October 2026 ? campaign artwork and committed W1/W2 changes deployed.
Runtime 8c11c3a0, backend b1c75306-9ea7-4f5a-97cc-156ddf412d67 ACTIVE, frontend
dpl_7mLXWniyi5uZoMPivAPtaWQPeK56 READY on both apex/www. Homepage/About use the
owner-supplied poster with complete framing; About workshop-wall archive removed.
All exact-runtime CI, 1,053 units, 31 isolated integration cases, 32 release-spec
and nine image checks passed. 61 distinct fixture browser cases accepted with
explicit harness corrections. Pre/post production history/privileges/heartbeats
passed and original firewall restored. No migration or real business submissions.
W3 uncommitted work remains in its original worktree; Revision 4/Item 6 not complete.
Evidence/rollback: backend/docs/pending-commits-production-20261026.md. Local preview
stopped, no cleanup deletion, current/rollback/data retained; C: 28.19 GiB free.

26 October 2026 - payment-source expiry correction is live. Backend runtime
2033b159, DigitalOcean 3cb61958-e460-494b-ae29-1ce826ac22b9 ACTIVE,
all four registry digests verified; no frontend or schema change. The read-only
predeploy database checker passed. Direct and public readiness returned 200;
anonymous session/payment reads returned 401. Local exact-source gates passed
48 focused integrations, nine image checks, OpenAPI/routes, types, lint, format
and secret guard. Eight managed backups and the prior separate restore evidence
were reviewed. GitHub PR creation returned 403, so locked PR CI is not claimed.
See the release-worktree backend/docs/payment-source-concurrency-20261026.md.
Real-provider, authenticated-role and broader site acceptance remain open.

26 October 2026 - post-release invoice/vehicle payment source test-only
follow-up a2e0be2e. Six valid synthetic source-row races passed across
intent, online initialization and manual evidence. Three adjacent integration
files passed 38 tests; fresh isolated 71-migration replay, db:check, types,
targeted lint and format passed. The disposable database was removed with all
14 pre-existing Docker volumes retained; C: postflight was 27.75 GiB free.
No runtime redeployment or production business write. Actual operator-service
transition races and real-provider acceptance remain open. See release-worktree
backend/docs/payment-source-concurrency-20261026.md.

26 October 2026 - owner-authorised pending W3 workforce commit 432308e0 deployed
as reconciled runtime c4e0005d, preserving live campaign/W1/W2 and payment-source
concurrency source 2033b159. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a ACTIVE;
frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln READY, both apex/www aliases verified.
Guarded forward migration 72 and db:check passed after fresh backup and actual
separate populated 90-table restore/migration rehearsal with original row hashes
preserved. All exact-source CI, 123 restricted-runtime integrations, 41 release/
image cases and 43 distinct hosted fixture browser journeys accepted. Post-release
DB/least-privilege/worker checks and original app-only firewall verified. No grants
changed or real business submissions. Existing rapid overlapping staff-directory
filter loss remains separate; actual-role/device/screen-reader acceptance open.
Operator harness/timeout qualifications and compatible recovery composition are
in backend/docs/workforce-versions-production-20261026.md. Other worktrees and
uncommitted edits preserved; no speculative Docker cleanup; C: 27.71 GiB free.
Full Revision 4 implementation and broader Item 6 remain open.

26 October 2026 - complete colour/state brief, local implementation checkpoint.
Branch feat/colour-states-20261026 in allied-shop-vehicles-r2-20261025, based on
3cea520f / released runtime 8c11c3a0. Shared black/red/white tokens, branded
marketing/navigation/Allie gradients, contextual focus/selection and semantic
statuses are implemented; approved imagery and white operational surfaces remain.
No backend, schema, permission or business mutation changed. 1,053 units, lint,
typecheck, optimized build and 30 contrast pairs passed. Browser evidence accepts
324 distinct cases across 118 files; three optional cart-drawer cases unexecuted.
Firefox/WebKit, native autofill/pickers, physical devices and full screen-reader
acceptance remain unverified. Exact coverage, initial harness corrections, safe
screenshots and remaining limits: frontend/docs/COLOUR_AND_STATE_REPORT.md and
colour-browser-coverage.json. No push/deploy under this brief. Other worktrees,
Desktop edits and the separate workforce/Allie scope are preserved. Broader site
completion Item 6 remains open. Task servers stopped after checks; no Docker
resources created/deleted; final disk preflight 28.15 GiB free.

26 October 2026 - actual invoice and vehicle operator-service source locks
verified locally against intent creation, online initialization and manual
evidence, on a test-only branch merged with deployed runtime `c4e0005d`.
All six races passed through the real billing/vehicle-sale services: each
payment action waited for the operator transaction, then rejected the cancelled
source without a new payment or attempt. A fresh isolated
`_test` PostgreSQL database replayed 72 migrations with no schema difference;
`db:check`, 44 adjacent integration cases, backend typecheck, targeted lint and
format passed. No runtime release or production/provider write was made.
Provider sandbox settlement and real authenticated-role acceptance remain open.
Detailed test scope is in the
release-worktree backend/docs/payment-source-concurrency-20261026.md.

26 October 2026 - historical refund replay authorization blocker rechecked.
Current backend matches the original requester and exact refund input before
returning an idempotent replay, then checks branch access; STAFF, CUSTOMER and
MFA-unverified administrators are denied at the request route. A focused HTTP
case passed on a newly isolated native loopback `_test` PostgreSQL target after
72-migration replay and `db:check`. Three denied-role POST assertions were added.
The first Docker NAT attempt stopped at its direct-host guard and was not counted
as test acceptance. No production refund or runtime deployment was performed.
Provider completion and authenticated production-role acceptance remain open;
details: release-worktree backend/docs/refund-replay-authorization-20261026.md.
The native test server was stopped; automatic command review blocked removal
of its 76,629,829-byte task directory in Temp. C: postflight was 28 GiB free;
the original 14 Docker volumes were retained.

26 October 2026 - password-change session atomicity corrected locally in the
compatibility release worktree, based on deployed source `c4e0005d`.
The service now rechecks the credential and CSRF-bound session under locks and
commits password, revocations, audit, security notification and session rotation
together. Injected post-rotation failure rolls back all changes; competing
requests leave one successful credential. A newly isolated native loopback
`_test` database replayed all 72 migrations and passed `db:check`; two new
race cases, the identity HTTP flow, 20 MFA integrations, five identity units,
types and targeted lint/format passed. Backend runtime release is pending;
real-role/device acceptance and sign-in challenge failure recovery remain open.
See release-worktree backend/docs/password-change-atomicity-20261026.md.


26 October 2026 - Revision 4 W4A local checkpoint: server-derived responsibility
capabilities/branch/scope/provenance and assign/revoke added/removed/retained preview.
Delegated hidden-source and maximum-scope redaction retained; optional impact digest
is recomputed inside the existing locked mutation, rejecting stale/expired reviews
without partial writes. Position, baseline, independent grants and approval rules
are unchanged; full effective-policy/nav/session/subscription composition is open.
Fresh synthetic native CI target replayed 72 migrations, schema/db:check and runtime
least-privilege checks passed. 56 workforce plus seven learning integrations, 12
backend units, 1,066 frontend units, final lint/types/contracts and optimized build
passed; 24 focused units rechecked the final lifecycle correction. 77 distinct local
fixture browser cases accepted at 320-1920px, impact review 390/1440px with Axe,
keyboard, overflow and inspected screenshots. An initial raw-503 fixture expectation
was corrected to the existing safe generic error; no product safety was weakened.
The exact prepared preview script started on 127.0.0.1:3167 after fresh explicit
owner approval. All browser APIs were intercepted; no real submissions/deployment.
Evidence: docs/help-learn/WORKFORCE_EFFECTIVE_ACCESS_W4.md. The 106-route completion
gate remains unmet; actual AI/provider evaluation, full learning, persisted Customer
Care handoff and staffed/gated live chat remain required. C: postflight 27.85 GiB;
no Docker/worktree/profile/install duplication or speculative pruning. Other active
worktree changes/releases are preserved and require reconciliation before any rollout.
Full Revision 4 and Item 6 remain open.

26 October 2026 - owner-authorised colour/state release deployed.
Runtime d6d8534d preserves deployed workforce/payment source c4e0005d and adds the
black/red/white presentation. Vercel dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD READY;
both apex/www aliases verified. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a
remains ACTIVE and unchanged. All three exact-source CI gates passed, including
1,057 units, zero production audit vulnerabilities and isolated 72-migration
replay/db:check. 39 hosted fixture cases and 12 post-promotion public checks passed;
independent www and backend health reads passed. Formatting/hydration harness
corrections and explicit device/native/three cart-drawer limits are documented in
backend/docs/colour-production-20261026.md. Managed backups and retained populated
restore proof verified; no new restore, production DB command or business write.
Prior frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln retained for compatible rollback.
Other worktrees and Desktop edits preserved; no Docker cleanup; C: 27.86 GiB free.
Broader site completion Item 6 and the separate workforce/Allie roadmap remain open.
26 October 2026 - password-change atomicity correction deployed.
Runtime 3ec9c822, backend deployment 96ffc790-f572-49f4-9047-3ae6cb30469e
ACTIVE. The four image digests match the release manifest; the non-image app
spec is unchanged. Exact-source backend check passed 577 default tests (1,117
intentional database skips), with focused isolated transaction/HTTP cases
separately passed; nine image checks and a packaged isolated migration/restore
check passed. Production PRE_DEPLOY database checker and all component steps
succeeded. Direct and domain liveness/readiness returned 200, anonymous session
401, /shop 308 to /parts, /parts 200. Eight managed backups through 26 October
and the retained separate populated 90-table restore evidence were reviewed.
No schema migration, grant, production business write or frontend release.
Authenticated role/device acceptance and sign-in challenge rotation remain open.
Release detail: backend/docs/password-change-atomicity-20261026.md in the
compatibility release worktree. Previous deployment 707a200f remains the
immediate rollback candidate subject to compatibility review.

26 October 2026 - sign-in MFA challenge rotation defect corrected locally.
TOTP, recovery-code and WebAuthn proof consumption now commits with session
assurance/token rotation after account/session/CSRF recheck. Three injected
post-rotation failures roll back all proof and session state; concurrent use
of one recovery code admits one request. A fresh isolated native loopback
`_test` database replayed 72 migrations, schema/db:check passed, and four new
transaction cases plus identity HTTP and 20 adjacent MFA cases passed. Full
backend check passed 577 default unit/API tests with 1,121 database-gated skips;
OpenAPI/routes, types, lint, format, scripts and secret checks passed. No
schema, route or frontend runtime change. Deployment and genuine browser
WebAuthn/real-role acceptance remain open. Detail in compatibility release
worktree backend/docs/mfa-challenge-atomicity-20261026.md.

26 October 2026 - sign-in MFA challenge atomicity deployed.
Runtime 8b583921, backend 50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3 ACTIVE.
Four active image digests match the manifest, and the non-image app spec is
unchanged. Nine image and one packaged isolated migration/restore checks passed;
all 24 deployment steps including read-only PRE_DEPLOY database check succeeded.
Direct/domain liveness and readiness returned 200; anonymous session and MFA
verify returned 401. Managed backups through 26 October and retained separate
populated 90-table restore evidence were reviewed. No schema/grant/production
business write or frontend release. Real authenticated role, device and genuine
WebAuthn browser acceptance remain open. Previous backend 96ffc790 is the
immediate rollback candidate subject to compatibility review. Detail in
compatibility release worktree backend/docs/mfa-challenge-atomicity-20261026.md.


26 October 2026 - colour and brand assets Revision 2 local checkpoint.
Branch feat/brand-assets-r2-20261026 in allied-shop-vehicles-r2-20261025, based on
ce3121b8 / released d6d8534d. All nine supplied files inspected and original hashes
preserved; five pixel-identical logo crops and nine responsive WebP posters prepared.
Shared red/white/black marks, Home trust/service artwork, About portrait and Services
workmanship implemented. Ad 4 withheld: nationwide delivery contradicts collection
policy; clean corrected artwork is a business/source dependency. No policy changed.
1,057 units, lint/types/build/format and 30 contrast pairs passed. 103/109 broad
fixture browser cases passed; six await optimized replay (three development loading/
navigation failures and three Help/Learn tests with the local flag disabled). The
three prior cart gaps passed in focused checks; real Strict Mode dialog cleanup and
pre-hydration image-error handling repaired. Final local preview start was rejected
by automatic approval review, reason only "blocked by policy"; specific local-only
approval requested and pending. No bypass, push, deployment or database command.
See frontend/docs/BRAND_ASSETS_R2_REPORT.md and brand-assets-r2-coverage.json for
exact evidence, missing clean recaptures, platform limits and reused dependency
version discrepancy. Both live domains still dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD.
Other worktrees and unrelated edits preserved; broader Item 6 remains open.


26 October 2026 - Revision 4 W5 local checkpoint: canonical managed-workforce
navigation/page/action predicates, scoped revision metadata and server-relative
activation/expiry rechecks. Access loss discards stale reads, protected drafts,
learning and staff notification previews; forbidden pages return to the permitted
overview with an explanation. Owner baseline preserved even with a business-position
record, including the current-role guarded legacy invitation helper. No authority,
commerce, schema or real messaging capability added. Existing unknown-save recovery,
MFA, branch/assigned scope and independent approvals retained.
75 distinct native HTTP/DB cases accepted across bounded runs on the W4 synthetic
CI target; db:check and runtime restrictions reverified. Full 1,086 frontend units,
then 29 route/draft and 16 final preview cases passed; lint/types/contracts and the
final optimized build passed. 87 distinct intercepted browser cases accepted in
12 bounded batches, plus two console/Axe/overflow screenshot rechecks at 390/1440px.
Mobile/desktop images visually inspected; real roles, physical devices and full
screen-reader acceptance remain open. Tests exposed/fixed notification cache and
record-navigation draft regressions; harness qualifications are documented.
Evidence: docs/help-learn/WORKFORCE_NAVIGATION_SESSIONS_W5.md. The full Revision 4
and 106-route completion gate remain open: independent policy composition, real AI,
persisted reviewed handoff, gated staffed chat and provider evaluation are required.
No W4/W5 deployment. Other active worktree changes/releases retained and need
reconciliation before publication. Disk preflight stopped a low-headroom build;
space recovered without deletion. Reviewed obsolete dev-output deletion was blocked
by automatic approval review; no alternate removal attempted. Browser batches kept
at least 27.074 GiB in accepted receipts. No Docker resources created/pruned.


27 October 2026 - Revision 4 W6 local backend dependency: actual configurable
Responses HTTP adapter, bounded reviewed eligible retrieval and follow-up context,
plain-text/source/action validation, secret screening and current access/content
recheck after generation. No new assistant endpoint or customer-facing AI enabled;
existing UI remains reviewed search and flags.ai=false. No schema or migration.
51 focused unit/contract cases passed; 10 native learning HTTP/DB cases passed on
the W4 synthetic CI target, with actual current role/MFA/expiry/session checks and
isolated mocked provider. Backend lint/types passed. An initial secret-screening
false positive and control-regex lint warning were corrected. No real model call,
answer-quality score, >=100-case evaluation or full conversational acceptance.
Evidence: docs/help-learn/ALLIE_PROVIDER_CORE_W6.md. Shared encrypted state, quotas,
idempotent turns, endpoint/UI, provider configuration/evaluation and final data-flow
review remain required. Reviewed persisted Customer Care handoff, gated staffed
chat and complete route learning remain open. No deployment, install, Docker or
cleanup operation. Preview 3167 retains W5 frontend; C: approximately 27.10 GiB free.
Full Revision 4 and broader Item 6 remain open; unrelated worktrees preserved.


27 October 2026 - brand assets and mobile support placement deployed.
Final frontend source 8433ff57, Vercel dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ
READY on both apex/www; previous dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD retained
for rollback. Owner-supplied transparent marks and three truthful artworks are
live; Ad 4 remains withheld because nationwide delivery is not approved. The
fixed mobile support dock previously covered 31px of the Tyre Change branch
field at 320px; live field hit-testing and Allie open/close now pass with an
in-flow support strip. Locked frontend and secret CI, protected hosted
artwork/role fixtures, seven public read-only production route samples,
backend readiness and exact alias identity passed. Backend 50b5f5d1 remains
ACTIVE; no schema, payment, business write or provider change. Managed backups
and the prior separate populated 90-table restore receipt were reviewed.
Details and limits: frontend/docs/BRAND_ASSETS_R2_REPORT.md in the brand worktree.
Physical devices, actual zoom, screen reader, authenticated role acceptance
and broader Item 6 remain open. Docker resources retained; C: postflight
27.08 GiB free.

27 October 2026 - current P1 contact/support account-isolation finding revalidated
against deployed frontend source 8433ff57. Public SupportCreateForm already clears
contact fields, message, review proposal and success receipt on session invalidation;
an in-flight anonymous send retains its unknown-outcome lock. Catalogue enquiry
drafts are account/guest scoped. Existing browser coverage includes both enquiry
and complaint at draft, review, pending, unknown and completed stages plus a
validation/session race. Vercel inspect confirmed both production domains remain
on READY dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ. No frontend behavior was changed or
tests repeated. The historical release-blocker note was corrected in the brand
release worktree; real API/cross-device acceptance remains open. Independent
financial follow-up inspection confirmed the refund replay finding, operational
job cursor gap and staff vehicle filter gap have already been corrected in current
source, avoiding duplicate implementations. The reconciliation scheduler still
starts with only its most recent interval after a restart or long pause; catch-up
and same-period failed-run recovery remain a P0 design/verification task. No
provider call, database write or deployment was performed in this audit.

27 October 2026 - About mobile font-swap shift corrected and released. Three
independent 390px live baselines each measured a 0.0832804 CLS contribution:
Quicksand loading wrapped the second hero CTA and moved the campaign artwork
57.09px. Narrow hero actions now stack through 480px. The optimized local
build/typecheck and sampled responsive/Axe checks passed; its reused local Next
16.3.8 installation differed from the requested 16.4.3, so locked GitHub
frontend/secret checks and an exact-source protected preview were required and
passed. Runtime 8fa386cb, Vercel dpl_6wmkNSL8eWDvHKKmqafU6rkb9C5k READY
on both apex/www; prior dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ retained for
rollback. Three fresh 390px live About loads each measured about 0.0000056
CLS. Sampled About 320/481/1440 plus Home/Contact/Help 390 returned 200 with
no page exceptions or horizontal overflow; About artwork, exact CTA links and
390px Axe scan passed. Backend readiness returned 200 and remained unchanged.
All browser API writes were blocked; no customer, payment or provider action.
Physical devices, actual browser zoom, complete screen-reader and authenticated
role acceptance remain open. See brand-worktree UI_UX_QUALITY_REGISTER.md.

27 October 2026 - Revision 4 W7 local checkpoint: owned encrypted transient
conversations, guest/account CSRF and isolation, shared quota/concurrency/leases,
idempotent claims, cancellation, current-access finalization and bounded retention.
Forward migration 73/client generation/fresh synthetic empty replay/schema/db:check
and restricted runtime passed. Final 36 native HTTP/DB cases and 139 units passed;
backend lint/types/scripts, OpenAPI 375 paths, 439 operations plus 4 infrastructure
routes and frontend generated types/typecheck passed. Provider output was mocked;
zero real model calls, customer messages or application/shared DB writes.
Evidence: docs/help-learn/ALLIE_CONVERSATIONS_W7.md and learning-threat-model.md.
Owner could not confirm topology; public/multi-instance assumptions remain explicit.
Masked Windows-user-encrypted evaluation setup helper verified with a synthetic key;
no app environment changed or AI enabled. UI still reviewed search; W5 rendered
checkpoint unchanged. Frontend conversation/privacy, >=100 reviewed real-provider
evaluation, full workforce policy/history, all-route learning, persisted reviewed
Customer Care handoff and staffed/gated transport remain required. Coverage gate
still has all 106 routes open. Fresh replay is not a production restore rehearsal.
No W4-W7 deployment; preserve/reconcile newer release work before any rollout.
Owner-approved deletion of exactly four obsolete .next/dev folders was rejected
again before execution by automatic approval review (blocked by policy). No alternate
removal attempted; 895,695,897 logical bytes remain. C: final-check preflight 26.93
GiB free. No Docker resources, dependency install, new worktree or duplicate profile.
Full Revision 4 and broader Item 6 remain open.

27 October 2026 - Revision 4 W8 local checkpoint: existing Allie panel gains explicit
conversation/send, safe current source/actions, stop, unknown-outcome checks, recent
sessions, reviewed clear and accurate provider/privacy disclosures with search fallback.
Default AI remains off. Security paths suppress conversation; existing auth launcher
exclusion preserved. Public/account namespaces and CSRF remain separate; no transcript
browser storage, form capture, automatic resend or implicit Customer Care submission.
Full frontend lint/types and 1,109 units passed; final polish rechecked 26 focused
cases. Final optimized build passed with cached Next 16.3.8; exact-lock 16.4.3 CI open.
16 distinct intercepted Chromium cases at 320/360/390/768/1024/1440 plus 390x844
follow-up/composer passed, with keyboard/focus return/reduced motion, Axe and inspected
screenshots. Initial login-launcher test assumption corrected to actual intended UI.
37 native HTTP/DB cases plus 60 provider/state units and schema db:check passed on
W7 synthetic CI; provider mocked. No W8 schema change. The retention test now uses
explicit ancient synthetic expiries rather than assuming a fixed backlog size.
Further guest-lock/retention ordering reproduction remains required before exposure.
Contracts/types, secret guard and structural coverage passed; all 106 gates stay open.
Evidence: docs/help-learn/ALLIE_CONVERSATION_UI_W8.md. Real combined browser/backend/
provider acceptance, >=100 reviewed evaluation, full workforce policy/history and
route learning, persisted reviewed handoff and availability-gated chat remain open.
Owner reports purchased credits, model 60k TPM/10 RPM and enforced US$1 project cap;
private key setup ongoing, no real model call or deployment. Helper accepts Yes and
clipboard entry after an explicit pause; synthetic checks never read real clipboard.
C: about 26.40 GiB free. No Docker/install/worktree/profile duplication or deletion;
read-only Docker inventory retained. Denied four dev-folder targets remain preserved.
Full Revision 4/Item 6 active; unrelated newer releases require reconciliation.

27 October 2026 - P0 reconciliation catch-up and failed-period recovery
implemented locally in the current backend release worktree. Runtime commit
c98342b3, documentation HEAD 4097e675 on fix/payment-expiry-race-20261026.
The worker now locates the oldest unobserved online attempt per enabled provider
after a restart, retries a failed period as a separate numbered run, reobserves
late-created attempts in a new immutable snapshot, and fails rather than calling
provider outages missing receipts. A renewable ten-minute lease permits safe
recovery of a crashed RUNNING run while stopping a displaced worker before
persistence. Existing run/item evidence remains. A forward migration adds
attempt/lease and due-query indexes without altering payment/ledger rows.
A fresh disposable _ci PostgreSQL target replayed all 73 migrations and had no
Prisma schema difference; 23/23 reconciliation/Monnify integration cases,
TypeScript, scoped lint/format and diff checks passed. GitHub backend safety run
40428951879 and secret guard 40428951880 passed for exact runtime c98342b3.
The task-created database container was stopped/removed; no provider call,
production database write, payment movement or deployment occurred. The current
production backend was rechecked read-only as ACTIVE
50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3. A previous RUNNING row without a lease
must be reviewed, not auto-reclaimed. Recurring reobservation of pending/mismatched
receipts, hold resolution, provider sandbox acceptance, current backup/restore
and guarded production migration/release remain open. See the source-worktree
backend/docs/payment-reconciliation-recovery-20261027.md. Preserve separate W7
Allie migration and all unrelated worktrees; broader Item 6/Revision 4 open.

27 October 2026 - P0 reconciliation recurring observation follow-up.
Runtime 7033ce68, documentation HEAD 5a946372 on the same backend release
worktree/branch. The due scan now uses each attempt's latest completed observation:
matched pending and discrepant receipts are rechecked after the configured
interval; terminal matched attempts stop recurring. Failed partial runs cannot
claim coverage. Additive migration 74 indexes the latest-item lookup and sorts
before the separate unreleased Allie migration. A new isolated _ci database
replayed all 74 migrations with no Prisma difference; reconciliation/Monnify
integration 24/24, TypeScript, scoped lint/format and GitHub backend safety
40431495357 plus secret guard 40431495423 passed. Read-only production confirms
backend 50b5f5d1 ACTIVE, no pending rollout; API ready/live 200, anonymous
customer-payment 401; general worker reconciliation false and Paystack/Monnify
disabled. Managed cluster listed eight backups through 26 October 05:22:11 UTC.
No populated restore rehearsal, production migration, provider call or deployment
was done in this follow-up. Explicit hold/anomaly resolution, provider sandbox,
production-scale query assessment and guarded release remain open. Preserve
unrelated W8 Allie changes and current production frontend/rollback.

27 October 2026 - P1 inventory reservation unknown-outcome recovery fixed locally
on the current backend reconciliation branch. The request now reaches its
authorized idempotency replay after the requested expiry; a genuinely new expired
or over-seven-day reservation still fails 422 before a stock write, and a changed
request with the old key fails 409. Existing stock, status and expiry are not
extended on replay. A newly created loopback-only _ci database replayed all 74
migrations with no schema difference; the real Phase 4 inventory HTTP flow passed,
along with seven focused/adjacent units, TypeScript, scoped lint/format and OpenAPI.
The flow's stale cart-clear fixture was updated to the already-released reviewed
snapshot contract after the initial isolated run exposed it; the final run passed.
Both task-created test containers were removed. This is not a production release;
populated restore, guarded migrations and real staff acceptance remain open.
Exact runtime 8b8f1e4a passed backend database-safety CI 40434368733 and secret
guard 40434368672. See backend/docs/inventory-reservation-replay-20261027.md in the
compatibility worktree. Preserve unrelated changes in this main checkout.

27 October 2026 - Revision 4 W9 local checkpoint: owner DPAPI settings verified;
100 actual gpt-6-luna baseline cases reviewed, ten local negative cases stopped
before provider, twelve targeted rechecks accepted after guidance/retrieval fixes.
Baseline 75/100 accepted without recorded quality issue, 25 needed improvement;
not a second full final run. Managed replies, note privacy, assigned sales scope,
internal escalation, delegation/checkout evidence, editable drafts and missing-guide
wording corrected. Guest-retention row/advisory lock wait reproduced and fixed.
Final 80 focused units and 39 native HTTP/DB cases passed; backend/source/scripts
and frontend typechecks/lint passed. Existing optimized preview reused; real guest
two-turn flow and final customer/CSRF/source flow accepted, with native-dialog Axe
and 390/1440 readback/screenshots. Test envelope/selector/CSRF harness assumptions
were corrected; product permissions were not loosened. No W9 schema/build/install.
117 real calls; 120 conservative reservations / USD0.189681 retained, including
three unused browser reservations. Approval exhausted: do not reset the ledger or
make further calls without a new bounded approval. Provider usage estimate USD0.0257841
is not an invoice. No real records/messages, public AI enablement or W4-W9 deployment.
Evidence: docs/help-learn/ALLIE_EVALUATION_W9.md and case-level review JSON. Isolated
API stopped gracefully; existing frontend preview remains. C: about 26.33 GiB free;
no Docker/new worktree/profile/archive, and denied dev-folder deletion untouched.
Full Revision 4/Item 6 remains active. Next: canonical reviewed handoff contracts and
backend; full workforce policy/history, all 106 routes and gated shared transport open.

27 October 2026 - P0 reconciliation populated restore gate advanced locally.
A receipt/hash-verified 26 October production archive was restored into a fresh,
loopback-only PostgreSQL 18 _ci target with 90 public tables and populated account,
branch, catalogue and notification rows. The protected db:migrate runner made a
fresh private exact-target backup, applied pending workforce migration 72 and
reconciliation migrations 73/74, then passed db:check/schema diff. Sampled business
table counts were unchanged; the source snapshot has no payment, refund, ledger,
order or inventory-reservation rows, so those populated financial cases remain
unverified. The test container was removed and the retained rehearsal backup ACL
restricted to owner/Admins/SYSTEM. Production backend 50b5f5d1 stayed ACTIVE;
eight managed backups and app-only firewall were checked read-only. The app spec's
migrator secret is provider-encrypted and local DB access blocked; no firewall,
credential, production DB, provider or deployment change occurred. Fresh production
backup, guarded production migration, source/image rollout and real/provider
acceptance remain open. See the compatibility worktree's
backend/docs/payment-reconciliation-recovery-20261027.md.

27 October 2026 - Active Revision 4 W10 dependency: unsupported workforce history.
Branch feat/workforce-history-policy-20261027 based on committed W9 8b360b89, reusing
the same checkout. Actual synthetic HTTP response preserved unknown template/scope/
position while response/frontend schemas rejected it. Read-only history contracts,
labels and revocation receipt validation corrected; active grants/input enums stay
strict. Full frontend 1112 tests/167 files, 17 focused cases and nine native effective
access cases passed, plus types/lint/OpenAPI375/routes439+4. No migration/model call.
Rendered 320/390/768/1440 acceptance pending; one optimized reused-cache build now
running, old owned 3167 preview stopped after identity check. Preflight 25.93 GiB
free, 21 GiB required. See docs/help-learn/WORKFORCE_HISTORY_W10.md. No publication.
Next dependencies remain independent-grant/baseline composition and granular care
authority, followed by canonical reviewed handoff and shared staffed transport.

27 October 2026 - P1 inventory reservation replay hotfix released to production.
Exact backend source 3bb51d21, based on the prior production runtime without the
unreleased reconciliation migrations, passed the focused real HTTP flow, seven
adjacent units, fresh isolated 72-migration replay, image/runtime tests, packaged
migration safety tests and exact-source GitHub safety/secret checks. All four images
were promoted by changing only their immutable digests in the existing app spec.
DigitalOcean deployment 71c5e9a7-bd3c-46c4-a503-cef24761837e is ACTIVE with
all four manifest digests matched; its read-only pre-deploy check succeeded and
API live/ready each returned 200. `/shop` redirects to `/parts`, which returned
200. No production migration, customer inventory write, provider payment call or
frontend deployment was made. A controlled real-role replay remains unverified.
Private prior/candidate app specs and provider receipts are retained for rollback.
See the hotfix branch's backend/docs/inventory-reservation-production-20261027.md.
P0 reconciliation recovery remains implemented/verified on a separate unreleased
branch; do not infer it from this hotfix deployment. Full Item 6 and role acceptance
remain open.

27 October 2026 - Revision 4 W10 local checkpoint: unsupported workforce history
preserved by bounded read-only contracts and revocation receipts; current grants
and mutation inputs remain strict. Nine native effective-access cases, 17 focused
frontend cases, full 1112 tests/167 files, source/scripts/frontend types and lint,
OpenAPI375/routes439+4 and one optimized cached build passed. Four final rendered
fixtures at 320/390/768/1440 passed with keyboard, Axe, overflow and no writes/errors/
external calls. Inspected mobile/desktop viewport screenshots; fixed test disclosure
and tall-element screenshot assumptions. No provider call, schema change, install,
new worktree or publication. Evidence: docs/help-learn/WORKFORCE_HISTORY_W10.md.
Exact-lock Next16.4.3 CI, hosted/real-role/device acceptance remain open. Independent
grant/account-baseline composition and granular care authority are next foundation
dependencies before persisted reviewed handoff and gated shared/staffed transport.
All 106 route completion gates remain open; full Revision4/Item6 stays active.

27 October 2026 - P0 reconciliation due-scan scale probe. The separate unreleased
reconciliation source was rechecked after the inventory hotfix release. A newly
created loopback-only PostgreSQL 18 `_ci` target replayed all 74 candidate
migrations with no Prisma schema difference. `EXPLAIN ANALYZE` on 50,000 synthetic
Paystack attempts/items measured 672 ms on the first all-matched scan and 330 ms
on the cached repeat (201,523 shared-buffer hits); one due attempt at the midpoint
took 159 ms (100,763 hits). This demonstrates linear scan work and gives a local
baseline, not production latency or financial correctness. Synthetic attempt
insertion bypassed parent FK checks only inside the disposable `_ci` target; the
container/storage were removed. No production database, provider, payment or
deployment change. See the reconciliation branch's
backend/docs/payment-reconciliation-recovery-20261027.md. Representative target
statistics/larger-volume assessment, explicit anomaly/hold operations, legacy
RUNNING inspection, provider sandbox, guarded migration and compatible rollout
remain open. Production backend currently runs the inventory-only hotfix.

27 October 2026 - P0 production-row inspection path checked. Current backend
deployment 71c5e9a7 remained ACTIVE with no pending rollout, readiness 200 and
reconciliation disabled. The existing DigitalOcean app-console route for its API
component returned provider HTTP 403 (not authorized). No remote command ran;
the database firewall, credentials, payment mode and production rows were not
changed or inspected. Do not infer that legacy RUNNING rows or holds are absent
from the older empty financial backup. Use an authorized read-only operational
route or reviewed hosted runner before the reconciliation cutover. Independent
live Contact enlarged-text/review sampling passed without a submitted request;
see the brand worktree's UI_UX_QUALITY_REGISTER.md. The product/service/vehicle
account-change result-reset gap in an older blocker list was source/test-inspected
and corrected as a stale note, avoiding duplicate implementation.

27 October 2026 - Revision 4 W11 local checkpoint: separate recognised active
owner grants compose with the managed boundary without widening branch duties.
Existing refund/dispute/privacy/financial-policy workspaces, current grant revision,
source eligibility, scoped notification links and stale-read/review disposal align.
Managed Admin uses the scoped refund queue and cannot recover broad legacy refund
inspection; owner/unenrolled legacy inspection and independent approval remain.
57 native HTTP/DB cases, 112 backend units, full 1114 frontend units and final45
focused cases, 18 populated role/width browser fixtures and11 history/session
regressions passed. Types/lint/contracts, final cached build and secret guard pass.
Known Next not-found CSS preload warning is verified/reported separately; full
route acceptance, hosted/device/screen-reader checks remain open. No schema/model
call, real message, install, new worktree or publication. W9 approval stays exhausted.
Evidence: docs/help-learn/WORKFORCE_INDEPENDENT_ACCESS_W11.md. C:25.79GiB free; Docker
retention reviewed without deletion, denied dev folders unchanged. Next: compatible
scoped BOOKING_CONFIRM and financial-aftercare adapters, then granular Care duties,
persisted reviewed handoff and shared staffed/gated transport. All106 completion
decisions and full Revision4/Item6 remain active.

27 October 2026 - P1 vehicle-payment history filter candidate. In the existing
compatibility worktree, merged current frontend 8fa386cb and backend 3bb51d21;
runtime 54e83b3f adds the owned vehicleTransactionId customer-payment filter and
uses it on purchase detail. Fresh isolated PostgreSQL 18 _ci replayed 72 migrations,
schema/db:check and one focused ownership/pagination service case passed; six
focused Edge page fixtures, types, lint, OpenAPI/routes, and exact-source GitHub
frontend 40445007425, backend 40445007397 and secret 40445007545 checks passed.
No production release or payment/provider action. Installed doctl has no usable
token, no Vercel CLI is installed, and connected browser automation is unavailable.
Backend-first deployment and authorized live-role acceptance remain open. See the
candidate backend/docs/customer-vehicle-payment-filter-20261027.md. P0
reconciliation and broader Item 6/Revision 4 remain open.

27 October 2026 - P1 Contact visit-preference correction prepared on the same
unreleased vehicle-payment-filter candidate branch. Runtime c54ef088 directs
missing date/time and overlong message errors to the actual field, clears stale
feedback during correction and exposes required preference controls. Eleven unit
cases, frontend typecheck/lint/format, isolated Edge browser review (desktop and
320px), and exact-source locked frontend 40448703220 plus secret 40448703167
GitHub checks passed. No real form POST, provider call, database/Docker change or
production promotion. The backend-first vehicle-payment release and hosted/real-
role acceptance remain open; wider public forms and physical-device QA remain.

27 October 2026 - Revision4 W12 local checkpoint: scoped booking confirmation
requires current BOOKINGS_READ branch scope AND separate BOOKING_CONFIRM. Shared
legacy capacity/calendar/assignment/schedule/version/audit/reminder guards retained.
Eleven scoped native,57 workforce/session/learning,11 legacy booking,59 backend units,
full1121 frontend and final34+35 focused cases passed. Twenty final responsive
fixtures at320/390/768/1440 and one actual browser/CSRF/API/restricted-CI-DB
confirmation passed. Fixed stripped recovery hints via explicit reviewed error codes
and narrow-detail label squeezing via detail-only stacked mobile facts.
OpenAPI376/routes440+4, generated types, types/lint/secret guard and final cached
build pass; exact-lock16.4.3/hosted/device acceptance remains open. No schema change,
model call, real message, install, new worktree or publication; W9 allowance exhausted.
Evidence: docs/help-learn/WORKFORCE_BOOKING_W12.md. C:25.56GiB measured free. Native
API stopped and synthetic browser session/cookie retired; existing frontend preview
retained. Docker resources preserved, denied dev-folder cleanup not retried.
Next: scoped financial-aftercare then granular Care permissions, persisted reviewed
handoff/shared staffed transport. All106 route gates and fullRevision4/Item6 active.

27 October 2026 - Active Revision4 W13 dependency: scoped financial aftercare.
Branch feat/workforce-scoped-aftercare-20261027 based on W12 e31af199, same checkout.
Fixture contracts preceded implementation. After fixture corrections, nine original
cases reproduced missing routes. Ten final scoped native cases now pass: FINANCE_READ
branch scope AND explicit FINANCE_POLICY_APPROVE, projection privacy, unknown JSON
evidence, immutable pricing/kind/status DB guards, fee/inspection checks, stale
evidence and mixed legacy/scoped concurrency. Existing legacy business core reused;
no stock/refund execution. HMAC review revision binds current stored evidence without
exposing raw policy settings. Legacy regression/contracts running. Frontend journey
is not implemented yet and remains required. No schema/provider call/publication.
See docs/help-learn/WORKFORCE_AFTERCARE_W13.md. Full Revision4 remains active.

27 October 2026 - Revision4 W13 local checkpoint: scoped financial aftercare
requires current FINANCE_READ branch scope AND separate FINANCE_POLICY_APPROVE.
Minimal queue/detail, current evidence HMAC, customer-visible reviewed decision note,
receipt verification and reload-safe uncertainty block implemented. Existing legacy
fee/inspection/immutable-data/audit rules retained; no stock/refund execution.
Final62 native across7 suites,60 backend units, full1130 frontend plus67 focused,
21 responsive Staff/Admin fixtures and1 actual browser/CSRF/API/CI-DB case passed.
OpenAPI379/routes443+4, generated types, types/lint/secret guard and cached build pass.
Evidence: docs/help-learn/WORKFORCE_AFTERCARE_W13.md. No schema/model call, real message,
install/new worktree or publication. W9 allowance exhausted. Native API/session/cookie
retired; frontend preview retained. C:25.43GiB measured free; Docker useful resources
preserved and denied dev-folder cleanup untouched. Next: granular Care permissions,
canonical reviewed persisted handoff and shared staffed/gated transport. All106
route learning decisions, exact-lock/hosted/device gates and fullRevision4 remain open.

27 October 2026 - P0 reconciliation reference-classification candidate. Branch
fix/reconciliation-reference-classification-20261027 at 9f4c9638 builds on the
unreleased reconciliation source. A provider response with a different reference
is recorded as STATUS_MISMATCH rather than MISSING_IN_PROVIDER;
the unallocatable provider amount remains excluded while confirmed local funds
remain in internal totals. A fresh loopback-only PostgreSQL 18 `_ci` target
replayed all 74 candidate migrations with no schema difference; 24/24 focused
integration cases, backend types, scoped lint and formatting passed. Exact-source
GitHub backend safety 40452332576 and secret guard 40452332536 also passed. The exact
task-owned container and tmpfs were removed. No provider, production database,
payment or deployment action occurred. See the branch's
backend/docs/payment-reconciliation-recovery-20261027.md. The measured linear
due scan, provider sandbox, hold resolution, legacy RUNNING inspection and
compatible guarded release remain open; payments stay disabled.

W13 final addendum: eleven focused scoped native cases pass after adding actual
enrolled-Admin positive/customer-history privacy acceptance; combined62 and focused11
receipts remain separate. C:25.41GiB final measured free; read-only Docker retention
review preserved useful/current/rollback/other-task resources. No cleanup or publication.

27 October 2026 - P0 reconciliation observation-write race corrected on the
unreleased worker branch. Its lease check/renewal and item insert now share one
database transaction, holding the run row through the write. A new isolated
PostgreSQL lock case reproduced the renewal-to-insert window and verified that
a second connection cannot claim the run during a blocked insert. Fresh `_ci`
replay of all 74 migrations had no schema difference; reconciliation 25/25,
adjacent Monnify 1/1, backend types, scoped lint and formatting passed. The
task-owned container/tmpfs were removed. No provider, customer, production
database or deployment action occurred. Exact runtime 13fa09d8 passed GitHub
backend safety 40453684995 and secret guard 40453684938. Due-scan scaling,
provider sandbox, hold resolution, legacy RUNNING inspection and guarded rollout
stay open.


27 October 2026 - Revision4 W14A contact boundary: Staff/Admin mixed-branch
Care authority no longer supplies contacts for a Sales-only case in another branch.
Natural expiry after a blocked record read is rechecked; inaccessible cases fail
closed and legitimate Sales reads remain redacted. Six focused native +57 existing
workforce/session/learning regressions,13 parser units and8 browser fixtures at
390/1440 passed; screenshots inspected with Axe/overflow/no-write assertions.
Source types, changed lint and cached build pass. No schema/model call/publication.
See docs/help-learn/WORKFORCE_CARE_CONTACT_W14A.md. C:25.32GiB free at last check.
Granular Care duties, persisted handoff/shared staffed transport and all106 route
completion gates remain open; fullRevision4/Item6 stays active.

27 October 2026 - P0 reconciliation due-state scaling candidate. The separate
unreleased branch fix/reconciliation-reference-classification-20261027 now has
runtime 1cb7b0b7. Additive migration 75 backfills an indexed due projection
from the latest completed observation; new attempts, later status changes and
atomic completed-run publication maintain it. Failed partial runs remain due;
terminal matches leave the scan until their state changes. A fresh isolated
PostgreSQL 18 `_ci` target replayed all 75 migrations with no Prisma difference;
27/27 reconciliation and 1/1 adjacent Monnify cases passed. A transaction-local
synthetic pre-existing-row fixture verified migration backfill. A separate
50,000-row projection-only EXPLAIN used the index: no due row 0.044 ms/six
buffer hits; one due row 0.066 ms/four hits. This is local plan evidence,
not provider or production latency. Backend types, scoped lint, formatting,
secret guard and build passed. Task-owned containers/tmpfs were removed;
no production/provider/payment/database write or release. Exact-source GitHub
backend safety 40457237952 and secret guard 40457237957 passed. Current
production backend remains inventory-hotfix-only;
current populated restore rehearsal, legacy RUNNING/holds inspection, runtime
grants, provider sandbox and protected compatible rollout remain open. See the
candidate backend/docs/payment-reconciliation-recovery-20261027.md.


27 October 2026 - Revision4 W14B local foundation checkpoint: immutable version1
retained; reviewed version2 adds independent Care view/reply/assign/live duties.
Business positions now have a separate fixed catalogue; CEO enrolment restriction
remains. Version1 delegated management remains usable and cannot acquire new duties
from unknown historical names. Explicit pinned requests/receipts, current previews,
MFA/password/reason/target/revision safeguards retained. Fixed reason loss on review
while preserving immediate password clearing. 45 native regression +final5 focused
policy cases,51 backend units, full1134 frontend plus29 focused/final12 component,
and8 final responsive fixtures at320/390/768/1440 passed with types/contracts/lint/
secret guard/final cached build. Screens inspected. No schema/provider call or
publication. See docs/help-learn/WORKFORCE_CARE_POLICY_W14B.md. C:25.20GiB measured;
Docker retained after read-only review. Next required: operational Care view/reply/
assign adapters and notification/help predicates before these new journeys are
declared usable, then canonical persisted handoff/shared staffed transport. All106
route completion gates and fullRevision4/Item6 remain active; W9 allowance exhausted.

27 October 2026 - P0 exact-candidate restored-snapshot migration rehearsal.
The hash/receipt-verified 26 October production archive was restored into a fresh
loopback-only PostgreSQL 18 `_ci` database. The protected db:migrate runner made a
new verified private exact-target backup and applied pending migrations 72-75;
its post-check and separate db:check passed. Sampled user/customer/branch/product/
service/notification and payment-attempt/run/item counts stayed unchanged, as did a
combined row fingerprint for the six populated business tables. The due-state
row count equalled payment attempts and 75 migrations were recorded. The first
disposable restore's verification query lost quoted SQL identifiers; it stopped
before migration and was removed. The successful attempt piped read-only SQL
through standard input. Both task-owned containers/tmpfs were removed. The new
backup/receipt inherited owner/Admins/SYSTEM-only ACL. No production database,
provider, payment, release or existing grant changed. The 26 October archive has
no financial rows and is not a fresh pre-cutover snapshot; current managed backup/
PITR, runtime DML grants, legacy RUNNING/holds, provider sandbox and compatible
guarded rollout remain open. See the candidate reconciliation recovery record.


27 October 2026 - Active Revision4 W14C operational Care adapters, branch
feat/workforce-care-case-adapters-20261027 based on W14B daaa2e2a. Initial8 native
cases reproduced7 missing behaviours; expanded12 now pass. Backend current branch
view/reply/assignment, checked eligible-handler pagination, complaint assignment,
notification recipients/revocation, lock-wait expiry and customer ownership verified.
Separate61 workforce/session/learning regressions pass across12 current templates.
Frontend scope/nav/read-only controls partially implemented;44 focused units pass.
Complaint assignment controls/shared candidates/pending recovery are in progress,
not accepted. New browser fixtures, help predicates, original browser regressions,
contracts/build/final review remain. Existing3167 preview serves W14B only. See
docs/help-learn/WORKFORCE_CARE_CASES_W14C.md. No schema/model call/publication.
FullRevision4, canonical handoff/shared staffed transport and all106 route gates active.

27 October 2026 - P0 payment-exception session-boundary candidate. The existing
Admin/Super Admin investigation queue was confirmed; its status write checked the
actor before, but not inside, the mutation transaction. Source 383cd077 on the
unreleased reconciliation branch now uses the existing locked current-account/
session/MFA check before reading or changing the anomaly. Three focused unit cases
cover revoked-session start/closure denial and a current-admin audited transition.
Backend types, changed lint/format, OpenAPI validation (365 paths) and diff checks
passed. No schema, financial record, provider or production deployment changed.
Exact-source backend database-safety CI 40460993538 and secret guard 40460993655
both passed. Reconciliation release gates above remain open.

27 October 2026 - P0 refund-approval atomicity candidate. Source 9e04031f on
the unreleased reconciliation branch eliminates a post-commit update: approving
a manual refund or online attempt without a captured provider transaction ID now
commits NEEDS_ATTENTION and OFFLINE_PROCESSING_REQUIRED with the approval/audit.
Provider-ready online refunds still commit APPROVED for the worker. A focused
transaction-double regression reproduced the old post-commit failure, then three
approval cases plus seven adjacent Phase 8 security units passed after the fix.
Backend types, changed lint/format and diff checks passed. No migration, provider,
financial record or production deployment was changed. Exact-source backend safety
CI 40462330861 and secret guard 40462330852 passed, including migration replay;
the CI workflow did not run the focused refund-processing integration suite.
Automatic approval review rejected a local task-owned PostgreSQL container run
for that suite with the stated reason `blocked by policy`; it created nothing.
Direct real-database refund-transition acceptance remains open. See candidate
backend/docs/refund-approval-atomicity-20261027.md; release gates remain open.

27 October 2026 - P0 manual-payment current-session boundary candidate.
The unreleased reconciliation branch now locks and rechecks the approver's
current account, session, expiry and MFA inside the manual-review transaction
before payment read, decision, settlement or audit. Two revoked-session units
passed locally; the updated concurrent-review fixture uses real isolated test
sessions and retains the one-decision/one-ledger/one-audit assertions. The first
CI run exposed a fixture-only MFA timestamp constraint error; a single shared
creation/verification timestamp corrected it. Exact runtime 768012a7 passed
GitHub backend safety 40464788011, including both isolated database race cases,
and secret guard 40464787921. Local types, scoped lint/format and adjacent units
passed. No provider, financial record, application database or production release
was changed. Real-role acceptance and P0 reconciliation release gates remain open.

27 October 2026 - P0 refund request/decision current-session boundary candidate.
The same unreleased reconciliation branch now locks and rechecks the current
operator/approver session, expiry and MFA inside both refund request and approval
transactions before replay lookup, refund read, capability recheck or writes.
Requester-bound replay, branch checks, independent approval and refund worker
remain intact. Revoked-session units first reproduced the gap and then passed.
The Phase 8 and Monnify direct-service fixtures now use real isolated sessions.
Exact runtime e74d4ae7 passed GitHub backend safety 40465987685, including
two real-database payment flows plus five focused refund units, and secret guard
40465987682. Local combined session/approval units passed 10/10; types, scoped
lint and formatting passed. No production database, provider, payment/refund or
release changed. Provider sandbox, production-role acceptance, legacy holds,
managed recovery checks and compatible guarded rollout remain open.


27 October 2026 - Revision4 W14C local checkpoint: operational Care view/reply/assign
intersect on the actual branch. General enquiries and complaints use canonical
reviewed assignment with checked eligible-handler pagination, CAS/audit/notifications.
Read-only controls, current help/practice predicates, public/internal separation,
revocation and reference-only uncertainty recovery implemented; unsent cross-action
drafts retained after verified success. Final14 native+61 regressions,21 backend
units, full1145 frontend/171files+36 focused,36 new responsive and50 legacy browser
cases pass. One real browser/CSRF/API/restricted-CI-DB flow saved2 assignments and
2 public replies,4 audits,zero internal messages,unchanged inventory/bookings.
OpenAPI381/routes445+4,types/lint/secret3260/correctly configured cached build pass.
Screens inspected; synthetic sessions revoked/cookie removed. No schema/provider
call,real delivery or publication. Evidence: docs/help-learn/WORKFORCE_CARE_CASES_W14C.md.
FullRevision4 remains active: next canonical reviewed persisted Allie handoff, then
shared staffed/gated transport and all106 exact route-learning decisions. W9 allowance
exhausted; new Care guidance has no actual-provider re-evaluation. Exact-lock16.4.3,
hosted/actual-role/device/screen-reader gates stay open. Useful Docker/caches retained.

27 October 2026 - P0 reconciliation scheduler and refund DB follow-up.
The candidate scheduler was re-inspected rather than rewritten: it selects the
oldest persisted due attempt per provider, rechecks incomplete/failed periods
and processes a bounded window per minute after restart. Existing isolated
cases cover two historical windows across a new worker instance and exact failed
period retry. The older scheduler-gap note describes prior production source,
not this candidate; production remains on the inventory-only backend hotfix.
The earlier local refund DB run was rejected by automatic command review, so
the existing real-database `refund-processing` suite was added to exact-source
GitHub isolated `_ci` safety CI. Both cases passed on runtime 70f5615a; the
manual approval case now checks committed NEEDS_ATTENTION, offline-processing
reason and approver in PostgreSQL. Backend safety 40466928896 and secret guard
40466928798 passed. Live API readiness was 200 read-only. No local Docker,
application/production DB, provider, payment or deployment action occurred.
Provider sandbox, live financial backfill/holds, current recovery/grants and
guarded compatible rollout remain open.


27 October 2026 - Revision4 W15A backend-only checkpoint: reviewed canonical
asynchronous handoff contracts implemented. Current customer identity/CSRF, exact
keyed review, selected owned customer help excerpts, branch/target/version and
24-hour owner/payload-bound receipt. Canonical Enquiry/Complaint/SupportMessage
reuse; atomic audit/notification/context ending, no second inbox or schema change.
Final14 focused native and109 combined legacy/support/Allie/session/Care cases,
70 provider/state/guidance units+51 workforce units, OpenAPI384/routes448+4, types/
lint/secret guard pass. No actual-provider call, real delivery or publication.
Frontend handoff is unfinished; next implement review/edit/cancel/recovery/draft
preservation and responsive/native browser acceptance. Preview3167 is W14C only.
See docs/help-learn/REVIEWED_HANDOFF_W15.md. FullRevision4/shared staffed transport/
all106 route gates remain active; W9 provider allowance stays exhausted.


27 October 2026 - Revision 4 W15 reviewed Customer Care handoff checkpoint: customer review/edit, explicit selected help sharing, canonical new/existing support persistence and encrypted session-bound recovery are implemented locally. Browser storage retains only an operation ID; uncertain results block a new operation, and cancellation preserves a case already saved. AI-off/guest/workforce boundaries and separate drafts remain intact. Accepted evidence: 116 distinct native cases across seven suites (115 broad plus the revised 11-case learning run), 84 Allie backend units, full 1,161 frontend tests in 173 files, 32 distinct browser fixtures and one actual browser/CSRF/API/restricted-CI-DB composition. That composition saved one enquiry and one complaint reply, two audits, preserved an internal note and left inventory/bookings unchanged. OpenAPI 385 paths / 450 operations plus 4 infrastructure routes, generated contracts, types/lint/secret guard and optimized build pass. See docs/help-learn/REVIEWED_HANDOFF_W15.md. No schema, provider call, real delivery or publication. Temporary native sessions revoked/cookie removed; C: measured 23.34 GiB free; useful Docker/cache resources retained. Full Revision 4 remains active: shared staffed/gated transport, operational readiness and all 106 exact-route acceptance decisions remain open. The owner authorised a reviewed committed release before the session limit; reconcile newer live frontend/backend fixes and complete the migration-73/backup/restore/exact-lock/hosted gates before publication.



### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/customer-vehicle-payment-filter-20261027; it is not a claim of current production identity.

Details and limits: frontend/docs/BRAND_ASSETS_R2_REPORT.md. Physical devices,
actual zoom, screen reader, authenticated role acceptance and broader Item 6
remain open. Docker resources retained; C: postflight 27.08 GiB free.
26 October 2026 - payment-source expiry correction released from runtime
`2033b159`. DigitalOcean deployment `3cb61958-e460-494b-ae29-1ce826ac22b9`
is ACTIVE with no in-progress rollout; all four component digests match the
reviewed registry manifest. The existing-app proposal changed only those four
digests. Its read-only predeploy database checker and all 16 deployment steps
succeeded. Direct API live/ready and apex readiness returned 200; anonymous
session/payments returned 401. Public Home, Parts and Help returned 200, `/shop`
redirects to `/parts`, and `www` redirects to the apex. No frontend rollout,
schema migration, production business DML, provider transaction or grant change.
Eight managed backups were present, latest 26 October 05:22:11 UTC; the prior
separate 25 October 18:03:19 UTC restore rehearsal was reused. Exact-source
local gates included 48 integration cases, nine image tests, OpenAPI/routes,
types, lint, format, script/configuration checks and secret guard. GitHub PR
creation returned 403, so PR-triggered locked CI is not claimed. Full details
and limitations: `payment-source-concurrency-20261026.md`. Real-provider and
authenticated-role acceptance, broader Item 6 and site completion remain open.

26 October 2026 - post-release payment-source transition verification. The
runtime deployment above remains unchanged. Six new isolated PostgreSQL races
held a valid invoice-void or vehicle-cancellation source-row transition while
intent creation, online initialization and manual evidence each waited, then
rejected the changed source without a new intent or attempt. Three adjacent
integration files passed 38 tests; 71-migration replay, schema comparison,
`db:check`, backend typecheck and targeted lint/format passed. The first vehicle
fixture was corrected to satisfy the existing cancellation timestamp/reason
constraint; no application code, schema, provider or production business record
was changed. These tests model the status transition directly; actual operator
service races and real-provider acceptance remain open. See
`payment-source-concurrency-20261026.md`.

26 October 2026 - actual invoice and vehicle operator-service lock order was
verified locally after incorporating the newer `c4e0005d` workforce runtime.
`BillingService.void` and `VehicleSalesService.transition` each held the real
source-row lock while intent creation, online initialization or manual evidence
waited, then committed; all six actions rejected the cancelled source with no
new payment or attempt. Fresh isolated
`_test` PostgreSQL replayed all 72 migrations with no schema difference and
passed `db:check`; the adjacent set passed 44 tests, with backend typecheck,
targeted lint and format passing. This test-only work needs no runtime rollout.
Provider sandbox and real-role acceptance remain open. The newer `c4e0005d` runtime is recorded in the main
checkout tracker and includes the earlier payment fix. See the payment-source
release record for exact scope.

26 October 2026 - the historical refund replay authorization blocker was
rechecked against current code and HTTP behavior. Existing refunds are returned
only after matching the original requester and exact input, followed by branch
access; STAFF and MFA-unverified administrators cannot request a refund. One
focused route/integration case passed on a fresh native loopback `_test` cluster
after 72-migration replay and `db:check`; three explicit denied-role POST checks
were added. A Docker NAT direct-host guard correctly blocked the first attempt,
so it was not counted as test acceptance. No runtime/provider/production financial
write was made. Provider completion and real-role acceptance remain open. See
`refund-replay-authorization-20261026.md`.
The native test server was stopped; automatic command review blocked removal
of its 76,629,829-byte task directory, which remains in Temp. C: postflight
was 28 GiB free; original Docker volumes were retained.

26 October 2026 - password-change session-rotation defect corrected locally.
The new password, other-session/reset-token revocations, audit, notification
and current-session rotation now share one locked transaction. A failed
post-rotation step rolls all of them back; a second request with the old
credential/snapshot is rejected. A fresh native loopback `_test` database
replayed all 72 migrations with no schema difference and passed `db:check`.
Two new deterministic races, the full identity HTTP flow, 20 MFA integration
cases, five identity unit cases, types, targeted lint and format passed.
No schema/frontend change or production deployment has yet occurred for this
candidate. See `password-change-atomicity-20261026.md`; real-role/browser
acceptance and the separate sign-in challenge rotation gap remain open.

26 October 2026 - password-change atomicity correction deployed.
Runtime 3ec9c822, backend deployment 96ffc790-f572-49f4-9047-3ae6cb30469e
ACTIVE. The four image digests match the release manifest; the non-image app
spec is unchanged. Exact-source backend check passed 577 default tests (1,117
intentional database skips), with focused isolated transaction/HTTP cases
separately passed; nine image checks and a packaged isolated migration/restore
check passed. Production PRE_DEPLOY database checker and all component steps
succeeded. Direct and domain liveness/readiness returned 200, anonymous session
401, /shop 308 to /parts, /parts 200. Eight managed backups through 26 October
and the retained separate populated 90-table restore evidence were reviewed.
No schema migration, grant, production business write or frontend release.
Authenticated role/device acceptance and sign-in challenge rotation remain open.
Release detail: backend/docs/password-change-atomicity-20261026.md in the
compatibility release worktree. Previous deployment 707a200f remains the
immediate rollback candidate subject to compatibility review.

26 October 2026 - sign-in MFA challenge rotation defect corrected locally.
TOTP, recovery-code and WebAuthn proof consumption now commits with session
assurance/token rotation after account/session/CSRF recheck. Three injected
post-rotation failures roll back all proof and session state; concurrent use
of one recovery code admits one request. A fresh isolated native loopback
`_test` database replayed 72 migrations, schema/db:check passed, and four new
transaction cases plus identity HTTP and 20 adjacent MFA cases passed. Full
backend check passed 577 default unit/API tests with 1,121 database-gated skips;
OpenAPI/routes, types, lint, format, scripts and secret checks passed. No
schema, route or frontend runtime change. Deployment and genuine browser
WebAuthn/real-role acceptance remain open. Detail:
backend/docs/mfa-challenge-atomicity-20261026.md.

26 October 2026 - complete colour/state brief, local implementation checkpoint.
Branch feat/colour-states-20261026 in allied-shop-vehicles-r2-20261025, based on
3cea520f / released runtime 8c11c3a0. Shared black/red/white tokens, branded
marketing/navigation/Allie gradients, contextual focus/selection and semantic
statuses are implemented; approved imagery and white operational surfaces remain.
No backend, schema, permission or business mutation changed. 1,053 units, lint,
typecheck, optimized build and 30 contrast pairs passed. Browser evidence accepts
324 distinct cases across 118 files; three optional cart-drawer cases unexecuted.
Firefox/WebKit, native autofill/pickers, physical devices and full screen-reader
acceptance remain unverified. Exact coverage, initial harness corrections, safe
screenshots and remaining limits: frontend/docs/COLOUR_AND_STATE_REPORT.md and
colour-browser-coverage.json. No push/deploy under this brief. Other worktrees,
Desktop edits and the separate workforce/Allie scope are preserved. Broader site
completion Item 6 remains open. Task servers stopped after checks; no Docker
resources created/deleted; final disk preflight 28.15 GiB free.

26 October 2026 - owner-authorised colour/state release deployed.
Runtime d6d8534d preserves deployed workforce/payment source c4e0005d and adds the
black/red/white presentation. Vercel dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD READY;
both apex/www aliases verified. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a
remains ACTIVE and unchanged. All three exact-source CI gates passed, including
1,057 units, zero production audit vulnerabilities and isolated 72-migration
replay/db:check. 39 hosted fixture cases and 12 post-promotion public checks passed;
independent www and backend health reads passed. Formatting/hydration harness
corrections and explicit device/native/three cart-drawer limits are documented in
backend/docs/colour-production-20261026.md. Managed backups and retained populated
restore proof verified; no new restore, production DB command or business write.
Prior frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln retained for compatible rollback.
Other worktrees and Desktop edits preserved; no Docker cleanup; C: 27.86 GiB free.
Broader site completion Item 6 and the separate workforce/Allie roadmap remain open.

26 October 2026 - colour and brand assets Revision 2 local checkpoint.
Branch feat/brand-assets-r2-20261026 in allied-shop-vehicles-r2-20261025, based on
ce3121b8 / released d6d8534d. All nine supplied files inspected and original hashes
preserved; five pixel-identical logo crops and nine responsive WebP posters prepared.
Shared red/white/black marks, Home trust/service artwork, About portrait and Services
workmanship implemented. Ad 4 withheld: nationwide delivery contradicts collection
policy; clean corrected artwork is a business/source dependency. No policy changed.
1,057 units, lint/types/build/format and 30 contrast pairs passed. 103/109 broad
fixture browser cases passed; six await optimized replay (three development loading/
navigation failures and three Help/Learn tests with the local flag disabled). The
three prior cart gaps passed in focused checks; real Strict Mode dialog cleanup and
pre-hydration image-error handling repaired. Final local preview start was rejected
by automatic approval review, reason only "blocked by policy"; specific local-only
approval requested and pending. No bypass, push, deployment or database command.
See frontend/docs/BRAND_ASSETS_R2_REPORT.md and brand-assets-r2-coverage.json for
exact evidence, missing clean recaptures, platform limits and reused dependency
version discrepancy. Both live domains still dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD.
Other worktrees and unrelated edits preserved; broader Item 6 remains open.

27 October 2026 - brand assets and mobile support placement deployed.
Final frontend source 8433ff57, Vercel dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ
READY on both apex/www; previous dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD retained
for rollback. Owner-supplied transparent marks and three truthful artworks are
live; Ad 4 remains withheld because nationwide delivery is not approved. The
fixed mobile support dock previously covered 31px of the Tyre Change branch
field at 320px; live field hit-testing and Allie open/close now pass with an
in-flow support strip. Locked frontend and secret CI, protected hosted
artwork/role fixtures, seven public read-only production route samples,
backend readiness and exact alias identity passed. Backend 50b5f5d1 remains
ACTIVE; no schema, payment, business write or provider change. Managed backups
and the prior separate populated 90-table restore receipt were reviewed.
Details and limits: frontend/docs/BRAND_ASSETS_R2_REPORT.md. Physical devices,
actual zoom, screen reader, authenticated role acceptance and broader Item 6
remain open. Docker resources retained; C: postflight 27.08 GiB free.


27 October 2026 - Workshop location and public Whatsapp label release. Frontend source
42855c0d is READY on Vercel dpl_JDtwMW41Nk8fxMDP7ak2U6WTwo5h; both apex/www
aliases independently verified. Hosted Edge Contact at 390px showed the full
owner-supplied address, no visible phone digits and the Whatsapp footer link.
Frontend CI 40474302615 and secret guard 40474302279 passed; local lint/types,
focused units and ten route/viewport checks passed.

Backend source 0fd68980 on fix/workshop-contact-backend-20261027, reusing
allied-inventory-replay-release-20261027, builds directly on current production
3bb51d21. DigitalOcean 79d7a0ac-4e83-4b73-ae46-40af4731a604 is ACTIVE with
all four immutable digests verified. Only those digests changed in the existing
app spec. Backend safety CI 40474496504 and secret guard 40474496554 passed;
28 focused units and ten packaged image/database tests passed, including a
fresh isolated replay and separate local restore. Existing 8 managed backups
(latest 2026-10-27T05:22:11Z), encrypted off-device retention/PITR evidence and
the successful 26 October separate managed-target rehearsal were reviewed.
No production migration, explicit customer-data write or message was sent.
Historical snapshots/migrations remain intact; old approved collection-policy
addresses remain readable. Prior frontend dpl_24sXMLFwUuX6ag8PqMTtGaVH2xPh
and backend 71c5e9a7-bd3c-46c4-a503-cef24761837e are retained for rollback.

The subsequent owner request is now in progress in the same frontend worktree:
fixed mobile support dock, Allie scrollbar treatment, breadcrumb/anchor page
entry and linked selection targets. This is a separate finite shared-UX cycle;
no claim of exhaustive role/device acceptance.


27 October 2026 - Revision 4 W15 reviewed Customer Care handoff checkpoint: customer review/edit, explicit selected help sharing, canonical new/existing support persistence and encrypted session-bound recovery are implemented locally. Browser storage retains only an operation ID; uncertain results block a new operation, and cancellation preserves a case already saved. AI-off/guest/workforce boundaries and separate drafts remain intact. Accepted evidence: 116 distinct native cases across seven suites (115 broad plus the revised 11-case learning run), 84 Allie backend units, full 1,161 frontend tests in 173 files, 32 distinct browser fixtures and one actual browser/CSRF/API/restricted-CI-DB composition. That composition saved one enquiry and one complaint reply, two audits, preserved an internal note and left inventory/bookings unchanged. OpenAPI 385 paths / 450 operations plus 4 infrastructure routes, generated contracts, types/lint/secret guard and optimized build pass. See docs/help-learn/REVIEWED_HANDOFF_W15.md. No schema, provider call, real delivery or publication. Temporary native sessions revoked/cookie removed; C: measured 23.34 GiB free; useful Docker/cache resources retained. Full Revision 4 remains active: shared staffed/gated transport, operational readiness and all 106 exact-route acceptance decisions remain open. The owner authorised a reviewed committed release before the session limit; reconcile newer live frontend/backend fixes and complete the migration-73/backup/restore/exact-lock/hosted gates before publication.


27 October 2026 - visual-audit frontend batch released. Runtime a1b8ce45 preserves
concurrent Contact/location source 42855c0d and publishes customer clarity and sparse
Home fixes. Vercel dpl_GKfQv1k4cD5qTKZj3c6LaP8Y4iqz READY on both domains.
Exact locked frontend CI 40478325501: 1072 units, lint/types/format/build and zero
production audit vulnerabilities; secret guard 40478325469 passed. Same backend
source at e925ecec passed isolated safety CI 40476605252. Hosted fixture acceptance
7 new plus 35 regressions passed; 14 candidate and 14 production public read-only
checks passed at 390/1440 with zero mutations/page exceptions. Backend remains
79d7a0ac-4e83-4b73-ae46-40af4731a604 ACTIVE/readiness200. No DB/worker/provider write.
Session-label and new homepage-help backend changes remain committed, not released.
Full V01-V55 goal remains active; next Shop discovery/detail and empty overview.
Evidence/rollback: backend/docs/visual-audit-frontend-production-20261027.md and
frontend/docs/VISUAL_IDENTITY_AUDIT_CHECKPOINT.md. Existing other-task edits preserved.


27 October 2026 - Shared support/viewport UX released. Concurrent frontend source
a1b8ce45 went live while the earlier candidate was gated. The ancestry guard
rejected promotion; the UI change was integrated onto that exact newer source
and its homepage/customer-interface changes were preserved. Runtime fbb6565a
on fix/mobile-navigation-current-20261027 is now READY as Vercel
dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq, independently verified on apex and www.
Immediate compatible frontend rollback is dpl_GKfQv1k4cD5qTKZj3c6LaP8Y4iqz.
The earlier f61ccc51/5063c844 candidates were never promoted.

Exact-runtime frontend CI 40480113708, secret guard 40480113700 and backend
safety 40480113595 passed. Integrated focused units passed 36/36. The integrated
browser matrix passed 13/14 initially; the remaining check incorrectly required
native browser focus restoration after a direct hash navigation. Test-only
7eefc123 preserves explicit clicked-link focus checks and verifies actual target
visibility for native hash navigation/reload; both 390/1440 rechecks passed. All
14 distinct final scenarios are covered across those runs, not one clean
integrated invocation. Runtime/app/config/public-asset trees are identical to
the green fbb6565a build. No additional runtime build was needed for that
test-only correction.

Post-promotion live Edge at 390/1440 passed fixed-dock geometry through scrolling,
real reviewed Allie search, hidden scrollbar with native scrolling, modal-to-Help
navigation with visible breadcrumbs, and Contact vehicle radio/visit checkbox
targets. Both had zero page errors and zero attempted API writes. Public address
and Whatsapp labels remained correct; public capabilities returns the full new
address. Backend 79d7a0ac-4e83-4b73-ae46-40af4731a604 remains ACTIVE; API live
and ready returned 200. Receipts/screenshots: %TEMP%/allied-viewport-promotion.json,
allied-viewport-live.json, allied-viewport-live-390.png and allied-allie-live-390.png
(and matching 1440px captures). Physical devices, native mobile keyboard, full
screen-reader and exhaustive real-role acceptance remain unverified. No real
message, support request, payment or production migration was performed.

Docker image/database tests removed their own disposable containers/network;
the original 13 stopped containers and 14 volumes remain. The four new current
release images and useful warm build cache are retained; no Docker cleanup or
physical-byte reclamation is claimed. Final disk preflight and temporary server
shutdown are part of this task closeout. Preserve Item 6 and the settled queue.


## Historical master notes retained during 28 October reconciliation

These are prior observations from the merged master history, not current deployment
claims. Current provider identity must be checked before any rollout.

Main/www frontend: `dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3` (READY);
  backend: `1876e3d1-ab99-4e26-8a58-1ea4fcb0d46a` (ACTIVE), 25 October 2026.
  Preserves preferred Home, reviews, R2, audit fixes and all 70 migrations.
  Recheck actual provider state before another rollout. Detailed evidence is
  `backend/docs/notifications-experience-20261025.md` in that worktree.

- Earlier backend observed: `5c1ea9a7-6211-46d2-995f-c45e504bf9e9` (ACTIVE)
  from the discovery/fitment release.
- Earlier frontend observed: `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` (READY),
  assigned to both main and www domains on 24 October 2026. Recheck before changes.

24 October audit continuation: read-only live Parts search updated the URL and active filter correctly, with a clear no-match state against the currently empty public catalogue. The live guidance still referred to purchase and cart use under the approved browse/enquiries mode. The current release worktree now has mode-aware Parts guidance and neutral filter copy; targeted lint and TypeScript checks passed. A local enquiry-mode page returned 200, and its browser snapshot confirmed the wording and filter dialog. The local API was not running, so this did not validate product data or suggestions. No production change was deployed; all previously recorded financial, role, catalogue-content and owner-decision gates remain open.

Parts filter source review found mappings and backend predicates for the visible search, category, brand, fitment, price, featured, availability and sort controls. Actual result correctness still requires approved real product records or isolated fixtures; no fake public listing was created.

24 October P0 financial follow-up: isolated refund suites passed 49/49. A later
direct-network test runner used a new, disposable PostgreSQL 17 `_test` database
on `127.0.0.1:5432`, confirmed before writes, and replayed all 62 migrations
with no Prisma schema difference. Paystack and Monnify were disabled. The
work-payments and reconciliation suites passed together, 22/22 tests. The
1,003-attempt case had first passed alone in 14.97 seconds; its test-only
deadline was changed from 20 to 60 seconds to tolerate shared-suite load.
The disposable database was removed. No application database or live money
action was used. Provider settlement, authenticated role acceptance, catalogue
content and owner/operational decisions remain open. The user has now explicitly
authorized production deployment of completed work without another permission
request, while keeping live payments disabled until Paystack is configured.

## Local Docker disk maintenance - 24 October 2026

This separate maintenance task does not close Item 6 or change the release source,
deployment, outstanding decisions or acceptance gates above. The current worktrees,
release runner, local Docker context and actual active/pending DigitalOcean releases
were inspected before selecting resources. Current component digests, the two prior
successful production releases, linked-worktree builds, recent images and all images
referenced by running or stopped containers were protected.

Removed 49 confirmed superseded local project images using exact references without
force. Docker image storage fell from 14.18 GB to 10.3 GB. Also removed the exact
stopped, unregistered BuildKit container and its verified build-cache-only volume
(approximately 1.95 GB). Combined logical Docker storage reclaimed was about 5.8 GB.
The conservative inactive/unshared cache prune reclaimed 0 B; 4.398 GB of reusable
builder cache was retained. No blanket prune, image archive, new build or pull was
used. All 33 retained image IDs, all 13 original database containers and all original
database volumes were verified afterward. No application/database volume was removed.

Windows C: free space measured approximately 19.57 GB before and 19.79 GB after;
concurrent local work means that difference cannot be attributed solely to cleanup.
Docker's VHDX logical length stayed 32,284,606,464 bytes. The 5.8 GB figure is Docker
storage reclaimed, not a claim of equivalent Windows physical disk recovery. Docker
and WSL were not stopped and no manual VHDX compaction was attempted.

Mandatory retention-aware disk hygiene is now in `AGENTS.md` and
`backend/docs/docker-disk-hygiene.md` in this checkout and the active
`allied-email-evidence-20261023` and `allied-discovery-fitment-20261023` worktrees.
Existing code and pending work were preserved. Small, secret-free before/after and
removal receipts are in `%TEMP%/allied-docker-cleanup-20261024`. Documentation diff
checks passed. No application tests, database writes, migrations, backup/restore
tests, deployments or remote registry deletions were performed for this maintenance.


## Latest production handoff - discovery/fitment, 24 October 2026

This later observation supersedes earlier live-source pointers above while
preserving the independent audit checkpoints and the settled site-completion queue.
Current release worktree: C:/Users/PC/.codex/worktrees/allied-discovery-fitment-20261023,
branch feat/discovery-fitment-20261023, verified code 7bb485b8 (pushed). Backend
images are from 59d5141b; frontend source e2143b56. Backend deployment
5c1ea9a7-6211-46d2-995f-c45e504bf9e9 is ACTIVE, 16/16 steps successful.
Vercel dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr is READY and separately verified on
alliedautotech.com and www.alliedautotech.com. Recheck actual provider state before
choosing source for another release; the older email-evidence worktree's pending
audit/copy changes were not silently deployed or discarded.

Final checks: 1,422 backend tests passed, 156 intentional skips; 985 frontend tests
plus lint/types/build/format passed; 168 combined browser scenarios passed with
zero failures/skips/flaky results; both production audits reported zero
vulnerabilities. GitHub frontend release, database safety and secret guard passed.
A new empty isolated _ci target replayed all 64 migrations. An actual restore of
a fresh production archive into a separate new _ci database verified 86 tables,
then rehearsed the two additive migrations with existing rows preserved. Production
used only the protected db:migrate runner with another fresh verified backup;
db:check, runtime privilege/schema checks and restoration of the app-only firewall
passed. Existing data/grants and staging were preserved. Eight live backend GET
checks passed. Existing launch/payment/provider policy remains in place.

The vehicle/parts filters, category hierarchy, reviewed fitment, saved garage and
notification context/read-state requirements are live. Full evidence is in the
release worktree's backend/docs/discovery-fitment-release-review.md. Item 6 and
the remaining site queue retain their recorded scope; synthetic tests do not
supply real manufacturer evidence or close staff/media acceptance. Independent
main-checkout edits and audit work are preserved. Only this handoff was appended.

25 October 2026 - owner-requested local disk cleanup:
Removed 5,542,707,536 bytes of verified redundant files: 1,780,236,350 bytes
of cached installers from an inactive temporary editor-test profile, and
3,762,471,186 bytes (108 files) of superseded webpack compiler caches across
seven older worktrees. Source worktrees, uncommitted changes and current/rollback
caches were preserved; source Git statuses were rechecked. Installed Codex,
sandbox runtime/state, settings, session/history stores, dependencies, database
folders/volumes and backups were retained. No database command or application
code change was performed. Free C: space measured 11,313,684,480 bytes immediately
before cleanup and 16,812,593,152 bytes at final verification; concurrent activity
means the change differs slightly from the sum of removed file lengths.

Reviewed five stale unshared Docker cache records and ran the documented bounded
24-hour native prune, excluding shared/in-use/package-cache records. It reclaimed
0B. All 38 images/11.84GB, 13 containers, 14 volumes/1.012GB and 6.715GB cache
remain. No blanket prune, image/volume removal or Docker/WSL disk operation ran.

Automatic approval review rejected recursive removal of the inactive temporary
extension copy at C:/Users/PC/AppData/Local/Temp/codex-ui-test-20261024-150755/extensions
(4,770,580,255 bytes), including after the owner explicitly approved that exact
path. It remains. Removal of this task's superseded local .next dev/standalone
output was also rejected as blocked by policy; no alternate deletion was used.
The successfully removed installer archives are separate files, not the installed
extension. Detailed filesystem audit/target/cleanup receipts are under %TEMP%
with allied-disk-* and allied-cleanup-* names dated 20261025. The existing hygiene
document and main AGENTS now also cover local builds and editor-test copies.

25 October 2026 - owner explicitly approved deleting the 143,481,750 bytes of superseded generated output in allied-home-restoration-20261025/frontend/.next while retaining cache/source/dependencies. Rechecked the exact folder and confirmed no Next.js process uses it; application worktree remained clean. Automatic approval review again rejected the bounded native deletion before execution as blocked by policy. No output was removed. The owner's authorization is recorded; do not request the same permission again or evade the tool restriction.

25 October 2026 - staff vehicle filters released from the current backend source:
`C:/Users/PC/.codex/worktrees/allied-staff-vehicle-current-20261025`, branch
`fix/staff-vehicle-filters-current-20261025`. Runtime commit `ff42b0e2` and
release receipt `1e1b6152` are pushed. Production DigitalOcean deployment
`f9239c36-d4b7-4ef0-b8ba-479cda926a13` is ACTIVE with API digest
`sha256:6ceab2563f0f15dc6b877aac02de89542113e98f5079c9d85803b383a7bbafb3`;
both workers and the predeploy job retain their prior digests. Its build, deploy,
component and read-only predeploy job steps succeeded. Live readiness, public
products and public vehicles returned 200; anonymous staff vehicles returned 401.
The API fix had passed 3/3 isolated staff-stock integration tests and a complete
isolated migration replay on the exact deployed source. Today's managed backup
and the previous separate restore evidence were reviewed; the API-only rollout
did not write to the application database. Hosted authenticated staff-filter
acceptance remains open until a suitable QA login is available. See the release
receipt in the fix branch's copy of this tracker for exact scope and limits.

25 October 2026 - audit A01-A07 implementation checkpoint:
Current implementation branch fix/audit-actions-20261025 reuses the existing
allied-home-restoration-20261025 worktree and caches. Combined source b45513f1
preserves bb92ca52 preferred Home and the ff42b0e2 active backend filter fix;
main-checkout user edits remain separate. All seven findings were revalidated
against source and isolated rendered fixtures. The 31-case responsive matrix
passed; additional recovery, permission, text-enlargement and regression checks
are being completed. Current production remains dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU
and ACTIVE f9239c36-d4b7-4ef0-b8ba-479cda926a13. No publication or real operational
write is part of this batch. See Cycle 6 in the release worktree's quality register
for scope, current acceptance and remaining checks. Preserve the disk-cleanup
approvals/rejections and existing database/Item 6 constraints recorded above.

25 October 2026 - owner-requested disk reserve and bounded cache maintenance:
The Desktop checkout owns the shared Git history used by 23 linked worktrees.
Several worktrees have uncommitted changes or release/policy evidence; all were
retained, together with installed/shared dependencies and active development.
No repository consolidation, application change or deployment was attempted.

Native `npm cache npx rm` removed seven explicitly reviewed inactive entries:
2778af9cee32ff87, ce0d8c019a05051b, 69c381f8ad94b576, 420ff84f11983ee5,
5fdb855d8f7e0fd1, cc2145a2fe1558fa and 1d6e82a4126006c4. These contained an
unused Prisma 8 prerelease, superseded Vercel 65.1 and old disposable test/setup
tools; current project Prisma 7 and useful current CLI/MCP caches remain.
Removed entry file lengths totalled 1,187,310,775 bytes. `npm cache verify`
then garbage-collected 1,110 unreferenced blobs / 2,436,362,178 bytes and verified
3,471 retained cache entries / 1,899,363,748 bytes. Total logical cache removal:
3,623,672,953 bytes. Host C: free space rose from 22,592,446,464 to
26,330,132,480 bytes (24.52 GiB); concurrent activity and allocation accounting
mean the host-space change differs from the removed file lengths.

The owner's mandatory 20 GiB reserve is recorded in global/repository instructions
and docker-disk-hygiene.md. Shared read-only checker:
C:/Users/PC/.codex/scripts/assert-disk-space.ps1. Default expected growth is 5 GiB,
requiring 25 GiB free before substantial writes; justified growth estimates can
vary, but the 20 GiB reserve cannot be reduced. Actual-space pass, insufficient-
space block and unverifiable-target block were tested (exit codes 0/1/1).
This is an agent preflight, not a background service or machine-wide quota.

Automatic approval review rejected the proposed removal of compiler-pack files
in allied-catalogue-care-ux-20261024 and allied-home-discovery-20261025 as
"blocked by policy" before execution. No compiler files were removed and no
alternate deletion was attempted. Prior deletion rejections remain in force.
Docker stayed at 38 images / 11.84 GB, 14 containers, 14 volumes / 1.012 GB and
87 cache records / 6.715 GB; Docker-reclaimed space was 0 B. No database command,
backup, restore rehearsal, grant change, image build, new worktree or dependency
installation ran. Existing source/uncommitted work, databases, backups, secrets,
history and useful current/rollback resources were preserved. Small inventory
receipts are under %TEMP%/allied-*-inventory-20261025.json; no large archive made.

25 October 2026 - audit batch completion receipt:
Implemented and committed e9f48ef5 on fix/audit-actions-20261025 in the reused
allied-home-restoration-20261025 worktree; its Git status is clean. Local lint,
types, all 996 frontend tests, format, optimized build and standalone preparation
passed. Selected browser/portrait evidence and remaining real-role/device/hosted
limits are in Cycle 6 of that worktree's quality register. A01-A07 is complete;
A08-A15 remains the next batch. No production deployment was made. Current review
build and useful caches are retained; no new Docker image, dependency copy or
worktree was created. Final fixed-reserve check passed at 24.42 GiB free on C:.
No claim is made about unrelated applications' later disk use. Main-checkout
uncommitted work and all existing data/backup/security constraints remain intact.

25 October 2026, 12:15 Lagos - audit A01-A07 production release complete:
Frontend runtime e9f48ef525b80cc215f340015b0553e5b1e3af73 is READY on Vercel
dpl_5vyykAdQnDsAshfCKRU9KNkePJgb. Both main/www aliases independently matched
at 11:13:48 UTC. Release branch fix/audit-actions-20261025 in reused worktree
allied-home-restoration-20261025 now includes test-only 8b5fe871 and release
receipt 0253a651; neither changes the deployed runtime inputs. Runtime frontend
CI 40186973452, backend safety 40186973448 and secret guard 40186973443 passed;
test-correction frontend CI 40187506046 and secret guard 40187506070 also passed.
34/34 optimized hosted isolated audit scenarios, 9/9 real-data candidate scenarios,
9/9 production public scenarios and 3/3 live main/www Privacy/restriction checks
passed. Final browser checks ended 11:15:50 UTC / 12:15:50 Lagos with zero page
exceptions. Expected anonymous-session 401 and intentional /demo 404 are not
application exceptions. Real authenticated operational submissions remain untested.
No synthetic data, real reply, approval, transaction or production migration ran.

Backend remains ACTIVE f9239c36-d4b7-4ef0-b8ba-479cda926a13 / ff42b0e2; no backend
image or database configuration changed. Read-only recovery review confirmed the
online target, nine managed backups (latest 05:22:10 UTC), existing encrypted
off-device seven-day/PITR safeguards and today's successful separate 89-table /
65-migration restore rehearsal with original rows unchanged. No new DB command,
backup/restore or grant change was performed. Existing browse/enquiry restrictions
and protection are retained; owned temporary QA keys were revoked and verified
absent. Rollback frontend: dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU. Future R2 publication
must retain this audit frontend rather than overwrite it from the older b45513f1
base. The separate in-progress R2 source and other uncommitted work are preserved.

Evidence: release worktree Cycle 6 quality register and %TEMP%/allied-audit-deploy-20261025/.
Browsers closed; C: fixed-reserve check passed at 23.83 GiB free. No new local
build, dependency installation/copy, worktree, editor profile or Docker resource
was created for rollout. Docker remains 38 images/11.84GB, 14 containers,
14 volumes/1.012GB and 87 caches/6.715GB; current/rollback/other-task resources,
source, history, secrets, databases and backups were retained.

25 October 2026 - compatibility concurrency correction released:
runtime source `313c4f9c` from
`C:/Users/PC/.codex/worktrees/allied-compatibility-concurrency-20261025`,
branch `fix/compatibility-release-20261025`. DigitalOcean deployment
`634b9110-8ad0-455e-ad7d-48cd9ee35681` is ACTIVE with API digest
`sha256:bf2d62febe09d0c0800214b53830c016ea29c205286a83d3901d807746067ac8`;
both worker and read-only predeploy digests are unchanged. Vercel
`dpl_GDqL1pgfFbWtb7avvNGGW8Zu3bNH` is READY on main/www. The editor now sends
the child version so stale update/retirement returns 409 before mutation/history,
retains the draft and allows only safe failed-read retry. All 70 migrations replayed
in an isolated database; nine concurrency tests and final-source CI passed.
Three browser-isolated editor cases passed on the actual domain after promotion;
all possible writes were intercepted. API readiness/public products returned 200,
anonymous admin access 401, Home/Help/Parts 200, `/shop` reached `/parts` and
`/demo` remained 404. Existing same-day managed backup and separate restore
evidence were reviewed; no production migration or business data write ran.
Real signed-in admin acceptance and the wider Item 6/site goal remain open.
The newer Customer Care branch with migration 71 remains a separate pending release;
its changes were not deployed by this correction. Detailed release evidence is in
the source worktree's tracker and UI quality Cycle 9. The main checkout's other
uncommitted work is preserved.

25 October 2026 - reviewed cart-clear race correction released. Runtime source
76377d43fb6e595e40ea27d24994794ceed37706 from
C:/Users/PC/.codex/worktrees/allied-compatibility-concurrency-20261025,
branch fix/cart-clear-atomic-20261025. Backend DigitalOcean deployment
98401193-fb85-48d9-8c51-462dcadd6d19 is ACTIVE with four matching image
digests; Vercel dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u is READY on main/www.
A reviewed cart snapshot is now required and compared under the cart lock before
DELETE; stale contents return 409 without removal. Existing customer-care,
notification and compatibility changes are included. Three GitHub workflows,
71-migration isolated replay, related database cases, 13 compiled cart browser
cases, image contracts and public-domain smoke passed. No schema change,
production cart/payment write or full real-role acceptance occurred. The same-day
managed backups and separate logical restore evidence were reviewed. Detailed
evidence: backend/docs/cart-clear-atomic-20261025.md in the release worktree.
Documentation-only follow-up commit ea52d6a3 records the release; runtime remains
76377d43. Item 6 and wider operational acceptance remain open. Main-checkout
uncommitted work and other worktrees were preserved.


26 October 2026 - customer table/sidebar responsive correction implemented locally.
Branch fix/customer-table-responsive-20261026 reuses allied-shop-vehicles-r2-20261025
from released 76377d43. Expanded/collapsed rows now keep matching compact actions;
desktop columns fit, visible table/sidebar/drawer scrollbars are removed, and
necessary scrolling plus keyboard focus remain usable. The 1024px partially clipped
focus case is fixed. Permissions, account safeguards, data and unrelated work retained.
Final optimized local Edge acceptance: 22/22 browser cases; four related units,
TypeScript/lint/format/build/postbuild passed. See UI quality Cycle 13 and
%TEMP%/allied-customer-table-20261026/ for screenshots, metrics and honest limits.
Installed Next 16.3.8 differs from locked 16.4.3; locked CI/hosted/real-role/device
acceptance remains separate. Vercel management read returned 403; no production
deployment or database/business write was performed. Item 6 remains open.

Task preview servers stopped. C: postflight 29.99 GiB; useful build/cache and 8.4 MiB
review evidence retained. No Docker resource/duplicate install/worktree created.

26 October 2026 - fitment/product-media candidate committed as b8f93c27 on
feat/fitment-media-20261026 in allied-home-restoration-20261025 (base 76377d43).
Fixed reproduced Toyota/Camry legacy hydration, explicit reconciliation, evidence-led
rule editing/review, retained/conflicting drafts and product Images/Compatibility
separation. Added compatible atomic audited image ordering and safer hosted URL
validation; no migration or production data/role/storage write. Actual isolated API
upload/public-read/removal journey passed. Final compiled browser checks: 36/36 scope
and 12/12 adjacent regressions; 40 frontend units, seven backend units, 21 real
integration cases, fresh 71-migration replay/db:check, lint/types/build/OpenAPI passed.
Detailed receipts and limitations: candidate backend/docs/fitment-product-media-20261026.md.
Before/after desktop/mobile index: %TEMP%/allied-fitment-media-review-20261026/index.md.
Owned preview/test API stopped; current evidence/cache/data retained, 54.78 MiB
superseded task output removed; C: 29.88 GiB free at measurement. Docker unavailable,
no Docker resources or duplicate worktree/dependency installation created. Candidate
is NOT deployed; backend-first rollout, locked CI, real-role/provider/device checks
and wider Item 6 remain separate. Existing main-checkout changes were preserved.
Fitment/media final local HEAD is a28753ab (implementation b8f93c27 plus the measured
gallery-alignment follow-up). Rebuilt and all five gallery widths passed again;
candidate worktree clean, review screenshots refreshed, preview stopped. No deployment.

26 October 2026 - Help, Help & Learn and Allie refinement implemented and verified.
Runtime candidate aa54fba8378d879e50ca99750dd7cf6e9fa2195e on
feat/help-allie-20261026 in reused allied-shop-vehicles-r2-20261025, preserving
adef02f9 and unrelated worktrees. Backend batch 38e7df62, frontend d0272949,
final bounded practice polish aa54fba8. Feature branch pushed for locked CI;
no main merge, new production deployment or shared/application database write.
Help entry now a branded card; hub has three modes/all-kind search and coherent
article/back navigation. Allie is a native SVG/content-based website guide using
reviewed eligible help, with source/action/fallback and honest no-live-record/no-AI
boundaries. No provider, paid resource, new permission, schema or operational API.
Reproduced oil-filter Next timing failure; fixed retained interaction evidence,
retargeting, loading explanation and compact guide controls. Practice has one mode
indicator, editable care-reply sample, honest choice-only hints, specific feedback
and no obstructing floating toolbar. Practice remains in memory, with no business
mutations, external requests, uploads, messaging, approvals or dummy live-field fill.
Local 1,039 frontend tests, seven authenticated API cases, lint/types/build/postbuild,
OpenAPI/types/424-operation contracts and restricted-runtime checks passed. New
exact-loopback help_allie_21a045ec5c_ci replayed 71 migrations and db:check passed.
Compiled browse/enquiries: 29/29 browser cases plus six final-polish rechecks passed;
360/390/768/1024/1440 Help/hub/Allie, 320/390/768/1440 practice, keyboard/Escape/
return, scoped Axe, reflow/reduced-motion, role/identity/failure/guide transitions.
All three exact-runtime CI workflows passed with locked dependencies. Screenshots
and limits: docs/help-learn/ALLIE_IMPLEMENTATION.md; local index
%TEMP%/allied-allie-20261026/index.md. Real production roles, physical devices,
native keyboards/zoom and full screen-reader acceptance remain unverified.
Task previews stopped; Docker unchanged (67 images, 13 stopped containers, same
14 volumes, warm cache retained), no pruning or dependency/profile duplication.
C: postflight measured 28.85 GiB free; no machine-wide space guarantee.
Main tracker original bytes preserved append-only. Production remains separately
recorded adef02f9; broader site-completion Item 6 remains open.

27 October 2026 - P1 Contact visit-preference validation released. Clean
frontend branch fix/contact-visit-validation-live-20261027 was based on exact
live source 8fa386cb. Runtime 317b1678 directs missing date/time and overlong
message feedback to the affected field, clears stale errors on editing, and
preserves staff-confirmed preference semantics. Eleven units, six Edge Contact
scenarios at 320/390/1440px, types/lint/format, Next 16.4.3 optimized build,
exact-source frontend CI 40472135463 and secret guard 40472135440 passed.
Vercel dpl_24sXMLFwUuX6ag8PqMTtGaVH2xPh is READY and both apex/www HTML expose
that exact deployment ID; API readiness returned 200. Read-only live Edge at
390/1440px selected the published Tyre Change service and verified time/message
focus, aria-invalid and visible guidance with zero API writes. Local build's
linked dependency directory caused a standalone trace warning; independent CI
used clean locked dependencies. No backend, schema, provider, payment or
production business write changed. Real authenticated roles, physical devices,
full screen-reader and wider Contact/Help acceptance remain open. Other
worktrees' concurrent edits were preserved.

26 October 2026 - sign-in MFA challenge atomicity deployed.
Runtime 8b583921, backend 50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3 ACTIVE.
Four active image digests match the manifest, and the non-image app spec is
unchanged. Nine image and one packaged isolated migration/restore checks passed;
all 24 deployment steps including read-only PRE_DEPLOY database check succeeded.
Direct/domain liveness and readiness returned 200; anonymous session and MFA
verify returned 401. Managed backups through 26 October and retained separate
populated 90-table restore evidence were reviewed. No schema/grant/production
business write or frontend release. Real authenticated role, device and genuine
WebAuthn browser acceptance remain open. Previous backend 96ffc790 is the
immediate rollback candidate subject to compatibility review. Detail:
backend/docs/mfa-challenge-atomicity-20261026.md.

28 October 2026 - P0 reconciliation production-compatibility candidate.
The unreleased payment/refund source was merged with actual production backend
source 0fd68980 without conflicts; merge 7d4bd735 preserves the inventory
replay fix and the workshop contact release. Exact candidate 6cab3669 adds the
27-case reconciliation integration suite to the isolated `_ci` safety workflow.
Backend safety CI 40673070983 passed migration replay, refund database cases and
the new reconciliation step; secret guard 40673070788 passed. The last
independently recorded production backend deployment was
79d7a0ac-4e83-4b73-ae46-40af4731a604, with providers disabled and no
reconciliation recovery migration applied. Recheck that state before rollout.
No production database, provider, financial record or deployment was changed by
this work.
The local disk preflight dipped below its 20 GiB reserve, so no local build or
database test was started. Fresh managed recovery evidence, production migration
role ownership, new projection runtime DML, populated financial backfill,
legacy RUNNING/held rows, provider sandbox and real-role acceptance remain release
gates. Read-only SQL probes are recorded in
backend/docs/payment-reconciliation-recovery-20261027.md; they have not been run
on production. Recheck actual deployment and backup state before any rollout.


### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/compatibility-release-20261025; it is not a claim of current production identity.

Production release, 25 October 2026: source `313c4f9ccddc5bed89ab6a3fbd8e8fbac4308a96`
on `fix/compatibility-release-20261025` passed exact-source frontend CI
`40225020885`, backend database safety CI `40225020883` and secret guard
`40225020879`. The API-only image was pushed with registry digest
`sha256:bf2d62febe09d0c0800214b53830c016ea29c205286a83d3901d807746067ac8`.
DigitalOcean deployment `634b9110-8ad0-455e-ad7d-48cd9ee35681` is ACTIVE,
with all build/deploy component steps successful. The two worker digests and
read-only predeploy `db:check` migration-job digest/command remained unchanged.
No production migration, application database DML, grant change or reset ran.
API readiness and public products return 200; anonymous administrator catalogue
access returns 401.

Production-configured Vercel candidate `dpl_GDqL1pgfFbWtb7avvNGGW8Zu3bNH`
was READY before promotion and now serves both main and www aliases. The first
unaliased candidate failed because the CLI was run inside `frontend` while the
project already configured `frontend` as its root; deploying from the repository
root succeeded, with no public-domain change during the failed attempt. Protected
candidate Home/Help/Parts/admin requests returned 200. After promotion, the
browser-isolated hosted editor scenarios passed 3/3 on alliedautotech.com with
all API writes intercepted: mobile stale-write conflict, safe failed-read retry,
and mobile layout/automated accessibility. Real authenticated admin acceptance
remains untested without an authorised QA session. Public Home/Help/Parts return
200, www Parts resolves to main, `/shop` reaches `/parts`, and `/demo` remains 404.

Read-only rollout review confirmed today's 05:22:10 UTC managed off-device backup
and reused the earlier 25 October separate 89-table logical restore rehearsal and
documented encryption/retention/PITR; no new physical PITR rehearsal is claimed.
Local disk stayed above the mandated reserve, 28.79 GiB free at the last check.
The task's two disposable PostgreSQL containers were removed by `--rm`; 14 existing
volumes, current/rollback/other-task images and useful build caches were retained.
Docker totals observed 46 to 55 images and 103 to 120 cache entries during
concurrent work; those aggregate changes are not all attributable to this task.
The current API image is retained for production/rollback. An automatic policy
review blocked removal of the task-created ignored Vercel `.env.local` token file;
it remains local and untracked. No alternative deletion path was attempted.
Item 6 and the full site-completion goal remain open.


### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/parts-enquiry-copy-current-20261028; it is not a claim of current production identity.

28 October 2026 - P1 public Parts detail enquiry guidance released. The live
unavailable oil filter had no branch listed, but its page instructed visitors to
collect from a listed branch and described ordering in enquiry-only mode.
Frontend runtime 9f9311cf builds on exact prior live fbb6565a, keeps its shared
support/navigation changes, and asks visitors to confirm stock and collection
arrangements with staff before travelling. The full-commerce copy stays gated;
no product, fitment, price or enquiry destination data changed. Frontend CI
40668317540 and secret guard 40668317916 passed on the exact commit. A normal
preview built but its dynamic product route returned 503 because preview lacks
BACKEND_ORIGIN. A production-configured deployment was built with domain
assignment disabled; its protected product page rendered the corrected copy,
then dpl_68bNV74wNajB9vW1Ly85nzmmdEvU was promoted. Both apex and www expose
the exact ID; the previous dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq is the immediate
rollback. API readiness returned 200. Live read-only Edge at 390/1440px passed
the product detail, collection FAQ and exact-product Contact navigation with no
horizontal overflow or page exception. No form, inventory, provider, payment,
database or backend change was made. Physical devices, screen readers and
authenticated-role acceptance remain open; P0 backend release gates are unchanged.


### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/customer-vehicle-payment-filter-20261027; it is not a claim of current production identity.

27 October 2026 - P1 vehicle-payment history filter local checkpoint on a
merged current-release source (frontend 8fa386cb plus backend 3bb51d21).
Customer payment list applies optional vehicleTransactionId within the owned
profile before cursor pagination; foreign/other-target filtered cursors fail.
The purchase panel uses that filter and rejects mismatched rows or incomplete
history before offering a new payment request. A fresh isolated PostgreSQL 18
_ci target replayed 72 migrations, passed schema diff/db:check and the focused
real-service ownership/pagination integration. Six focused Edge fixture cases,
backend/frontend types, scoped lint and OpenAPI validation passed. The task
database was stopped/removed; no production financial/provider write. Exact-lock
CI, API-first deployment, both frontend aliases and authorized live-role
acceptance remain open. See backend/docs/customer-vehicle-payment-filter-20261027.md.
P0 reconciliation recovery remains on its separate unreleased branch, and full
Item 6/Revision 4 remain active.
The exact candidate 54e83b3f passed frontend 40445007425, backend 40445007397
and secret 40445007545 GitHub runs. Provider promotion did not run: local doctl
returns access-token-required, no Vercel CLI is installed, and browser automation
surfaces are unavailable. Recheck live source/access before release; no image or
production app/database change was made for this candidate.

27 October 2026 - P1 Contact visit-preference correction on the same candidate
branch. Source c54ef088 makes missing date/time and overlong visit messages
focus/mark the actual field, announce its error and clear stale feedback when
edited; it does not change request-only visit policy. Eleven focused unit cases,
frontend types/lint/format, local isolated Edge interaction at desktop and 320px,
and exact-source locked frontend 40448703220 plus secret 40448703167 GitHub
checks passed. The browser sent no POST; local API results were fixtures. No
Docker resource or production deployment/database/provider action. The original
vehicle-payment API-first release and live role checks remain open, along with
wider public-form/physical-device acceptance. See the frontend quality register.


### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/staff-vehicle-filters-20261024; it is not a claim of current production identity.

`aat_stock_*_test` PostgreSQL database. The disposable database container was
removed. No application database or production backend was written. Backend
promotion still requires the current target's read-only database check,
backup/restore evidence and deployment verification. Item 6 remains open for
real catalogue publication and authenticated staff acceptance.
