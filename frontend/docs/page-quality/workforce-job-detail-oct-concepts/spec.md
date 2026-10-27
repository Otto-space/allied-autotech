# Workforce job detail — pre-implementation specification, milestone 105

Route `/admin/workforce/jobs/[id]`. Milestone 104 is accepted. This page alone is the next implementation gate; the full goal remains active.

## Audited baseline

The existing page and backend were inspected on 19 October 2026. Native full-page baselines at 430, 768, 1280 and 1440px are retained outside the repository under `C:/Users/PC/.codex/workforce-job-detail-baseline-*`. All four were inspected: no horizontal overflow or page errors, but excessive vertical gaps, sparse unbounded facts, a generic detail breadcrumb, missing branch/technician labels and raw uppercase states. Technical work, independent quality approval and lead assignment already exist and must remain functional.

Current implementation risks to correct within this page:

- Refresh clears the in-memory uncertain-result lock without reconciliation; reload loses it entirely.
- Mutation confirmation shows the job identity but omits the submitted fields/reason/target. Receipt validation checks only the job ID.
- Background refresh errors are not included in the render gate; saved forms keyed by work version can silently reset edits.
- Assignment controls appear on closed bookings. Quality controls do not explicitly require the booking to be in progress.
- Empty replacements silently omit existing notes, and unchanged forms can submit existing values as an apparent update.
- Assignee discovery silently caps the unpaginated list at 100. Complete discovery needs bounded server-side search/paging.

## Existing authoritative contracts

All routes require current managed workforce access with active/verified account, session/MFA and relevant responsibility. Workforce and actor locks, booking row locks for changes, expected versions, scoped queries and atomic audits remain authoritative. No schema/migration or permission expansion is planned.

| Operation        | Existing rule                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET job          | JOBS_READ; eligible lead branches or technician's assigned job in an eligible branch. Minimal job/work-order fields.                                                                                                                                                                                                                                                                                                 |
| PATCH work       | JOBS_UPDATE; booking CONFIRMED or IN_PROGRESS; work APPROVED, IN_PROGRESS or AWAITING_PARTS; work expectedVersion. Diagnosis/internalNotes trimmed 1–5,000 if supplied. At least one field. APPROVED/AWAITING_PARTS can enter IN_PROGRESS; IN_PROGRESS can enter AWAITING_PARTS or QUALITY_CHECK. Starting confirmed work also increments booking version and sets it IN_PROGRESS. Records actor in workedByUserIds. |
| POST quality     | QUALITY_APPROVE; work QUALITY_CHECK, booking IN_PROGRESS, expected work version. Reason 10–1,000 characters. Must have attributed workers and actor must be neither a worker nor the assigned technician. Completes work and booking, records reviewer/time, cancels pending reminders, audits atomically.                                                                                                           |
| PATCH assignment | JOBS_ASSIGN; booking REQUESTED, AWAITING_DEPOSIT, CONFIRMED or IN_PROGRESS; expected booking version; staff UUID and reason 10–1,000. Target must have active work access in the same branch. Increments booking version; work version is unchanged.                                                                                                                                                                 |
| GET assignees    | JOBS_ASSIGN in the job's branch; active verified staff/admin with eligible current branch responsibility. Existing unparameterized response caps at 100. Enquiry assignees share this implementation and must retain their existing contract.                                                                                                                                                                        |

## Concepts and locked design

Fresh built-in Image Gen concepts are stored here as `desktop.png`, `mobile.png` and `lead-actions.png`. Source originals are retained under `C:/Users/PC/.codex/generated_images/01a0ee83-4516-7760-bc1b-b4ceaf4d6a66/`. The prompt descriptions cover the complete technician desktop/mobile page and the separate lead-quality/assignment sections. These are design references; all controls and content must be code-native.

Keep the actual dashboard shell, logo, search, account/navigation and Quicksand. Ink `#01121A`, red `#E60301`, cool canvas, white panels, `#ccd6df` borders, 6px radii, no ornamental shadows or gradients. Heading 28px desktop/24px mobile, section 19px, body/fields 14px, support 13px. Controls and named pagination at least 44px. Lucide outline icons for vehicle, calendar, branch, user, refresh, back and breadcrumb chevrons.

Breadcrumb Overview / Workshop jobs / actual work-order number (Job details fallback), with one semantic landmark and current item. Queue link and Back to jobs preserve the validated queue filter/paging query. Compact heading, service subtitle, refresh/generated-time control and separate labeled work/booking states. No hero eyebrow, financial data, fabricated totals or extra actions.

Desktop uses two main columns: job overview approximately 42%, technical editor 58%, gap24. Overview contains vehicle/year/registration, full Lagos schedule, named branch and assigned technician, then divided reported symptoms, recorded diagnosis and recorded work notes. The editor contains diagnosis, work notes/parts needed, progress, existing-note limitation and Review technical update. Read-only states show recorded facts and an explanation without unavailable forms. The action column can contain quality review instead when eligible; lead assignment is a separate full-width section below.

Below 1050px content width, stack the main sections. Below 640px stack fact label/value pairs and heading controls for readable long names. Mobile keeps overview then technical/quality work then assignment, with the primary review action full width. Breadcrumb middle item may collapse at narrow widths while retaining accessible navigation. No horizontal scrolling or sticky controls obscuring content.

Intentional corrections to generated images, recorded before implementation:

- The desktop progress default must read **Keep current state**, matching mobile. Re-selecting the existing state is not an allowed transition.
- The existing shell/logo and exact Quicksand sizes replace generated approximations. Use flat brand red, not generated button shading; use outline icons consistently.
- Narrow mobile facts and refresh stack to preserve 14px text and 44px targets; the generated mobile image is illustrative rather than a requirement to compress a desktop-style two-column definition list into 430px.
- First/Previous pagination are disabled only when there is no earlier candidate page. Candidate names, statuses and counts come from the server, not illustrative image records.
- Quality summary can refer to the overview's recorded notes without duplicating them inside nested cards; the focused reference establishes findings/reason/eligibility hierarchy, while the main page already presents the same evidence.

Connected-test refinement: two eligible staff records had identical names. Candidate rows, retained selection and confirmation now show the complete existing staff reference, with wrapping secondary text. This intentionally adds identity information absent from the generated lead concept, allowing the lead to distinguish accounts without exposing contact details or making a name-only assignment. The exact reference is included in the accessible radio label and confirmation.

## Required interaction and recovery behavior

Read responses must carry their own access snapshot, generation time and minimal branch/assigned-staff references; compare scope with the current shell and validate target identity. Hide job facts/actions on denied, malformed, mismatched, loading or failed refresh. Preserve unsent drafts in component memory through harmless refresh; a changed record/version requires explicit review/reload of the draft, never silent overwrite or automatic rebase. Session/access changes remove sensitive visible content. Temporary assignment expiry must remove access.

Technical form submits only changed nonempty fields and a valid optional transition. Reject empty replacements for existing notes with a clear field message, and explain that this API does not clear saved notes. Reject unchanged submissions. Trim and validate findings/reasons. Hide assignment on closed bookings, and quality approval unless the booking is IN_PROGRESS and independent-review rules hold. Never infer worker attribution or weaken self-review restrictions.

Assignment uses explicit server name search, bounded pages, named next/previous/first navigation, radio selection and a retained selected technician summary. Search/paging never assigns. Recheck selected eligibility before confirmation. Do not leak other-branch candidates or use a truncated local list as complete discovery.

Use the existing accessible review-dialog family. Show job identity and exact proposed values, progression or technician plus reason. Require a fresh authorized own-access/job preflight and compare inspected revisions before sending. Apply CSRF and existing expectedVersion. Check returned identity, relevant new versions, actual submitted values, changed states and worker/reviewer evidence; no success based solely on a successful HTTP status.

Before a mutation, persist a minimal actor-bound pending marker with random token, job/action/version identifiers and a fingerprint; store no notes, reasons or customer facts. If storage fails, do not send. Clear only after a verified receipt or a definite server rejection. A lost/malformed response remains locked across refresh/reload; never automatically resend. Provide fresh read-only inspection plus explicit independent reconciliation before clearing a pending lock. Explain that current state cannot prove the outcome of an original request. Server-side durable original-request receipts remain a separately documented improvement; local storage is not cross-device idempotency.

Loading, no work order, missing vehicle/assignee, read-only/closed, unavailable reviewer, empty candidate search, errors, conflicts, uncertain outcomes and success must have clear copy/focus. No blank sections, fake success or inert controls.

## Backend additions and compatibility

Extend only the job-detail and job-mutation response with the authorized access snapshot, generatedAt, minimal branch name and assigned staff identity/name. Keep existing job fields and queue projection stable. Use the same transaction to read final records; do not change mutation permissions or workflow.

Add explicit bounded search/paging to the job-assignees route. Requests with no query must preserve the existing unpaginated response for compatibility; the new page requests explicit limit25 and uses the paginated response/access/job/branch metadata. Keep enquiry assignee behavior unchanged. Search is literal, trimmed, bounded and case-insensitive; cursor order must be deterministic. Document and regenerate OpenAPI/types before production builds.

## Acceptance gate

Before local acceptance: unit tests for identity/scope, transitions, changed-field input and exact receipts/pending markers; API/database checks for both read projections, candidate pages/search, access boundaries, three mutation types, version conflicts, independent review and audit/preservation; browser cases for technician/lead/read-only/missing/long data, all supported action paths, keyboard/focus, drafts, failure/conflict/uncertainty/reload, candidate search/paging and queue return. Verify at 360/390/430/768/1024/1280/1440 plus long content320; Axe, native 430/768/1280/1440 comparison against local concepts, focused affected-route regression, type/lint/format/OpenAPI/build and source hashes. Connected production browser → API → verified isolated test database must confirm real actions/recovery and preserved original rows without replaying completed writes.

Database safeguards remain mandatory. Existing unchanged migration evidence may be reused only for schema-free work; every write needs verified isolated target/restricted credentials. No application/shared database writes or rollout are part of this local gate. Deployed, physical-device and broader application acceptance remain open.
