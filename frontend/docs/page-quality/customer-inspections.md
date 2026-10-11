# Customer inspections

Status: locally accepted, 9 October 2026. `/dashboard/inspections` is expanded milestone 38. This acceptance covers inspection history and inline details; remaining routes and deployed integration checks retain separate gates.

## Baseline and contract

The existing page supports customer-only history, six server-side status filters, cursor pagination, preferred/scheduled times, notes, cancellation reasons and an inline condition-report disclosure. Baselines at 390, 768, 1280 and 1440px were captured and visually inspected before production changes. Oversized stacked cards and a stretched status selector slow scanning; requested and confirmed dates lack hierarchy. Filters/pagination are local state and disappear on reload; the generic breadcrumb lacks ordered-list/current-page semantics. Background refresh failures are not exposed.

`GET /customers/vehicle-inspections` requires an authenticated customer and returns only that customer's records. Query: optional UUID cursor, limit 1–50 (default 20), and REQUESTED / CONFIRMED / COMPLETED / RESCHEDULED / CANCELLED / NO_SHOW. Ordering is createdAt descending then ID descending; the API returns items and optional nextCursor, without global totals. Projection includes preferred and scheduled windows, notes/reason, listing identity and condition-report summary, inspectedAt, odometerKm, conditionScore and primitive-valued findings. The backend is authoritative for status; a report or date must not imply completion.

Customers cannot change status, reschedule or cancel through this route. Existing customer-care navigation remains the supported contact path. Inspection creation is already covered by a separate gate and starts from an available public listing. No inspection detail route or customer report-download endpoint exists; use inline details rather than inventing either. No image URL is projected for this list, so do not insert decorative stock vehicles into records.

Sources: [routes](../../../backend/src/modules/vehicle-sales/vehicle-sales.routes.ts), [query schemas](../../../backend/src/modules/vehicle-sales/vehicle-sales.schemas.ts), [repository projection](../../../backend/src/modules/vehicle-sales/vehicle-sales.repository.ts), [service](../../../backend/src/modules/vehicle-sales/vehicle-sales.service.ts), [condition-report validation](../../../backend/src/modules/vehicles/vehicles.schemas.ts).

## Flow and verification scope

Flow: customer history → server status filter / cursor page → retained state after reload → expand appointment and report → customer-care link. Verified empty, filtered empty, missing cursor, malformed data, loading, temporary failure, rate limit, denied access, background staleness and session changes. Coverage includes all ten widths from 320 through 1536px, keyboard and automated accessibility checks. Actual API/database evidence verifies ownership, paging, status filters and condition-report projection. No backend gap has been established by this audit.

Browser plugin not available; installed Microsoft Edge via repository Playwright is the fallback. Baseline evidence is outside the repository under `C:/Users/PC/.codex/inspections-oct-before-*`. The retained concepts/specification preceded production implementation; final visual evidence is recorded below.

## Implemented experience

Two accepted [ImageGen concepts and the extracted specification](customer-inspections-oct-concepts/README.md) preceded production implementation. A separate initial mobile proposal was rejected and corrected before coding. The desktop table becomes compact stacked rows below 1100px. Each request exposes appointment notes and the complete supported report through an accessible disclosure. Semantic breadcrumbs, URL filters/history, strictly validated response records, page counts, loading/empty/error states and background-staleness warnings replace the original local-state cards. No backend code or contract changed for this page.

Status and page size survive reload and browser history navigation. Cursor history is bounded to 50 entries and never sent to the API. Direct cursors without history show Later page and offer First page. Invalid filters are handled explicitly. Preferred and scheduled appointments remain distinct; terminal records use Last scheduled. Date windows use Lagos calendar days, showing the end date only when it differs from the start date. Report zero values, false findings and missing values remain distinguishable. Private report storage keys are not exposed or turned into download links.

Manual load failures hide old records; background failures retain records with a visible stale warning and disable pagination until recovery. Account changes cancel obsolete requests and remove private content. Customer actions remain read-only here. Browse vehicles and Contact customer care use existing supported routes.

## Final acceptance evidence

| Check                     | Result and scope                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser scenarios         | 60 distinct scenarios have passing evidence: 32 inspection-history cases, five existing customer/staff inspection regressions and 23 shared navigation cases. The final combined run passed 59 and timed out on the shared 901px navigation case during a prolonged execution gap. That case then passed independently. This is not a claim that one uninterrupted 60-case run passed.               |
| Responsive and visual     | Captured and inspected 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px; native 1536x1024 desktop comparison; loading, empty, filtered-empty, error, stale, expanded-report and short-screen states. Final capture pass reports no horizontal overflow, console messages or page errors at all ten widths.                                                                                  |
| Accessibility             | Four automated Axe scenarios, semantic breadcrumb/table header associations, keyboard disclosure and filter controls, role redirects, reduced-motion behavior and short-screen keyboard checks passed within the browser suite. Computed controls are at least 44px, selects 48px high with 16px text.                                                                                               |
| Frontend unit checks      | 14 tests passed across customer inspection query/response/time validation and shared resource background-refresh lifecycle. Includes Lagos midnight boundaries, invalid/duplicate/oversized records, zero/false/null report values and cursor bounds.                                                                                                                                                |
| Backend checks            | 21 existing vehicle workflow, API boundary and security tests passed with database tests enabled; no skipped integration acceptance.                                                                                                                                                                                                                                                                 |
| Real API/browser/database | Passed against isolated PostgreSQL and actual Express/Prisma responses through the browser proxy: 12 owned records over 10+2 pages, reload, all six filters, report summary/score/odometer/findings, private storage-key exclusion, archived-listing history, owner/foreign-cursor isolation, three privileged-role denials, anonymous 401 and invalid-query 422. No UI mutations or browser errors. |
| Static and build          | Full frontend lint, final focused lint, final explicit TypeScript check and final production/standalone build passed. Scoped formatting, local documentation links and diff checks passed for the closing handoff.                                                                                                                                                                                   |

The initial browser role assertions targeted an absent link despite correct redirects; corrected assertions verify `/admin`. Initial real-API fixture setup omitted required timestamps and a paired report checksum; the database rejected it. After fixture correction and scoping a findings assertion to the visible report, the complete real acceptance helper passed. These earlier partial runs are not counted as acceptance.

### Reproduction and retained evidence

From `frontend/`, with the built preview running and `PLAYWRIGHT_BASE_URL=http://localhost:3001`:

```powershell
npx playwright test tests/e2e/customer-inspections-quality.spec.ts tests/e2e/inspections.spec.ts tests/e2e/dashboard-navigation.spec.ts
npx playwright test tests/e2e/dashboard-navigation.spec.ts --grep 'shared navigation is accessible at 901px'
npx vitest run tests/unit/customer-inspection-query.test.ts tests/unit/resource-background-refresh.test.tsx
npm run lint
npm run typecheck
npm run build
```

From `backend/`, against the isolated test database with `RUN_DATABASE_TESTS=true` and `TEST_DB_NAME=allied_customer_overview_test`:

```powershell
npx vitest run tests/integration/phase7-vehicle-sales-flow.test.ts tests/api/phase7-vehicle-boundaries.test.ts tests/unit/phase7-vehicle-security.test.ts
```

Local artifacts remain outside the repository under `C:/Users/PC/.codex/inspections-oct-*`: `browser-final.log`, `browser-recovery.log`, `backend.log`, `unit-final.log`, `lint.log`, `focused-lint-final.log`, `types-final.log`, `build-final.log`, `captures-recovery.log`, `states-final.log` and `real.log`. The real acceptance helper is `inspections-oct-real.cjs`; capture helpers are `inspections-oct-after.cjs`, `inspections-oct-states.cjs` and `inspections-oct-scrollcheck.cjs`. These are local evidence, not portable repository test fixtures. Repository browser and unit tests are listed below.

## Visual fidelity ledger

| Item                                 | Concept / baseline evidence                                                                                   | Final browser evidence and decision                                                                                                                                                                                                                                                         | Remaining blocker                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| History density                      | Desktop concept uses four compact columns instead of baseline stacked cards.                                  | Four-column table on wide screens; semantic stacked rows below 1100px. Removed inherited header shading from row titles.                                                                                                                                                                    | None locally.                     |
| Brand and controls                   | Neutral statuses, red primary action, Quicksand and visibly bordered filters.                                 | Native desktop/mobile reviews and computed styles confirm 30px/27px headings, 16px selects, 48px fields and 44px actions. Rejected rainbow concept is not used.                                                                                                                             | None locally.                     |
| Appointment hierarchy                | Concepts separate requested preferences from confirmed schedules.                                             | Explicit Requested/Scheduled/Last scheduled labels; compact Lagos ranges avoid repeated dates on narrow screens. Midnight behavior has unit coverage.                                                                                                                                       | None locally.                     |
| Report reading order                 | Desktop artwork spreads report, findings and appointment across three groups; mobile starts with appointment. | Intentional two-column desktop grouping places appointment first and report/findings second, preserving the same reading order on mobile. Below 640px this becomes one column.                                                                                                              | Intentional documented deviation. |
| Mobile disclosure                    | Concept calls for compact ink detail actions.                                                                 | Corrected stacked-row action alignment; readable findings and notes without truncation at 320px through tablet widths.                                                                                                                                                                      | None locally.                     |
| Recovery states                      | State concept includes empty, expanded, stale and unavailable views.                                          | Distinct loading/empty/error states; stale data is labelled and cannot paginate. Full-page screenshots place fixed support controls at the original viewport boundary; controls remain reachable through normal scrolling.                                                                  | None in tested flows.             |
| Actual shell and screenshot behavior | Generated shell is illustrative.                                                                              | Retained actual logo/search/navigation/support controls. A 1024px full-page capture shifted the sticky sidebar; a viewport capture and computed bounds verify scroll position 0 and sidebar top 0. Use `inspections-oct-1024-viewport.png` for shell fidelity, not that full-page artifact. | Capture limitation only.          |
| Honest data and copy                 | Artwork dates/status labels are illustrative and no global totals exist.                                      | Actual API fields, page-only counts, exact six statuses, zero/missing values and supported links replace generated sample assumptions. No images or download/mutation buttons are invented.                                                                                                 | None for the existing contract.   |

The desktop and mobile concept WebPs were compared with the final screenshots. All seven state captures were inspected. Content beyond the native desktop viewport remains scrollable; acceptance does not require every expanded record to fit above the fold.

## Files changed for this gate

- [History component](../../app/components/inspection-history.tsx), [route](../../app/dashboard/inspections/page.tsx) and [scoped styles](../../app/dashboard/inspections/inspections.css).
- [Dashboard shell](../../app/components/dashboard-shell.tsx): only the inspection-route generic breadcrumb exclusion belongs to this gate.
- [URL query validation](../../lib/customer-inspection-query.ts), [response validation](../../lib/api/customer-inspections-schema.ts) and [Lagos time formatter](../../lib/customer-inspection-time.ts).
- [Browser scenarios](../../tests/e2e/customer-inspections-quality.spec.ts), [fixtures](../../tests/fixtures/customer-inspections.ts), [unit tests](../../tests/unit/customer-inspection-query.test.ts) and [existing inspection regressions](../../tests/e2e/inspections.spec.ts): customer disclosure assertions updated to the new labels/structure.
- This report, retained concept WebPs/specification, [page register](README.md), [expanded brief](expanded-brief.md) and [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).

## Boundaries and next gate

No new required backend gap was found. Customer cancellation/rescheduling, dedicated inspection detail routes and report-file downloads are not part of the current customer API; the interface offers the supported customer-care path. Adding those capabilities would require a separate product/API decision. Deployed session integration remains under REL-03. Automated Edge checks do not establish manual screen-reader, other-browser or physical mobile-keyboard acceptance.

The next individual gate is customer vehicle purchases `/dashboard/vehicle-transactions`. The whole-application goal remains active; this report does not certify remaining dashboard routes or deployment readiness.
