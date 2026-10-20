# Staff personal notifications — local acceptance, milestone 97

Accepted locally on 19 October 2026 for `/admin/notifications` in the existing personal-account workspace. The application-wide goal remains active. Managed-workforce accounts retain their separate workspace and current API restriction; that integration is explicitly open under ADM-66. Next separate route: booking capacity `/admin/booking-capacity`.

## Implementation

The page now combines a compact ruled inbox with a dark-header preference rail. Complete notification bodies, explicit Read/Unread labels, Lagos timestamps and supported type/category/unread filters remain visible. Desktop uses a flexible inbox plus 340px preferences; mobile stacks them. A real ordered breadcrumb links to Overview with ChevronRight and current-page semantics.

The accepted customer inbox/preferences were extracted into [shared account regions](../../app/components/account-notifications.tsx). The customer entry point and visual behavior remain intact. Each staff region receives the exact current role and role-derived endpoint. The inbox write guard now accepts an explicit role, retaining CUSTOMER as its default. Fresh account/role preflight, stale-read blocking, account-bound pending markers, manual refresh and explicit acknowledgement protect staff read changes across reload. Preferences retain their existing revision and original-request recovery contract; no API, schema or backend runtime change was needed.

Read-all review explains its full-account scope, including records outside the current page/filter. Already-read rows have no read action. Absent operational preferences default enabled; marketing remains disabled without consent and unavailable for actual delivery. An explicit preference recovery may apply a never-received original request or retrieve a committed receipt while preserving a later choice. The UI never sends recovery automatically.

## Design and visual verification

Four native baselines at 430/768/1280/1440 were captured and inspected before edits. Fresh complete built-in ImageGen [desktop](work-notifications-oct-concepts/desktop.png) and [mobile/recovery](work-notifications-oct-concepts/mobile-recovery.png) concepts preceded runtime implementation. See [audit](work-notifications-oct-concepts/audit.md), [specification](work-notifications-oct-concepts/spec.md) and [prompt provenance](work-notifications-oct-concepts/prompts.md). Browser-plugin access was unavailable; sequential Playwright/Edge used the established fallback.

Both concepts and all four native final viewports were directly inspected, together with the mobile preference continuation and original-request recovery dialog. No overflow or page errors occurred in the four final captures. Contract corrections were specified before implementation.

| Comparison point       | Implemented result                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading and navigation | Exact My notifications title/subtitle, no eyebrow, ordered breadcrumb with real Overview link and 44px target. Existing Allied shell remains authoritative.                                                       |
| Composition            | Flexible inbox plus 340px preference rail, 24px gap; single column below 1100px.                                                                                                                                  |
| Inbox                  | Compact labelled filters and toolbar, thin message rules/status rails, complete body/newlines, readable date and conditional read action. Existing stacked message anatomy replaces generated compressed columns. |
| Preferences            | Dark mobile-concept header, four supported pairs, neutral states/actions, explicit default labels and honest mandatory-message/delivery limitations.                                                              |
| Mobile                 | Stacked 48px/16px fields, readable long content, minimum 44px buttons, complete preference continuation and scrollable dialogs.                                                                                   |
| Recovery               | Existing exact recovery explanation/facts and Send or recover preference action preserve newer settings. Go back restores focus; no automatic replay.                                                             |
| Visual system          | Quicksand, 30/24px titles, 20px sections, cool canvas, white surfaces, visible borders, 6px corners and restrained red match the corrected specification.                                                         |

## Test evidence

- **95 distinct production browser scenarios have passing evidence:** 38 staff-page cases, 35 customer-page quality cases, 17 existing notification cases and five preference replay cases. The first combined run passed 94/95; the corrected role-change assertion passed its focused repeat. The existing guard invalidates the session and closes the dialog, so expecting a disabled dialog was wrong. No runtime change was needed.
- Seven staff widths (320/375/430/768/1280/1440/1920) pass layout and page/review Axe checks. Four error/uncertain/stale/empty states and a separate mobile original-request recovery dialog also pass Axe: **19 staff-page scans**. Existing customer/regression scans add affected-route coverage.
- Eleven unit cases pass across preference recovery and resource-background refresh. Production webpack/TypeScript/standalone build, changed-file lint/format and diff whitespace checks pass. Thirteen runtime source hashes match the production snapshot.
- The supplementary recovery capture initially used Playwright's convenience newPage API, which Axe rejects; using an explicit browser context fixed the harness. Its corrected scan/capture passed. No product change or database operation was involved.

## Connected browser/API/database evidence

Before writes, the harness verified `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment and restricted runtime. A new synthetic staff account and separate synthetic customer own the fixtures; original application/test rows were preserved.

The actual production browser and Express/PostgreSQL flow verified 25+2 paging and type filtering; a committed individual-read response deliberately lost, reload/manual recovery without replay; repeat-read timestamp preservation; read-all cancellation and confirmed update of 27 remaining records including expired/filtered rows; and foreign-account isolation. Preference cancellation saved nothing. A committed marketing preference response was lost, a separate valid withdrawal created version two, and explicit original-request recovery retained disabled/version-two state. Four UI mutation requests were sent: individual read, read-all, original preference and explicit preference recovery. The separate API withdrawal is additional. Final preference storage has one pair, exactly two consent rows, two UPDATE audits and two request receipts; recovery adds none.

The subsequent foreign-ID check used a CSRF token retained from before browser reload and correctly received 403. A fresh-session continuation verified the intended 404 ownership boundary, missing-CSRF 403, immutable-category 422, customer/staff route separation, missing-MFA 403, anonymous 401 and private projections/no-store. Completed UI mutations were retained, not rerun. Original hashes remained unchanged for 63 users, 56 staff profiles, one notification, 511 audits, 328 policy versions and existing preference/receipt/financial/privacy/hold rows. Zero temporary sessions remain.

The initial connected attempt did not persist its browser-error list before that later assertion failed; it is not reported as proving zero errors. A separate read-only production-browser continuation verified 25 owned rows, retained disabled/version-two preference, zero page errors, zero UI mutations and no mobile overflow. Its temporary session was removed.

Existing managed-workforce Admin received 403 from the legacy personal notification endpoint; Super Admin received 200 without foreign fixture rows. This matches `enforceWorkforceBoundary` and the shell's workforce rendering branch, not a newly introduced permission change. Browser fixtures separately verify STAFF/ADMIN/SUPER_ADMIN in the personal-account workspace. Managed-workforce notification integration remains ADM-66 and part of the full role audit.

Evidence under `C:/Users/PC/.codex/`: `work-notifications-production-tests`, `work-notifications-role-recheck`, `work-notifications-build.log`, `work-notifications-source-hashes.json`, `work-notifications-final*.png/json`, `work-notifications-recovery-430.png`, `work-notifications-recovery-capture.json`, `work-notifications-real-progress.json`, `work-notifications-real.json`, and `work-notifications-real-readonly.json/png`.

## Remaining boundaries

No backend runtime, schema/migration, existing grant, shared/application database, provider, backup/restore, push or deployment operation ran. Unchanged backend preference/migration safety evidence is reused; the connected test does not certify deployed delivery. Marketing remains pending approved Q12 policy and implementation. Managed-workforce access, remaining routes, application-wide regression and deployed checks remain open. See [backend integration notes](../../../backend/docs/staff-notifications-workspace.md) and [backend gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md).
