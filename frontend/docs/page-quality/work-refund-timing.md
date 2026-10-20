# Bank refund timing — accepted local milestone 101

Route `/admin/refund-timing`; accepted locally on 19 October 2026. The whole-application goal remains active. Managed-workforce integration, application-wide role regression and deployed acceptance remain open; the central owner decision hub remains proposed consolidation.

## Result

The owner can distinguish the current approved calendar, the next revision that will actually supersede it, the latest recorded revision and complete facts for the latest 100 historical revisions. The grouped form exposes only supported start events, weekdays, holiday dates, scheduling and approval provenance. Duration, counting convention and Lagos timezone remain fixed.

Drafts retain their original revision through refresh/reload and require explicit replacement after a conflict. Calendar approval consent never restores. Fresh actor/profile/version checks precede publication, exact Q6 receipts retire drafts, and persistent actor-bound uncertain outcomes require read-only inspection and independent reconciliation without replay. Super Admin/MFA and backend permission checks remain authoritative.

The compatible [backend workspace](../../../backend/docs/refund-timing-workspace.md) independently selects current/next facts beyond bounded history, using the same approved version ordering as the refund engine. Publication checks current actor/session before immutable version/audit creation. A directly related calculator correction replaces the arbitrary 1,000-day search cutoff with a bounded search based on unique excluded dates; sparse valid calendars now receive all ten banking days. No saved deadline is recalculated, and no money movement, receipt confirmation or status transition is introduced.

## Design acceptance

Four native baseline widths preceded fresh built-in ImageGen [desktop](work-refund-timing-oct-concepts/desktop.png) and [mobile/form/review](work-refund-timing-oct-concepts/mobile-form-review.png) concepts. [Audit](work-refund-timing-oct-concepts/audit.md), [specification](work-refund-timing-oct-concepts/spec.md) and [prompts](work-refund-timing-oct-concepts/prompts.md) were saved before runtime work. Browser plugin is unavailable, so verification used the existing sequential Playwright/Edge fallback at `http://localhost:3070`.

Final native 430/768/1280/1440 viewport captures, full desktop page and 430 form/review captures were inspected against both saved concepts using `view_image`. All four native captures have no horizontal overflow or page errors. Full-page capture is additional rhythm evidence; native viewports remain the fidelity evidence.

| Comparison          | Final evidence                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy and copy  | Two-item breadcrumb, compact title, exact purpose, outlined refresh, impact note, named current/editor sections; no unapproved business promises. Above-fold source copy matches the contract-corrected specification. |
| Layout              | 38/62 desktop columns, stacked tablet/mobile, complete downstream history. Actual labels and full policy facts have natural height rather than compressed generated text.                                              |
| Calendar facts      | Read-only weekday text, fixed rule, holiday disclosure, evaluated timestamp and distinct current/next/latest revisions with full Lagos dates.                                                                          |
| Form                | Three numbered groups, visible borders, compact weekday grid, one datetime-local input, source/evidence length guidance and fresh consent.                                                                             |
| Focus and actions   | Brand-red focus verified by computed styles; cancellation returns focus and clears consent; success focuses the confirmation.                                                                                          |
| Responsive review   | Complete facts and accessible stacked mobile actions in the existing bounded native dialog; maximum holiday list scrolls without page overflow.                                                                        |
| Surface and density | Existing real Allied shell/logo, Quicksand UI, cool canvas, white sections and restrained red. Final corrections reduce breadcrumb spacing, prevent tablet refresh wrapping and enforce compact textarea height.       |

Intentional deviations: real shell/logo/full timestamps replace generated examples; current weekdays are not editable; generated blue accents and invented names/references are omitted; labels remain above controls. Existing `MutationReview` uses a native modal on mobile rather than the concept's inline review, retaining focus management, inert background and scrollable facts. These differences are documented, and no material visual mismatch remains against the corrected specification.

## Verification

- **25 distinct production-browser cases pass.** Original run: 21 pass, two timeout failures during a prolonged browser interruption. The same two viewport cases passed unchanged in a focused rerun. Two additional cases prove the 366/367 holiday boundary and failed-refresh draft preservation. Final CSS-only build then passed all seven responsive page/review cases again.
- **17 distinct Axe scans pass:** seven page/review pairs, failed/denied reads and maximum-calendar review. Final presentation changes additionally passed the repeated 14 responsive scans at 320/375/430/768/1280/1440/1920.
- **Seven frontend units pass:** current/scheduled selection, bounded history, approved status, foreign/duplicate/contradictory facts, exact Q6/actor/calendar receipt, minimal pending metadata, identity/storage failure handling.
- **Four isolated API scenarios pass:** current outside history cap, version-first semantics and ignored lower future versions, private atomic READ audit, role/MFA/query/CSRF/typed validation, concurrent one-version publication/audit, and distinct future calendar publication preserving earlier versions.
- **Four owner-calendar units pass**, including existing exact ten-day arithmetic and the new sparse-calendar regression beyond 1,000 days with duplicate excluded dates.
- Frontend/backend type checks, focused lint, touched formatting, OpenAPI export/validation/route coverage, generated API types/inventory and final production build/standalone preparation pass. Contracts cover 313 paths, 367 operations and four infrastructure routes. Twelve relevant runtime source hashes match the final production snapshot.

Primary external browser evidence under `C:/Users/PC/.codex/`: `work-refund-timing-e2e-results`, `work-refund-timing-e2e-focused-results`, `work-refund-timing-e2e-boundary-results`, `work-refund-timing-e2e-final-results`, `work-refund-timing-final-*` and `work-refund-timing-source-hashes.json`. The build reused the established snapshot and historical `work-reservation-build.cjs/log` helper; both final build steps exited 0. An initial directive-order compilation error was corrected before browser validation.

## Connected and data-preservation evidence

API and connected harnesses verified `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment and restricted runtime before writes. API originals remained hash-identical: 65 users, 57 staff profiles, 544 policies, 581 prior audits, three bookings and 40 branches. Synthetic fixtures were retained; temporary sessions were removed. The preservation artifact filename typo was corrected by copying the successful evidence, without replaying mutations.

Connected production Edge → real Express → PostgreSQL verified cancellation without writes, one exact future calendar approval with draft retirement/focus, and one committed future approval with a deliberately lost response. Reload and explicit reconciliation generated no replay. Exactly two POSTs/two CREATE audits and 12 supporting READ audits were recorded. All 650 pre-existing policy versions and original account/booking/branch snapshots stayed unchanged, as did the current selected calendar. No page errors; zero temporary sessions. Evidence: `work-refund-timing-real.json` and guarded before/progress files. These workflows were not repeated after CSS-only changes or the independent arithmetic bound correction.

Financial/order/refund/vehicle transaction tables in this fixture are empty. This gate does not newly prove populated refund/acceptance preservation. The arithmetic correction has direct unit evidence; the existing snapshot selection and dueAt-preservation guard were inspected and left unchanged.

No schema/migration, privilege, shared/application database write, provider action, backup/restore rehearsal, push or deployment occurred. Existing unchanged migration replay/db:check/privilege evidence is reused. ADM-63's durable original-request receipts remain optional follow-up; current-state reconciliation cannot prove an interrupted request's original outcome. Release this compatible API/client/calculator together and verify the deployed environment separately.
