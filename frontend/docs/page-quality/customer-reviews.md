# Customer reviews - expanded page gate

Route: `/dashboard/reviews`.

Status: locally accepted on 12 October 2026, the forty-fourth expanded frontend milestone. No whole-application or deployed acceptance is implied.

## Audit and design

The previous page used a full-width vertical form above a separated history section. At desktop widths the history started below the first viewport; mobile fields and section gaps consumed unnecessary space. Moderation status ran into dates, and list failures could leave old rows visible without a clear stale-state boundary. Unknown POST outcomes were held only in component state and did not survive reload.

Four baselines at 390, 768, 1280 and 1440 were inspected before edits. Fresh complete [desktop and mobile/state concepts](customer-reviews-oct-concepts/README.md) preceded production code. The extracted specification records corrections for generated branding, unsupported counts/actions, colors and the actual review contract.

The new page uses an aligned desktop form/history layout, a compact type/rating pair, an ink history heading, ruled review rows and a deliberate stacked mobile layout. Star graphics include a numeric accessible label. Full comments, Lagos dates, actual moderation notes and moderation times remain readable. The form explains that approved reviews become public and retains the existing confirmation dialog. Customer-only component state is keyed by the signed-in user. Public and staff review cards are unchanged.

## Contract and recovery

Existing customer GET/POST `/customers/support/reviews` routes remain authoritative. BUSINESS reviews need a customer account; PRODUCT, SERVICE, ORDER and VEHICLE_TRANSACTION require matching owned completed sources. The transaction-source unique constraints and moderation rules remain intact. No backend endpoint or migration was added for this page.

- Initial, manual-refresh and background-refresh failures block writes. Foreground errors hide obsolete rows; background errors preserve rows with an explicit stale warning. Failed later pages still permit Previous navigation.
- Completed-source loading, failure and background staleness disable submission. A fresh selected-source read happens before sending. Preflight failure does not imply a submission was sent.
- Every confirmed submission checks the current customer session and identity. CSRF and response parsing remain in place; contradictory responses are unconfirmed outcomes.
- `aat:review-write:v1:<userId>` stores only `pending` in session storage before POST. Unknown outcomes survive reload. A successful explicit history refresh and acknowledgement are required before composing again; no automatic POST replay occurs. A failed manual refresh cannot be acknowledged merely because a later background read succeeds. Missing first-page history is not proof of failure.
- Known rejections clear the marker; Retry-After pauses the form. Storage-write failure prevents POST, and marker-removal failure keeps the recovery lock.
- Draft identity is account-scoped. Review type and completed source participate in the existing draft restoration; confirmed success clears the draft. Restored content still goes through current eligibility checks.

The [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md#customer-reviews---source-audited-contract-follow-ups) records optional durable review replay and authoritative review-source availability. Completed collections may include previously reviewed sources; the UI does not claim they are guaranteed eligible. The backend still makes the final decision.

## Verification evidence

All logs and screenshots listed here are local artifacts under `C:/Users/PC/.codex/`.

| Check                             | Evidence and result                                                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial production build          | `customer-reviews-oct-build.log`: passed compilation, TypeScript, 71 pages and standalone preparation.                                                                                                                                                                                                          |
| Initial browser regression        | `customer-reviews-oct-browser.log`: all 52 scenarios passed, including 33 new customer-quality cases and 19 existing customer/public/admin review regressions.                                                                                                                                                  |
| Responsive first pass             | `customer-reviews-oct-after-{width}.png`: no horizontal overflow at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536. All ten final captures were inspected; native and state checks are recorded below.                                                                                                 |
| Database preparation              | `customer-reviews-oct-migrations.log`: all 55 current migrations applied successfully to fresh isolated `allied_customer_reviews_test` on local port 55439. No application database was migrated.                                                                                                               |
| Focused backend integration       | `customer-reviews-oct-backend.log`: review eligibility/moderation/ownership/publication case passed; seven other cases were not selected.                                                                                                                                                                       |
| Real browser/API/PostgreSQL       | `customer-reviews-oct-real.log`: corrected complete helper run passed, with no page errors. Details below.                                                                                                                                                                                                      |
| Full frontend lint                | `customer-reviews-oct-lint-all.log`: passed. Final changed-file lint is recorded separately.                                                                                                                                                                                                                    |
| Expanded browser regression       | `customer-reviews-oct-browser-final.log`: all 57 cases passed, adding transaction-draft restoration/cleanup and four state accessibility checks.                                                                                                                                                                |
| Resource refresh unit regression  | `customer-reviews-oct-resource.log`: five cases passed.                                                                                                                                                                                                                                                         |
| Final CSS build and visual repeat | `customer-reviews-oct-build-accepted.log` passed. The final 20-case selection recorded 18 passes and two timeouts with anomalous 3.0/3.5-hour elapsed durations; both failed cases passed unchanged in `customer-reviews-oct-browser-recheck.log` (10.5 seconds total). No assertions or timeouts were relaxed. |

Real acceptance uses the production preview, actual Express routes, Prisma and a fresh disposable database. It verifies 20+1 owned history paging, cancellation with no creation, browser submissions for all five target types, stored rating/status, exactly one review and one creation audit for the dropped-response operation, reload/manual recovery without replay, source uniqueness 409, incomplete and foreign sources 409, forged owner 422, missing CSRF 403, private no-store projections, moderation and approved-only public visibility, exclusion of private fields from public reads, stale moderation 409, role denial and anonymous 401. Synthetic test reservation terms exist only in this isolated database; no business agreement was approved or published in an application environment. Notification providers are disabled; no external messages are sent. Sessions and temporary API/browser processes are cleaned up by the helper.

## Fidelity ledger

| Finding                                          | Evidence                                                                             | Correction / boundary                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Excess margin below main heading                 | First desktop and mobile screenshots showed a large gap before the subtitle.         | Scoped heading margin reduced; native 1505x1045 comparison confirms the tighter hierarchy.                                     |
| Generated shell branding and extra footer        | Desktop/mobile concepts invent wordmark details, slogans and footer content.         | Existing approved logo, navigation and support dock retained, as specified before implementation.                              |
| Narrow mobile refresh button                     | First 360-430px captures wrapped the refresh label onto two lines beside the select. | Stack mobile history controls; retain full labels and touch targets.                                                           |
| Shared warning treatment                         | Recovery inherited an amber shared warning surface.                                  | Scope recovery and success feedback to the specified cool-neutral palette; preserve semantic status/alert behavior.            |
| Generated status colors and field limit          | Artwork shows orange/green status variants and a 500-character counter.              | Neutral pending/approved, red rejected; actual 2,000-character limit.                                                          |
| History differs in height                        | Real moderation time adds an update block absent from the desktop sample.            | Preserve backend-provided history rather than omit information for equal panel height.                                         |
| Full-page screenshots show fixed dock mid-canvas | Mobile page is taller than viewport.                                                 | Actual scrolled-bottom and confirmation captures verify viewport clearance; full-page position alone is not an overlap defect. |

## Corrections and limits

The first build attempt could not remove the running standalone directory on Windows. The exact owned preview process was verified and stopped, then the build succeeded. No unrelated server or build lock was removed.

Initial real-test fixture attempts used an invalid booking status and omitted the newer reservation-acceptance fields. The helper was corrected to REQUESTED and the existing synthetic acceptance helper, with explicit disposable-database testing enabled. Its safety guard initially rejected the run until RUN_DATABASE_TESTS was explicitly enabled for the already verified test database. These were fixture errors; database constraints were preserved. The subsequent full helper passed. The prior notification gate's old-database review failure is not retrospectively reported as a pass; this gate uses a new compatible database and its own result.

Browser plugin not available; repository Playwright with Edge is used. Browser artifact directories are unique to this gate. No deployment, live provider verification or full backend suite result is claimed.

## Changed page files

- `app/dashboard/reviews/page.tsx`, `reviews.css`
- `app/components/reviews-panel.tsx`, `review-create-form.tsx`, `review-source-picker.tsx`
- `lib/reviews/use-review-write.ts`
- `tests/fixtures/customer-reviews.ts`, `tests/e2e/customer-reviews-quality.spec.ts`
- This report and retained concept/specification artifacts.

## Acceptance

Accepted locally after the final production build, 57-case browser regression and all 20 targeted final checks having passing evidence. The two final-repeat timeouts are preserved in the log; their multi-hour elapsed values suggest a host suspend or timing interruption, but that cause is not proven. Both passed unchanged on immediate recheck. Five resource-refresh unit cases, the focused backend review integration, real browser/API/database acceptance, full frontend lint and final changed-file lint passed. Scoped formatting, local documentation links and diff whitespace checks passed.

All ten final responsive images, the native 1505x1045 desktop capture, 390x844 confirmation and scrolled-bottom capture, and empty/error/loading/rejected/source/uncertain states were inspected against the retained concepts. The corrected mobile filter controls remain readable on one line; recovery uses the approved neutral treatment; real moderation details remain visible. No unresolved visual blocker was found within this page's scope. Final screenshot logs record no page errors or horizontal overflow. Generated artwork corrections are intentional and specified before implementation.

Next: customer care `/dashboard/support`, then its individual detail routes. Other customer/staff/admin/Super Admin routes and deployment gates remain open.

## Subsequent source contract improvement (13 October)

The source-discovery limitation recorded in the original gate is now addressed by the private `/customers/support/review-sources` endpoint. Selection and confirmation use authoritative owned eligibility, including the existing one-review-per-customer/product rule. The picker resolves saved source IDs independently of pagination context on reload. The new endpoint, generated types, boundary tests and subsequent browser evidence are documented in [review source discovery](../../../backend/docs/review-source-discovery.md). Original page-gate counts above remain historical. Durable review submission replay has since been implemented as documented below; deployed acceptance remains open.

## Subsequent original-request recovery

The required request-key contract and account-scoped original body now permit explicit recovery after a lost response and reload. The recovery dialog shows the original content; confirmation sends the same body and key. Successful replay returns the original identity with current moderation and clears the submitted draft. Legacy or expired markers retain explicit history reconciliation. Session invalidation redacts retained contents, and no automatic replay occurs. The earlier marker-only behavior above is historical. See [backend contract, verification and coordinated release](../../../backend/docs/review-submission-replay.md).
