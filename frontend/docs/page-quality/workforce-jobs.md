# Managed workforce jobs queue — milestone 104

Status: locally accepted on 19 October 2026. Route `/admin/workforce/jobs`. The full application goal remains active.

## Outcome and scope

The queue replaces sparse cards with an accessible, compact job table and labeled mobile rows. It shows work-order/service identity, vehicle and registration, precise Lagos schedule and separate work-order/booking states. Missing vehicles and work orders have explicit labels. Server-side search covers permitted work-order numbers, services and vehicles; the work-status selector includes all seven states and Not created. Applied filters, next/previous/first paging, reload and browser Back persist through the URL. The existing detail's Back to jobs link preserves that query; its visual redesign remains a separate milestone.

Current own-access validation hides jobs on scope mismatch, revoked/expired access, failed refresh or malformed projections. The queue sends no business mutations and introduces no new role or permission. See the [backend contract and data-preservation evidence](../../../backend/docs/workforce-jobs-workspace.md).

## Design and native evidence

Four native baselines at 430, 768, 1280 and 1440px preceded runtime changes. Fresh desktop/mobile concepts and the [pre-implementation specification](workforce-jobs-oct-concepts/spec.md) cover the entire header, filters, results and paging. An initial generated desktop eyebrow and purple state were corrected in Image Gen before implementation. The accepted images are stored in the project; generated source originals remain outside it.

Browser plugin not available; local production Next.js at `http://localhost:3070` was checked with sequential Playwright/Edge. The final comparison uses the local concepts and native screenshots at the same four widths, plus mobile row/paging regions.

| Comparison            | Result and intentional adaptation                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy             | Overview / Workshop jobs, compact heading/subtitle, refresh/timestamp, filter region, Jobs panel and footer preserve the concepts.                                                      |
| Desktop layout        | One horizontal filter bar and one table with aligned job, vehicle, schedule, status and named open-link columns. No KPI cards, exports, bulk edits or repeated oversized cards.         |
| Typography            | Actual Quicksand; 28px desktop/24px mobile title. Native review prompted 14px table text, 13px supporting text and explicit ink link underlines.                                        |
| Palette               | Existing ink shell, cool canvas and white bordered regions. Red Apply filters/focus; restrained neutral/warm/green/red semantic states with readable text labels.                       |
| Real information      | Actual rows, full Lagos dates and separate booking/work state. The concept's illustrative row count is not treated as a grand total; all 25 returned rows render.                       |
| Responsive behavior   | Filters stack below 1100px, table becomes labeled rows below 1000px, and heading/refresh stack below 760px. Existing logo/navigation/account controls replace generated approximations. |
| Pagination and touch  | Named 44px controls replace the mobile concept's icon-only pagination. A bounded cursor trail supports previous navigation; direct cursor links retain First page.                      |
| State and interaction | Draft input persists through background refresh. Invalid URLs offer reset without fetching; failures hide old rows; no matches and no permitted jobs have distinct explanations.        |

## Verification

- 26 new queue browser cases pass: seven responsive/accessibility widths; all three technical templates; search/combined filters, every work status, clearing an unsent draft, missing optional data, empty/no-match states; paging/reload/previous/first/browser Back/detail return; initial loading and denied access; foreground/background failure and retry; retained drafts; malformed URLs/data; foreign branch/mismatched access; revocation and automatic expiry; long labels at 320px.
- Nine existing regressions pass: Operations home, technical job update, permission loading/revocation, mobile technician navigation, notifications/review at 430 and 1440px, overview at 430 and 1440px, and overview expiry.
- Seven unit cases pass for query validation/normalization, cursor trail behavior, required identity/scope and safe record/pagination projections. Eight new-page Axe states have passing evidence: seven widths plus denied access.
- Six API/database scenarios pass: assigned 25+3 paging, lead visibility, complete scoped search including literal wildcards, combined/all status filters, authorization/validation denials and unchanged bookings contract. Twenty successful reads produced twenty READ audits.
- Connected production Edge → Express → PostgreSQL verifies 28 technician records and 29 lead records with foreign/other-assignee exclusions, paging/reload/Back/detail-return, literal search, combined filtering, empty/reset/refresh, and a revoked technician denied before any jobs request. Sixteen successful queue/detail reads produced sixteen READ audits; no business mutation was sent. Original hashes across 18 domain tables stayed unchanged and all temporary sessions were removed.
- Frontend/backend type checks, focused lint/format, generated API types/inventory, OpenAPI validation and route coverage pass (313 paths, 367 operations). The first production build and standalone preparation passed. The final CSS build log ends with standalone preparation complete; its original session handle had expired at continuation, so terminal artifacts, successful standalone startup and matching sources were inspected instead of restarting the build.
- Final CSS confirmation passes eight focused browser cases: seven responsive/Axe widths and long labels at 320px. These repeat existing cases and are not added to the 26 distinct scenarios above. Nine runtime/generated-contract source hashes match the production snapshot. Final native captures at 430, 768, 1280 and 1440px, plus mobile row/pagination regions, were inspected against both local concepts: no horizontal overflow, captured console/page errors, framework overlay, clipped controls or unreadable labels. The screenshot helper initially ran from a directory without `tsx`; rerunning from the backend's existing loader completed without dependency changes.

Initial baseline fixture metadata was corrected before captures. API setup first encountered the 40-character work-order-number limit and then required timestamps for work-order states. Both fixture errors were corrected after inspecting constraints; already-created parents/two jobs were verified and reused. No migration or constraint was weakened and no completed fixture write was blindly replayed. Original hashes/session cleanup passed after each attempt. The backend report explains the initial fixture counter reporting correction. These are resumed test-setup runs, not an uninterrupted first-pass claim.

## Data safety and artifacts

Actual target verified before test writes: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment. Runtime verified non-elevated, without database/table ownership or TRUNCATE. Retained synthetic additions: two services, one customer vehicle and 30 bookings/29 work orders. Financial tables were empty; populated financial preservation was not newly tested.

External evidence under `C:/Users/PC/.codex/`: `workforce-jobs-baseline-*`, `workforce-jobs-final-*`, `workforce-jobs-e2e-results`, `workforce-jobs-regression-results`, `workforce-jobs-final-responsive-results`, `workforce-jobs-source-hashes.json`, `workforce-jobs-api-tests.log`, `workforce-jobs-api-evidence.json`, retained fixture JSON, both setup-failure logs/evidence, `workforce-jobs-real.json` and connected screenshots. Initial evidence is retained for traceability.

No shared/application database write, grant change, schema migration, reset, backup/restore rehearsal, provider activation, push or deployment occurred. Prior 60-migration replay/db-check evidence is reused for this schema-free change. Release the compatible backend first and verify the target environment separately.

## Remaining application work

This page's local gate is complete. Next is the workforce job detail, followed individually by other operational queues/details. Owner decision checklist consolidation, application-wide role regression and deployed acceptance remain open. Local Edge evidence does not establish physical-device, Safari or Firefox acceptance.
