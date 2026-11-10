# Allied AutoTech consolidated audit — implementation and acceptance

## 10 November - saved-collection focus race found by full CI

PR56 source 7b133943 finished Frontend run 42739997340 with 1,055 runtime
passes and one WebKit failure. The failed case keeps an open vehicle-removal
review bound to its original collection while the URL changes to products;
after successful synthetic removal, the products tab is selected but unfocused.
The notification retry cases pass. This is a failed release gate, not a pass.

The close handler scheduled focus before React committed removal of the modal
and enabled the tabs. Move this handoff into a post-commit effect, preserving
the collection-bound mutation, refresh, session invalidation and opener recovery.
Add the reverse-direction cancellation case and assert focus survives loaded
content without any write. Exact-source compiled and three-engine acceptance
remain required; no production submission or security change was made.

## 10 November follow-up: mobile sidebar scrollbar

**P3; Admin; /admin/customers; native Edge 390x600.** Open Dashboard navigation.
The shared modal descendant scrollbar rule overrides the drawer's existing
hidden-track treatment; computed scrollbar-width becomes thin. This contradicts
the owner's sidebar instruction. The existing 18-case table/sidebar/support suite
passes 17 cases and retains this one failure. Scrollbars on ordinary content modals
are allowed to remain deliberately styled.

Correction: a scoped drawer exception in globals.css, with no overflow, scrolling,
permission or layout change. The four-role/seven-size shared-shell suite now
asserts the intended property. All 28 native Edge prototype cases pass with the
exact correction supplied through an existing same-origin stylesheet response;
CSP remains enforced. Compiled-source acceptance/publication are still pending.
Evidence: TEMP/allied-dashboard-index-7b133943. The wider coverage reconciliation
is TEMP/allied-master-coverage-b1222a11/coverage-checkpoint.md; a large aggregate
test count is not treated as complete route/state acceptance.

## 10 November follow-up: notification preview retry focus

**P2; Customer; /dashboard/notifications; 1280x720 and 320x720 mobile/touch.**
On protected integrated candidate b1222a11, open the notification bell with a failed
preview request, focus Try again, press Enter and return a successful notification
response. The retry control disappears and focus falls to BODY outside the modal.
Both native Edge cases reproduce this; no real request mutation or page error occurs.
Centered/full-width phone geometry remains intact. Keyboard users lose their place.

Correction in notification-preview.tsx: move focus to the stable Close control
before replacing the error with loading; preserve later deliberate focus movement.
The existing unit case and seven-size shared-modal matrix now cover recovery,
repeat failure and cancellation across rotating Customer/Staff/Admin/Super Admin
fixtures. New-source verification and publication remain pending. Evidence is in
TEMP/allied-customer-confirmation-20261110/notification-retry-held-report.json.

## 10 November follow-up: customer confirmation and recovery focus

**P2; Customer; /dashboard/privacy and /dashboard/reviews.** After confirming a
submission, the history refresh disabled the form opener while the dialog closed;
focus could fall to BODY. Closing an unknown-outcome dialog also lost focus while
the form remained guarded. On Reviews, successful original-request recovery removed
its recovery button and again left BODY focused. Desktop 1280x720 and mobile 320x720
baselines reproduced these distinct states with intercepted requests only.

The existing refresh-aware hook now returns focus to an available opener, a named
recovery region, or the history heading. Reviews captures the recovery opener and
uses the same handling after successful replay. Deliberate focus movement wins.
Relevant owners: customer-privacy.tsx, privacy-request-form.tsx, reviews-panel.tsx,
review-create-form.tsx and use-account-action-refresh.ts. Request bodies,
idempotency/replay, moderation, privacy approvals and permissions are unchanged.

Source 0d22eae3 passes 50 compiled native Edge 157.0.4341.42/Chrome 156.0.8078.80 cases
across 1280x720, 1024x768, 768x1024, 430x932, 390x844, 360x800 and 320x720, plus two
empty-history replay cases at 1280x720/320x720. Assertions cover measured dimensions,
centering/full phone width, keyboard cancellation/focus, draft retention, delayed
and failed reads, rejected/unknown responses and identical replay key/body with
one resulting review. All unmatched submissions are blocked. Desktop/mobile
screenshots were inspected; no outgoing writes or uncaught page errors occurred.
The first supplemental desktop attempt timed out before Rating appeared; retain
that failure separately from the subsequent normal-load-gated pass. The main 50
cases have no failures, skips or flaky outcomes.

Evidence: TEMP/allied-customer-confirmation-20261110/acceptance.md and its
replay-held, replay-fixed and replay-loaded reports/results. Local type/lint/format,
backend safety 42732837656 and secrets 42732837820 pass. Frontend 42732838129 was
running at this checkpoint. The protected candidate GgTWS5qGg7Re5LEzX4YrWZHKGKR7
is not public. Master integration, exact-master checks, compatible vehicle-backend
readiness and integrated publication remain required, in that order. The full
renewed two-brief scope remains open; the older release below is historical.
Phone emulation is not physical-device, Safari, virtual-keyboard or screen-reader
acceptance. Synthetic customer state is not real-account persistence acceptance.

## 9 November follow-up: Saved items collection return context

- **Finding / severity:** P2, comparison-context loss. `/dashboard/saved`, Customer;
  reproduced on the live frontend with isolated private fixtures at 390x844 mobile/
  touch emulation and 1280x720 desktop, without application writes.
- **Reproduction:** select Saved vehicles, open a published vehicle, use Back, then
  reload. The previous implementation returned to Favourite products. The successful
  Save vehicle receipt also linked to that product-default page.
- **Impact / component:** customers lose their selected shortlist context while
  comparing vehicles. `saved-items.tsx` kept selection only in local state;
  `vehicle-actions.tsx` omitted collection context from the receipt destination.
- **Implemented correction:** validated URL selection, stable Back/Forward/reload,
  contextual receipt, keyboard tab history replacement and collection-bound removal
  review. Existing permissions, private cursor isolation, CSRF and recovery remain.
- **Verification:** 55 distinct local Edge fixture cases have passing outcomes,
  including all seven requested exact viewports, 20 decoded-image layout cases,
  three automated accessibility scans and failure/account/cursor/review behaviour.
  One 60-second tablet timeout is retained; its unchanged case passed in 24.7 seconds
  when rerun with the existing CI 90-second allowance. Eight affected media/layout
  cases passed after correcting the modern image fixture route. Seventeen focused
  units passed. Runtime configuration collects 530 cases; its new hosted matrix is
  pending, not a pass. Native production Saved acceptance is also pending.
- **Evidence:** `TEMP/allied-saved-return-20261109` (before) and
  `TEMP/allied-saved-context-20261109/{final,tablet-recheck,image-recheck}` (after).
  Desktop/mobile full-page captures are in image-recheck. Data is synthetic and
  isolated; physical phones, manual screen readers and real-account writes were
  not tested. Owner-unconfirmed product identity/media and Diagnostics duration
  remain business-data dependencies, not invented stock or code-completion claims.

The older release below remains historical; it does not certify this follow-up or
completion of the renewed two-brief audit.

## Final production release — 3 November 2026

All safely actionable audit code is released at **7384abf8d23ad24fe8e9b0b66e144dd023f273bf**, merged through [PR #12](https://github.com/Otto-space/allied-autotech/pull/12). The historical implementation checkpoints below retain failed attempts and earlier pending states; this section supersedes their release status. Later booking/calendar/Allie work on master is preserved and is **not claimed as part of this 92-migration release**.

- Exact-source GitHub checks passed: [Frontend 41695288681](https://github.com/Otto-space/allied-autotech/actions/runs/41695288681) (1,440 units, 12 pre-existing skips, 21/21 production-runtime regressions), [Backend 41695288523](https://github.com/Otto-space/allied-autotech/actions/runs/41695288523), [Secret guard 41695288500](https://github.com/Otto-space/allied-autotech/actions/runs/41695288500).
- Both apex and www resolve to READY production build **dpl_GjKGjnPCT8H56HWmikySoyYSjyxP**, exact source above. The held production-environment build was promoted without rebuilding. Backend **fb5f9ef2-8ffc-4233-9e96-4722c43350a2** is ACTIVE, all four pinned registry digests match the verified images, API readiness is 200, and 13 scheduled worker tasks have healthy success timestamps after activation. No commerce/AI restriction, permission, resource, secret or business-policy change was made by the image update.
- Three reviewed forward migrations expanded production from 89 to 92. Strict-TLS baseline/history/least-privilege checks, a fresh verified durable backup, and a separate populated local restore passed first. All **101 original tables** retained row counts and original-column hashes after rehearsal; all 92 migration checks passed, with new and previous packaged runtimes compatible. Production guarded migration, schema/history check, least-privilege check and both packaged runtime probes passed. No reset, restore-over-live, manual resolve or fictional business rows. Recovery retains the previous three runtime images **with the new schema-compatible migrator/checker**, rather than undoing migrations.
- Managed off-device backup freshness: eight available backups, latest 3 November 05:22 UTC when checked. Existing managed restore evidence from 21 October verified this same cluster with strict TLS and no source write; that historical cloud rehearsal is distinct from the fresh populated logical restore above. Provider documentation describes [encrypted storage/TLS](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/) and [managed backup/PITR recovery](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/). No new paid cluster was created.
- The owner explicitly approved only this computer's exact temporary /32 access. Backup, migration and post-release read-only health leases all removed only their owned rule and verified removal, preserving the two existing app rules and any unrelated rules. Passwords, credentials, grants and disabled commerce remain unchanged.

### Final native production browser checks

**7/7 genuine public Home/search cases** passed directly on alliedautotech.com at 1280×720, 1024×768, 768×1024, 430×932, 390×844, 360×800 and 320×720. Actual dimensions, decoded hero slides, restrained reduced-motion behaviour, mobile navigation/Escape focus, real vehicle imagery and complete owner fault disclosure, useful search destination, no page overflow, no unavailable-action warning and no unhandled page errors passed. API submissions were blocked. No synthetic inventory was published.

**14/14 released profile-interface cases** passed at the same seven sizes in dedicated Edge and Chrome, using isolated role fixtures with writes blocked. My profile heading/breadcrumb, white reading surface, refresh, account links, Escape focus, actual viewport, no overflow and no unhandled page errors passed. These use native released HTML/assets, but synthetic private API responses: **not real-role, permission, private-storage or persistence acceptance**. Phones use mobile/touch DPR2, tablet touch; no physical device, Firefox or Safari claim. Earlier held-candidate profile 14/14 and public 7/7 used an authenticated read-only bridge and are recorded separately, with no native-performance claim.

Reports and guarded receipts are retained under local Temp allied-audit-bridge-harness and allied-audit-backend-7384; protected backup/restore records stay ignored and are never included here. The local 128 distinct corrected cases and exact-source CI remain separate counts; repeated cases are not summed as unique coverage.

### Recovered release blockers

The initial read-only database baseline timed out while the approved firewall change propagated. A strict-TLS, password-free diagnostic and bounded TCP readiness wait resolved it; cleanup was verified. No migration ran in that failed attempt. The isolated Docker internal network did not publish the required loopback port; a dedicated bridge with outbound masquerading disabled fixed exposure. A temporary startup socket briefly appeared ready before PostgreSQL's final restart; waiting on the final TCP listener fixed the interrupted local connection. Those failed copies were disposed of; no production restore was attempted.

The command doctl apps spec validate initially rejected existing encrypted environment values as a new-app proposal. No app update occurred. Validation was corrected to POST /v2/apps/propose with the **existing app_id**, as [documented by DigitalOcean](https://docs.digitalocean.com/reference/api/reference/apps/); the provider accepted the proposal. A structural comparison proved only four image digests changed before submission. Existing encrypted settings were preserved, never printed or recreated.

### Remaining acceptance and business inputs

F02 remains intentional CONSENT_WITHDRAWN, NOT_SENT, zero attempts; no retry or consent change. F05/F17 are explained intentional/superseded observations. F10/F11/F12/F13/F15 need genuine catalogue/fitment/media/service-duration/duty inputs or existing release gates; fictional stock or permission widening is not a completion method. Work-account name/photo editing needs a separately approved canonical authoring contract. Real Customer/Staff/Admin/Super Admin persistence, upload/storage integration, new-position authoring, full screen-reader use, physical devices and non-Chromium browsers are not newly accepted. These limits do not negate the verified source, fixture, public and operational checks above.

Priority after this release: (1) supply genuine media/fitment/service data; (2) verify protected authoring/storage and distinct real-role journeys in an approved environment; (3) physical-device/Safari/Firefox/accessibility follow-up. No further broad redesign or commerce activation is proposed.

Date: 3 November 2026. This is the current F01–F20 ledger, not a claim that every role, device or production workflow has passed. It supersedes the implementation status in the owner-supplied **Allied_AutoTech_Consolidated_Audit_and_Test_Plan_2026-11-03.md**; its original observations remain historical evidence.

## Source, safety and evidence boundaries

The initial working baseline was master `1f573fd4`, on the reused `codex/consolidated-audit-fixes-20261103` branch in `allied-home-photo-20261103`. Desktop's unrelated hero edit and the active master worktree's purchase changes are preserved. Master advanced during this package; integration through PR #12 preserved its reviewed changes. Subsequent unrelated changes remain excluded from the recorded release. The initial UI implementation used no reset, new worktree or dependency installation. Its subsequently approved guarded database release is recorded above.

Read the repository instructions, completion tracker, continuous quality directive, quality register and delivery rules before editing. The owner's approved white/photo hero is unchanged. Missing business information stays missing; no fictional listing, fabricated compatibility, replacement consent, permission grant or commerce activation is included.

Production inspection used a dedicated visible Edge context, with the owner completing sign-in privately. Subsequent automated API requests allowed GET/HEAD/OPTIONS only. No authentication file, credentials, customer conversation, recipient address or email payload is included in this report. Production QA made no form submission, message, retry, payment or business-record edit. The separately approved temporary network exception and guarded forward migration are recorded above. Normal server audit/logging of permitted reads may still occur.

Local browser tests use intercepted role fixtures and a loopback-only synthetic public API. The synthetic vehicle and photograph are layout inputs, **never production availability**. Source/unit, local browser, real Super Admin reads and publication acceptance are distinct below.

At initial inspection both domains served fabbe7a6. The final verified production identity and checks are recorded above; earlier pending checkpoints below are historical.

## Finding ledger

Code findings below are fixed and verified locally against the documented fixtures. Production acceptance remains separate. “Superseded” means the alleged defect is an intentional or accurately explained state; it does not mean a feature was enabled.

| ID / priority                      | Route, role and affected size                                                                                  | Reproduction and current evidence                                                                                                                                                                                                                                 | Disposition, component and remaining correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F01 / P1**                       | `/learn`, dashboard Learn/Allie; verified Admin/Super Admin; all sizes                                         | Feed the actual backend catalogue into the frontend validator. Public/Customer/Staff passed; Admin/Super Admin failed on legitimate `/admin/vehicles`, invalidating the entire catalogue.                                                                         | **Fixed and verified locally.** Add only the legitimate destination to `lib/learning/contracts.ts`; retain rejection of unknown/external/query-bearing targets. Actual backend projection regression covers all independent grant combinations, launch modes, managed/verified states and both destination versions. Add `/admin/profile` alongside its genuine new own-account route. New work-profile guidance is gated/versioned backend content, now published with the compatible checked backend; eligibility remains enforced. |
| **F02 / P1 investigation**         | `/admin/processing-jobs` and the linked authorised support email-delivery summary; actual Super Admin; desktop | Read the Oct 23 `support.customer-email.requested` dead letter, then its existing branch-authorised `/staff/support/enquiries/:id/email-deliveries` summary. Exact result: `NOT_SENT`, `CONSENT_WITHDRAWN`, zero attempts. No recipient/body/raw error is needed. | **Superseded: intentional consent suppression, verified by live read.** No retry, configuration or preference change. `backend/src/modules/support/customer-email.ts` intentionally maps this case to Not sent. Queue raw diagnostics remain excluded. A future retry requires a separate consent/operational review; this audit does not authorise one.                                                                                                                                                                              |
| **F03 / P2**                       | All dashboard routes; Customer and work roles; tablet/phone                                                    | At <=900px open and dismiss page search; search for Security, use Escape, then open/close navigation. Earlier header consumed about 191px on phones.                                                                                                              | **Fixed and verified locally.** `dashboard-navigation.tsx` and `dashboard-account.css` put page search behind a 44px labelled disclosure, preserve input/result keyboard access, and use one compact account toolbar. Mobile Learn retains its accessible name with an icon. Search query stays in memory when merely dismissed. Desktop search remains visible. Final cases assert toolbar <=76px, actual viewport and no page overflow.                                                                                             |
| **F04 / P2**                       | `/admin/*`, `/dashboard/*`, new `/admin/profile`; all roles/sizes                                              | Open Account options. Previously the generic account affordance opened Security, with no profile choice.                                                                                                                                                          | **Fixed and verified locally.** An explicit account disclosure links My profile, Account security and Sign out. Customer opens the existing editable profile; work accounts open a genuine read-only own-profile page backed by existing `/staff/profile`. Verify ID, role and active status before displaying work details. Missing employee identity remains “No name recorded”; no fake employee, self-promotion or new profile model. Work name/photo editing is not added or claimed.                                            |
| **F05 / P2 audit clarification**   | Team & Access and protected owner/own-account editing; Admin/Super Admin                                       | Inspect the existing self/owner protections and responsibility grants. A business title is not a permission grant.                                                                                                                                                | **Superseded as a UI simplification request: protections are intentional.** Existing server ownership, independent review and grant restrictions are preserved. The new own-profile view is informational and has no access mutation. Real grant/revocation acceptance is not part of production read-only checks.                                                                                                                                                                                                                    |
| **F06 / P2**                       | `/admin/workforce/access`; authorised managers; seven exact viewport pairs                                     | The earlier View/manage placement is retained. On 9 November the 320px table still put status, branch and responsibilities out to x867, requiring sideways scrolling.                                                                                             | **Follow-up implemented; local Edge 10/10, hosted/release pending.** Container-based complete labelled records replace the narrow 850px table; wide screens retain table semantics. Scoped filter spacing, all field bounds, sidebar states, keyboard detail/disclosure/back, search/pagination, error recovery and revoked management are checked. No API, permission or policy change.                                                                                                                                              |
| **F07 / P2**                       | `/admin/support`; scoped Staff/Admin/Super Admin; laptop through phone                                         | Locate a case by Subject and choose Open case without scrolling to the far-right column.                                                                                                                                                                          | **Fixed and verified locally.** Move the existing action beside the Subject in `work-support.tsx`; preserve the subject link and remembered queue context, contact fields, assignment facts and scoped API. Table scrolling remains contained.                                                                                                                                                                                                                                                                                        |
| **F08 / P2**                       | `/admin/invoices`; authorised Admin/Super Admin; all seven sizes                                               | Apply an invoice status, open Create an invoice, choose an existing source, return to Find existing invoices, then Back.                                                                                                                                          | **Fixed and verified locally.** `staff-invoices.tsx` separates find/create views using existing URL state. Filter and draft components remain mounted; hidden controls cannot receive keyboard focus. Existing status/filter URL and source selection must survive the switch and history navigation. No invoice is submitted by these tests.                                                                                                                                                                                         |
| **F09 / P2**                       | `/admin/security`, `/dashboard/security`; all roles/sizes                                                      | Inspect Add MFA factor and Set up authenticator again, without activating them. Earlier measured gap was zero at all seven sizes.                                                                                                                                 | **Fixed and verified locally.** `security-factors.tsx` uses the existing shared Actions group with 10px wrapping gap. Each target stays >=44px, and the group has an accessible label. Authentication, factor removal, review and uncertain-result safeguards are unchanged.                                                                                                                                                                                                                                                          |
| **F10 / P2 data dependency**       | Vehicles/parts make/model and fitment discovery; public and authors                                            | Current public read returns one real vehicle. Empty choices do not prove request/filter failure or justify invented stock/fitment. Earlier structured evidence gaps remain business inputs.                                                                       | **Blocked on genuine catalogue/compatibility evidence.** No synthetic stock, engine/year association or approval is published. Existing proven fitment contracts and authorisation remain intact. Inventory-dependent cross-field matching is not newly accepted by this UI package.                                                                                                                                                                                                                                                  |
| **F11 / P2 data dependency**       | Parts and managed product Images; public/author                                                                | Current public catalogue has one product and zero product photos.                                                                                                                                                                                                 | **Blocked on authentic product identity/photographs.** Existing upload validation is preserved. No illustrative/test photograph is published as that product's stock image. Real storage-upload persistence is not claimed by local layout fixtures.                                                                                                                                                                                                                                                                                  |
| **F12 / P2 data dependency**       | Services/Diagnostics; public and workshop administrators                                                       | Current public service read has four records, one without duration.                                                                                                                                                                                               | **Blocked on workshop-approved duration.** No guessed duration, booking capacity or price is written. This is missing business data, not repaired code.                                                                                                                                                                                                                                                                                                                                                                               |
| **F13 / P1 release prerequisites** | Transactions, scheduling and financial settings; relevant roles                                                | Current public capability read reports `browse_enquiries`, `checkoutEnabled:false`, `bookingRequestsEnabled:false`.                                                                                                                                               | **Blocked/intentional release gates.** This package does not enable payments, appointments or transactions to make a page look complete. Existing/historical record access remains available under its existing permissions. Policy, provider, calendar and compatible migration acceptance remain separate.                                                                                                                                                                                                                          |
| **F14 / P3**                       | `/admin/orders`; Staff/Admin/Super Admin; empty list                                                           | Open an unfiltered empty order list with checkout disabled. Previous copy said orders would arrive through checkout.                                                                                                                                              | **Fixed and verified locally.** `staff-orders.tsx` uses the actual shared capability state. Closed release: existing records remain available, new online checkout unavailable. Enabled release retains appropriate checkout wording; filtered recovery stays unchanged.                                                                                                                                                                                                                                                              |
| **F15 / P2 business decision**     | Team & Access positions/responsibilities; authorised managers                                                  | Inspect `workforce-positions.ts`: nine approved business positions, no media-manager position. Position and independent responsibility templates are separate concepts.                                                                                           | **Blocked on approved duty/title/scope.** No broad media/auth role or grant is invented. Define the intended media duties and branch/approval boundaries before a separately verified permission change. Existing shared product/media support is preserved.                                                                                                                                                                                                                                                                          |
| **F16 / P2**                       | `/search?scope=all&search=…`; public/signed-in; all seven sizes                                                | Submit a mixed search with one matching vehicle. Previously results began around 684px laptop/839px phone, following large intro/form and empty categories.                                                                                                       | **Fixed and verified locally.** `search/page.tsx`, `search-results.tsx`, `search.module.css` use a compact submitted state, prioritise populated/error groups, and disclose empty categories with their original links. Remove a genuinely empty live-status grid row; retain the status during submission, editable query/scopes, server GET, Close/Escape, error/retry and history. Verify Back restores the prior query.                                                                                                           |
| **F17 / P3 optional**              | Learn/Allie affordances; 320px                                                                                 | Original wrapped text was readable without overflow. This alone did not establish a defect.                                                                                                                                                                       | **Superseded for the dashboard toolbar by F03; readable wrapping elsewhere retained.** No guidance is removed. The mobile icon keeps its explicit accessible label and target. Physical-device and screen-reader acceptance remain separate.                                                                                                                                                                                                                                                                                          |
| **F18 / P2**                       | Customer shell/profile, work shell; all seven sizes                                                            | Use a populated Customer profile with a photo, remove/update it in a fixture, then return a mismatched owner. Previously shell stayed email/UserRound.                                                                                                            | **Fixed and verified locally.** `dashboard-account.tsx` reads only the current own profile, displays genuine recorded name/photo, and invalidates on confirmed profile/photo changes. Preserve the exact private image URL (no extra query parameters); failed images fall back, mismatched/stale reads remove identity. Work accounts display an existing genuine employee name or My account. Admin photo storage/editing is not provided by the current model and is not fabricated.                                               |
| **F19 / P3 optional**              | Home single-listing section; laptop/tablet                                                                     | Earlier lone card occupied only 480px inside a much wider section.                                                                                                                                                                                                | **Fixed and verified locally.** `home.css` gives one real listing a centred feature up to 880px, with photo/details side-by-side from 768px and stacked on phones; `home-catalogue-preview.tsx` supplies accurate image sizes. Approved natural photograph colours, undistorted cover treatment and the white/photo hero remain unchanged. No duplicate listing or new homepage section.                                                                                                                                              |
| **F20 / P3**                       | Home/vehicle-card known-issues preview; especially 320px                                                       | Use a long owner statement, ending with a material qualification. Earlier CSS clamped after three lines.                                                                                                                                                          | **Fixed and verified locally.** `globals.css` permits the full statement to wrap, including explicit line breaks. Full detail and enquiry destinations are preserved. The fixture checks the final sentence and actual rendered clipping, rather than merely text presence.                                                                                                                                                                                                                                                           |

## Verification and failures retained

Local source checks already run: TypeScript without emitting or incremental cache; focused search/profile/order units; actual backend learning-projection/frontend-contract tests; scoped lint. Final exact counts and remaining failures are recorded at the verification checkpoint below. The backend learning projection is real code with environment/DB access boundaries mocked to throw: it performs no DB/provider calls. This is stronger contract evidence than an invented catalogue, but not deployed backend acceptance.

Seven exact viewports: **1280×720, 1024×768, 768×1024, 430×932, 390×844, 360×800, 320×720**. Tests verify actual dimensions. Main-matrix phone contexts use mobile+touch and DPR2; 768px uses touch. Supplementary boundary cases use mobile+touch at DPR1; existing Learn destination cases are desktop contexts resized to 390/1440×900. They are supplemental link/refresh checks, not physical-phone evidence. Edge and installed Chrome are dedicated test browsers. Both use Chromium; Firefox/WebKit were not installed, and no new browser was downloaded. This is emulation, not physical-device/Safari acceptance.

Initial core matrix: **40/42 passed**. Retained failures: first invoice navigation exceeded the local cold-compilation budget; a tablet profile remained on the session-verification screen. Neither was counted as a pass. A later populated-layout run found an actual empty search-status row and an incorrect test assumption that approved cover imagery must use `contain`; the row was fixed and the assertion now checks non-stretching `cover`/`contain`, preserving approved photography. Partial/interrupted runs remain evidence, not complete matrices.

Reused dependencies are Next **16.3.8**, while the current manifest requests **16.4.3**. No reinstall was performed. Local Next config loading initially failed on an extensionless TypeScript import. A test-process-only resolver loads the unchanged config; no deployment guard was removed. Exact-lock CI and hosted build acceptance remain required.

The exact failed startup was `node frontend/node_modules/next/dist/bin/next dev frontend --webpack --hostname 127.0.0.1 --port 3197`, with `Cannot find module './lib/backend-origin'` from `next.config.compiled.js`. An initial resolver attempt also failed on a null module filename; its scoped handling was corrected. A lint command initially used a doubled `frontend/frontend` dependency path; the corrected invocation was used. An exhaustive projection test initially hit Vitest's 5s per-test timeout; partitioning the same combinations into bounded cases preserved all assertions.

### Verification checkpoint

Local acceptance covers **128 distinct cases across corrected runs**, not a clean single-run claim: the final main matrix passed 98/112 and exposed the 14 search-history failures; after the full history-reload correction, targeted acceptance passed 28/30. Its two remaining Edge cases (initial hydration readiness at 390px and the bounded multi-destination Learn flow) then passed in a 4/4 rerun. The final Chrome real-profile-refresh checks passed 2/2. Repeated cases are not added to the distinct total.

The 128 comprise 56 shell/profile/invoice cases, 56 Home/search/support/directory cases, 12 ownership/image/release-boundary cases and four supplemental Learn destination cases. All seven requested sizes have Edge and Chrome coverage for the main journeys. Every security-layout case includes scoped Axe, target geometry, keyboard recovery and no page overflow. Search cases include Axe, actual editing, submission, Back and empty-category disclosure. Managed zero-grant access and denial, private portrait decoding/failure and closed-checkout copy are explicitly exercised.

Focused units: **81/81** in seven files; supplementary workforce-registry/search checks **20/20** in two files (these overlap the earlier search suite; do not sum them). TypeScript and scoped lint passed before final integration; exact integrated source checks remain required. No full local build or dependency installation was performed.

Search history needed both cached-document events and the full Back/Forward reload path, where page-show can precede hydration. The native GET fallback remains. The earlier timing-only attempt did not pass a fresh browser test and is not reported as successful.

A development-only React warning about a state update before mount appeared during an early Home warm-up; source attribution was not established. This is not counted as a passed console check. Security cases reported no unhandled page errors; production console/performance and physical-device acceptance remain separate.

Disk incident: a later reserve check reported 13.07 GiB free. Task-owned preview and fixture processes were stopped immediately. A subsequent read measured 22.08 GiB, without manual file deletion; no unsupported attribution of the transient change is made. This task's generated Next dev tree measured about 0.42 GiB. Useful caches, source, dependencies, databases, backups and other tasks' resources were retained. The reserve is a preflight, not a machine-wide quota.

The retained evidence directories are under `%TEMP%/allied-consolidated-audit-20261103*`. Selected synthetic local captures are retained below after visual review. Authentication and private production data are excluded.

## Remaining boundaries and next actions

1. Final exact-source CI, hosted/native browser checks and compatible production publication are complete as recorded above; later unrelated master work remains preserved.
2. Keep the recorded real-role, private-storage and device limitations distinct from the completed source, fixture, public and operational checks.
3. Obtain genuine product media/identity, fitment evidence, approved service duration and any new position/duty decision. These are not solved by invented data or permission broadening.
4. Work-account name/photo authoring needs a separately designed canonical identity contract if required; the current work profile is truthfully read-only. Customer profile upload/removal uses the existing reviewed workflow; real storage, other real roles, Safari/Firefox, physical devices, full screen-reader use and production persistence remain outside this local acceptance.

Brand application stays deliberate: existing navy/black navigation, red primary actions/focus and restrained black-to-red separators establish hierarchy. Keep white reading surfaces, natural photographs and meaningful status colours. No broad colour or homepage redesign was needed to fix these journeys.

## Reviewed local captures

The dashboard captures use local fixtures; work-profile captures use native released assets with isolated role fixtures. Home/search captures use genuine public production inventory. Mobile labels are CSS viewport dimensions, with DPR2 in the main matrix. The visible Next development indicator is tooling, not shipped product UI.

| Journey        | Desktop 1280×720                                                                 | Phone 320×720                                                                 |
| -------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| first viewport | [Desktop](evidence/consolidated-audit-20261103/home-first-viewport-1280x720.png) | [Phone](evidence/consolidated-audit-20261103/home-first-viewport-320x720.png) |
| dashboard      | [Desktop](evidence/consolidated-audit-20261103/dashboard-1280x720.png)           | [Phone](evidence/consolidated-audit-20261103/dashboard-320x720.png)           |
| home-vehicle   | [Desktop](evidence/consolidated-audit-20261103/home-vehicle-1280x720.png)        | [Phone](evidence/consolidated-audit-20261103/home-vehicle-320x720.png)        |
| search         | [Desktop](evidence/consolidated-audit-20261103/search-1280x720.png)              | [Phone](evidence/consolidated-audit-20261103/search-320x720.png)              |
| work-profile   | [Desktop](evidence/consolidated-audit-20261103/work-profile-1280x720.png)        | [Phone](evidence/consolidated-audit-20261103/work-profile-320x720.png)        |

Final profile refinement is verified on protected hosted preview `dpl_Berpr5K7VFgJFqnZ9hh7UwET9sdH` (source `68c37ea8`, exact-lock Next 16.4.3): **14/14** cases, all seven sizes in Edge and Chrome. The genuine My profile breadcrumb, white card, profile refresh, own-account destination, keyboard recovery, measured viewport, overflow and absence of API writes/page errors passed. The two work-profile images above are replaced with visually reviewed hosted captures. They still use isolated role records, not actual account acceptance. Preview server availability was unavailable in one desktop capture; this is not accepted production-backend availability.

### Integrated release checkpoint

PR #12 contains the signed audit implementation and preserved master purchase changes. Integrated TypeScript, scoped lint and formatting pass; focused learning/registry units pass 62/62, and search/profile/order units pass 30/30. Preview build succeeded using the exact locked Next 16.4.3. No production promotion is asserted.

GitHub backend run 41692070146 passed migration replay, db:check, compiler/lint and isolated operational suites, then failed three retrieval-coverage cases because the new profile article destination was absent from Allie's strict server allowlist. The specific `/admin/profile` target is added; no arbitrary destinations or audience permissions are permitted. The corrective source requires a fresh exact-source run. The frontend run 41692070284 passed full production checks; its final runtime regressions were still running at this checkpoint. The secret guard passed.

Hosted-test command: `vercel env run --project prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb --scope team_uLFNuPMclr4G31M2Aaeopjxu -- node C:/Users/PC/Desktop/allied-autotech/frontend/node_modules/@playwright/test/cli.js test --config C:/Users/PC/AppData/Local/Temp/allied-audit-hosted-profile-harness/allied-audit-hosted-profile.config.cjs`. Authentication remains short-lived in memory and origin-scoped; no token or authentication file was saved. The first config used the entire Temp folder and failed with `EPERM: operation not permitted, scandir C:\Users\PC\AppData\Local\Temp\WinSAT`; moving only the two harness files into a dedicated small directory fixed test discovery.

The first local server-retrieval rerun stopped at a missing ignored generated Prisma client before running any tests. Dependencies were reused; generating the client from the committed schema uses an unreachable loopback unit-test target and performs no migration. Actual production backend remains ACTIVE deployment `adc7be72-e564-4fc7-b1db-5f1c0f8d4cf2`, independently inspected through the provider. No pending deployment was returned. The concurrent purchase release and migration/restore prerequisites remain outside any claimed publication.

Corrective local acceptance: generated client 7.10.0 from the committed schema; all three server learning/retrieval files pass **27/27**, including the previously failed work-profile cases. Scoped backend lint passes. No database connection, provider request or migration was made. Master changed-offer source `88ed8694` is preserved by signed merge `10b734db`; both conflicting tracker additions were retained.
