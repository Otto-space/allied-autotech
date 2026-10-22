# Workshop vehicle inspections

Locally accepted 17 October 2026, milestone 71. Route `/admin/inspections`.
The API collection is `/staff/vehicle-inspections`; these are different paths.

## Implemented experience

The index now has one named breadcrumb/header, compact persistent status/branch
filters and readable request cards. Each card retains the actual vehicle title,
stock number, customer, reference, version, branch reference, complete preference
and scheduled interval, assignment, notes, cancellation reason and available
lifecycle dates. No total, synthetic request number, branch label or thumbnail is
invented. Admin branch choices include inactive historical branches. Cursor
paging, reload, browser Back and filter resets preserve their exact URL scope.
Invalid/duplicate/unknown filters and foreign Staff branch links fail before reads.

Reads wait for current own profile and Staff assignment. Collection parsing checks
scope, unique references, timestamp intervals and assignment consistency. A
temporary read failure retains facts with mutations disabled; denial clears them.
The existing progress form, branch/staff pickers, condition evidence and review
dialog are reused. Completed requests without reports retain stock guidance.
Reports retain null/zero odometers/scores and typed findings.

Before POST, fresh own access and the relevant record on the current collection
page must still match. A moved/changed record stops submission and preserves the
draft for refresh/explicit reload. Backend atomic version checks still protect
the remaining race. Full success validates identity, next version, status,
listing/branch, assignee, schedule and reason. Own successful changes update/reset
the form; concurrent changes preserve drafts until explicit field reload. Older
reads cannot replace known newer versions.

A minimal owner/role recovery marker is verified before mutations. Uncertain,
malformed, mismatched, 408/429 and interrupted responses stay locked through reload.
Explicit current-page reconciliation replaces this page's unsaved drafts without
resending or proving the original outcome. Session invalidation redacts metadata
while retaining the lock; unavailable storage fails closed. A definite backend
rejection is reported separately from an unsent preflight failure. This wording
correction also applies to vehicle detail, with a focused passing regression.

No backend endpoint, permission, schema or generated request contract changed.
See the [existing API and recovery boundary](../../../backend/docs/workshop-inspections.md).

## Concepts, fidelity and copy

Fresh built-in Image Gen [desktop](work-inspections-oct-concepts/desktop.png) and
[mobile](work-inspections-oct-concepts/mobile.png) concepts were inspected before
UI edits. The [audit](work-inspections-oct-concepts/audit.md),
[specification](work-inspections-oct-concepts/spec.md) and exact
[prompt set](work-inspections-oct-concepts/prompts.md) are saved in the workspace.
No generated image enters the application. Browser plugin tools were unavailable;
verification used the production Next.js build, Playwright/Edge, Axe and
`view_image` inspection.

Native comparison used **1536x1024 desktop** and **1024x1536 mobile-reference**
PNGs. The generated mobile concept is a framed composition inside a wide canvas.
At that native width the actual application retains its sidebar/tablet shell;
practical 430px and 320px views verify the real mobile flow. Both concepts and
final native viewport/continuation captures were inspected, along with review,
condition evidence and long-content views. Existing fixed-shell behavior is judged
from viewport captures rather than full-page stitches.

| Comparison       | Final disposition                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition      | The named header, compact white filter panel, request band and stacked named cards follow the concepts. Actual Allied logo/navigation/account controls replace generated approximations.                                                                 |
| Type             | Computed Quicksand and 13px body; the existing dashboard cascade retains 30px wide headings and 24px narrower headings rather than the brief's 28px wide title. Filter labels/controls are scoped to 13px.                                               |
| Spacing/surfaces | Cool canvas, white 12px cards, fine separators and restrained red actions remain. Visual review found inherited form margins/action rules; scoped overrides remove that excess filter height.                                                            |
| Facts            | Four-column desktop facts become two on tablet and one on narrow screens. Full UUIDs, precise timestamps and both interval endpoints replace fabricated human references and compressed dates.                                                           |
| Controls         | Ordinary controls remain at least 44px; final filter selects measure 46px and refresh controls >=44px. Mobile actions stack. The generated mobile 'No' reschedule option becomes the actual lifecycle selector.                                          |
| Media/privacy    | Generated vehicle thumbnails, fabricated branch names and last-updated stamps are omitted because the inspection projection cannot establish them. Existing stock guidance remains; no unsupported detail route or public-availability promise is added. |
| Workflow states  | Expanded progress, complete review, current-read/pending panels, error states and typed condition evidence extend the references to supported operations and failure recovery.                                                                           |

Copy reconciliation preserves **Vehicle inspections**, **Refresh inspection
records**, **Manage inspection progress**, **Review inspection change** and
**Recorded condition report**. Filters are explicitly **Inspection status filter**
and **Branch filter**, with **Apply filters** and **Clear inspection filters**.
Page counts say **on this page**. Recovery copy explicitly says the previous
request outcome is not proven. Completion retains the existing warning that it
does not reserve the vehicle, collect payment or create a condition report.

## Verification

- **28 distinct browser cases** have passing evidence: 22 new inspection cases,
  five existing inspection/history workflows and one vehicle-detail rejection
  regression. The 27 inspection cases passed together. Following the CSS-only
  spacing correction, the affected responsive/review case was rerun successfully.
- **Six new focused unit cases** passed for query/trail reuse, strict scope/data,
  transition receipts, minimal recovery, redaction, draft isolation and unavailable
  storage. Unchanged shared review/form/asset checks from milestone 70 were reused.
- **Three API/database scenarios** passed for 25+3 stable paging, combined status/
  branch scope, historical inactive branch reads, private projections, roles/MFA,
  independent versions, exact schedules, Staff self-assignment, Admin assignee
  eligibility, cancellation, stale/closed transitions and exact audit counts.
- **18 final Axe scans** passed: seven responsive widths plus review, and ten
  native/state/evidence captures. Existing workflow scans also passed. Widths
  320/360/390/768/1024/1280/1440 have no page overflow; long names, stock numbers,
  notes and UUIDs remain readable. No captured browser page errors occurred.
- Frontend/backend type checks, focused frontend ESLint/backend oxlint, formatting
  and the final production build passed. All **20 frontend source/dependency
  hashes** match the tested final production snapshot.
- Connected production Edge/Express/PostgreSQL verified **25+3 paging with reload
  and Back**, reviewed cancellation without writes, Admin confirmation/reschedule/
  completion, a committed lost cancellation response, reload/manual read without
  replay, and Staff self-assignment. **Five UI requests returned 200 and produced
  five STATUS_CHANGE audits**. The scheduled request reached version 3; the
  cancelled request reached version 1. No condition report was implicitly created.
- Preferred milliseconds remained intact. Staff reassignment blocked the next
  write and removed old branch facts. Customer/anonymous browser access was denied.
  The connected workflow produced no page errors.

## Database and remaining scope

Before fixture writes, actual **127.0.0.1:55480 /
allied_work_aftercare_20261017_test** and isolated-test environment were verified.
Existing restricted runtime credentials were reused. Synthetic domain records are
preserved; only owned test sessions were removed. No shared/application database,
schema, migration, grant or startup change occurred. Unchanged 59-migration
db:check, empty replay and privilege evidence were reused. No backup, restore,
push or deployment operation ran.

ADM-27 records optional durable inspection-transition receipts. The existing
manual workflow is locally accepted; target rollout and application-wide
verification remain open. Next: vehicle sales `/admin/vehicle-sales`, followed by
its separate transaction detail gate. The overall goal remains active.

Local evidence under `C:/Users/PC/.codex/work-inspections-`:
`browser.log`, `vehicle-rejection.log`, `unit.log`, `api-tests.log`, `real.json`,
`captures.json`, `source-hashes.json`, `final-visual.log`, `build.log`, static logs
and matching final PNGs.
