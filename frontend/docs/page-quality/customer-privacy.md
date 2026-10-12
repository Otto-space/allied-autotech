# Customer privacy requests

Route: `/dashboard/privacy`. Audit started 12 October 2026. Status: locally accepted on 12 October 2026; forty-second expanded page milestone.

## Audit and scope

The original customer page placed a large stacked form ahead of the history, repeated generic section framing, and offered little visual distinction between the request, its status and the review response. Its existing confirmation and owner checks were useful. Unknown outcomes blocked further writes only in memory; background revalidation errors were not included in the form's disabled condition.

Four baseline captures at 390, 768, 1280 and 1440px were inspected. Two fresh [desktop/mobile/state concepts and the extracted specification](customer-privacy-oct-concepts/README.md) preceded production edits. The desktop native dimensions are 1435 x 1096. The existing dashboard logo, navigation, search, support dock, role gates and bundled Quicksand remain authoritative.

Only customer intake/history is in this visual gate. Staff privacy review and retention-hold management retain their current page and require a separate visual gate. The original staff regression suite is included because customer intake reuses the existing confirmation infrastructure.

## Contracts and behavior

- Existing `GET /customers/privacy-requests?limit=10&cursor=...` supplies owner-scoped cursor history. No global count, cancellation, export or destructive execution is invented.
- Existing `POST /customers/privacy-requests` accepts only kind and trimmed explanation. A non-rejected request of the same kind is returned unchanged; a different explanation does not replace the original. This is not a durable idempotency contract.
- Confirmation displays the exact kind and explanation, rechecks the current customer identity, retains CSRF, blocks duplicate clicks and validates the saved response's owner, kind and status.
- Initial unavailability, background staleness, denied reads and unconfirmed writes disable intake. Denied reads clear private history. Temporary background failures may retain clearly labeled previously loaded history.
- A non-sensitive, account-scoped session-storage marker is written before submission. Uncertain outcomes are not replayed automatically. Explicit refresh of the latest history and acknowledgement are required, including after reload; background refresh cannot satisfy that acknowledgement. Storage failure prevents an untracked submission.
- Form drafts survive refresh and pagination. Confirmed success clears the form's scoped draft. Rate limiting observes Retry-After. Required/whitespace validation focuses and identifies the invalid control.
- Approved, awaiting policy is a review decision. Its record explicitly says that information has not been deleted or anonymized. Retention-policy and execution limitations remain documented in the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md#deferred-backend-capabilities).

## Design implementation

An ink guidance column and white form share a restrained frame on desktop. The guidance keeps the review-only boundary prominent and links to the profile. History has compact full-width records, text statuses, real Lagos-time dates and a separate response inset. Narrow screens stack the composition and hide only the numbered guidance steps. Controls preserve visible borders, touch targets and focus styles; loading animation respects reduced motion.

The form and customer history are separate components. Existing MutationReview, Feedback, CursorPagination, useResource, session context and form-draft utilities are reused. Shared staff review, backend routes, migrations and contracts were not changed for this page.

## Verification ledger

- Baseline and both concepts inspected; final captures at all ten widths, six states and the native desktop viewport inspected.
- Backend privacy/owner regressions: four tests in two files passed against isolated `allied_customer_overview_test` on port 55439. This is local evidence, not deployment acceptance.
- Resource background-refresh regressions: five tests passed.
- Initial builds passed. Full frontend lint and the later scoped lint passed. The combined browser run passed 55 of 60 scenarios; the five remaining failures share two identified UI causes (transient button contrast and dialog focus restoration). Both were corrected; the final production build and all 60 browser scenarios subsequently passed.
- The first browser run was stopped after a Windows-generated test title contained a question mark instead of the expected middle dot. The assertion was corrected without altering the application's title.
- The first real helper reached intake creation, duplicate preservation and lost-response/reload recovery, then stopped on an incorrect fixture assumption that a reused Super Admin had no privacy capability. Its existing isolated grant was preserved; the helper now checks actual capability state. The corrected real browser/API/PostgreSQL run passed with Node exit 0; its evidence is recorded below.

## Real API/database evidence

The corrected helper used only the existing isolated `allied_customer_overview_test` database at port 55439, with synthetic accounts and sessions. Real browser requests were forwarded to an ephemeral application server running actual routes and Prisma. It recorded:

- Cancelled review created no request. Confirmed intake persisted the exact reason and REQUESTED status with one creation audit.
- A second request of the same kind returned the original record and preserved its explanation.
- A deliberately lost committed response for the other kind left two total records after three intentional POSTs. Reload retained the uncertainty marker; explicit history refresh and acknowledgement recovered without a fourth POST.
- Another customer's history was empty. Staff, Admin and Super Admin could not use customer routes. Reviewer access matched explicit active capability state; the reused isolated Super Admin's existing grant was preserved.
- An active retention hold blocked approval with 409. A valid review recorded its customer-visible note. A competing stale review returned 409. After documented hold release, APPROVED_PENDING_POLICY still left the user account intact and the UI explicitly reported no deletion/anonymization.
- Owned reads used private no-store caching and cursor pagination, without reviewer identity exposure. Missing CSRF returned 403; forged owner input returned 422; anonymous reads returned 401. No browser page errors occurred.

The helper closed its browser/API server and removed its synthetic sessions. No application database, real account, retention policy or destructive worker was changed. The real flow was repeated successfully on the final build. Evidence: `privacy-oct-real-accepted.log` and `privacy-oct-real.png`, outside the repository. Deployment acceptance remains separate.

## Fidelity ledger

| Point        | Concept / extracted requirement                                       | Verification and correction                                                                                     |
| ------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Composition  | Approximately 32/68 guidance/form split, open history below           | Final native-size and responsive comparison passed                                                              |
| Density      | Compact textarea, field spacing and shallow form frame                | First comparison exposed inherited textarea/field rules; scoped specificity corrected                           |
| Typography   | Actual Quicksand, readable body, compact strong headings              | Bundled Quicksand verified; shared dashboard heading scale retained (30px desktop, 24px mobile)                 |
| Palette      | Ink guidance, white form/history, cool response inset, restrained red | Final normal, loading, error, stale and uncertain surfaces match the specified palette                          |
| Mobile       | Compact guidance, stacked form/history, no horizontal overflow        | All ten final widths have no overflow; scrolled mobile history controls clear the support dock                  |
| Recovery     | Explicit review-only and uncertainty states                           | Explicit refresh/acknowledgement, reload recovery, contrast and cancel-focus checks passed                      |
| Architecture | Actual shell, valid backend copy and cursor controls                  | Generated alternate logo, optional explanation, footer and decorative pagination excluded before implementation |

## Corrections during verification

The form initially disabled the opener's fieldset as the confirmation mounted. That caused the browser to blur the opener before the shared dialog could remember it. The modal itself already makes the background inert, so the redundant proposal-only fieldset disable was removed; unavailable, uncertain and rate-limited states still disable intake. The generic background-color transition also produced a brief low-contrast enabled button. Scoped controls now switch state colors immediately while preserving border/focus feedback. Recovery warnings use the agreed red/ink palette, and the recovery panel provides refresh and history access directly.

## Final acceptance

All **60 browser scenarios passed** on the final optimized standalone build: 40 customer quality cases and 20 existing privacy regressions. These cover ten widths, accessibility at four widths, required/whitespace validation, confirmation/cancel focus, duplicate suppression, cursor traversal, stale/denied/offline/malformed states, account changes, privileged-role denial, Retry-After, storage failure, long content and short-screen dialogs. Existing staff capability, hold and review scenarios also passed without changing those workflows.

The final production build passed compilation, TypeScript, generation of 71 static pages and standalone packaging. Full frontend lint passed during implementation, and scoped lint passed again after the final focus/contrast corrections. Four backend integration tests and five resource-refresh unit tests passed. Real browser/API/PostgreSQL acceptance passed again against the final build with Node exit 0. No page exceptions were recorded in the real run or the normal ten-width captures; the normal-width browser cases also assert no console errors or warnings.

Both retained concepts and the latest screenshots were inspected using `view_image`. Playwright/Edge was used because Browser/IAB tools were unavailable. The native desktop viewport was **1435 x 1096**; responsive captures covered 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Composition, hierarchy, actual Quicksand typography, palette, control geometry, record/response anatomy, mobile adaptation and recovery states were compared. Above-fold heading/subtitle, guidance and primary-action copy match the extracted allowed copy. The implementation was faithfully verified against the design with the documented architecture/contract adaptations; no material visual mismatch remains.

Intentional adaptations: actual dashboard logo/navigation/support dock; its shared 30px desktop and 24px mobile title scale rather than the estimated 28px concept extraction; real status/date text; required explanation; valid cursor pagination; and an extra history link in recovery. The accessible textarea and actual font metrics make the page slightly taller than the generated desktop image. Full-page screenshots place fixed support controls at the capture viewport boundary; a separate scrolled 390px view verifies that the history action and pagination remain usable above the dock. State captures reset scroll after feedback navigation and finish CSS transitions to avoid capturing an intermediate animation.

Local evidence remains outside the repository under `C:/Users/PC/.codex/`: `privacy-oct-browser-accepted.log`, `privacy-oct-build-accepted.log`, `privacy-oct-lint-all.log`, `privacy-oct-lint-accepted.log`, `privacy-oct-backend.log`, `privacy-oct-unit.log`, `privacy-oct-real-accepted.log`, `privacy-oct-captures-settled.log`, `privacy-oct-states-settled.log` and `privacy-oct-native-settled.log`. Screenshot helpers and synthetic fixtures are separate from application data. The preview remains on port 3001 with no task-specific storage configuration.

## Files in this page gate

- [Customer page component](../../app/components/customer-privacy.tsx), [request form](../../app/components/privacy-request-form.tsx), [route](../../app/dashboard/privacy/page.tsx) and [scoped styles](../../app/dashboard/privacy/privacy.css).
- [Browser fixtures](../../tests/fixtures/customer-privacy.ts) and [quality scenarios](../../tests/e2e/customer-privacy-quality.spec.ts). The existing [privacy suite](../../tests/e2e/privacy.spec.ts) ran without modification.
- This report, [retained concepts/specification](customer-privacy-oct-concepts/README.md), [page register](README.md), [expanded brief](expanded-brief.md) and [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).

No backend source, schema, migration or shared dashboard-shell change was required. Concurrent reservation, storage and refund work was preserved and is outside this route's acceptance claim. Review-only privacy behavior remains intentional: actual deletion/anonymization still depends on approved retention policy and a separately implemented execution workflow. Deployed integrations and remaining page gates remain open.

Next: customer notifications `/dashboard/notifications`. The whole-application goal remains active.
