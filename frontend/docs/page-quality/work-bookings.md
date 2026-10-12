# Workshop bookings

Date: 12 October 2026. Route: `/admin/bookings`. Roles: STAFF, ADMIN, SUPER_ADMIN. Status: implementation complete; final visual/state and staff-filter checks pending. This does not close the application-wide goal.

## Audit and design

The previous list had one full-width status control, no appointment or assignment filters, unmarked background failures, and a horizontally scrolling mobile table. Its shell breadcrumb used a plain slash and lacked an ordered list/current-page marker. Manual read failure could leave prior records visible. The existing detail route already owns reviewed assignment, status, quotation and work-order actions.

Two fresh [desktop and mobile/state concepts](work-bookings-oct-concepts/README.md) preceded production changes. The result uses a compact date/status toolbar, expandable scope filters, an ink results strip, a ruled desktop table and labelled mobile records. The service name, appointment, reference, branch, status, assigned staff, vehicle and registration stay readable. Real records and safe errors replace all generated samples.

## Behavior and contract

- Existing `GET /staff/bookings`: 25 records per page, all eight statuses, branch/assignment filters, inclusive Lagos input dates converted to inclusive UTC start and exclusive UTC end. Paired dates cover at most 366 days; invalid dates, duplicate query filters and malformed IDs fail closed. A single open date bound is supported by the server.
- Applied filters and UUID cursors persist in the URL, including reload and Back/Forward. Changing filters returns to the first page. A bounded client navigation trail never reaches the API. Page counts describe only the returned page; no total, calendar order or unsupported search is invented.
- ADMIN/SUPER_ADMIN use paginated `/admin/branches` and `/admin/staff` choices, including inactive historic records. STAFF sees only its own-assignment control via `/staff/profile`, while the server enforces the active assigned branch. A different staff assignment from a shared URL is not labelled as the viewer's own. Directory paging does not apply booking filters.
- The dedicated list parser keeps display fields and rejects malformed status/date/cursor, duplicate records and more than 25 rows. Returned filter mismatches fail closed. Internal notes, customer identifiers, quotation lines and other detail-only fields are not retained by the list projection.
- Background failures retain records with a stale notice. Manual failures hide old records. Failed authorization and session invalidation clear private content. Loading a new filter never displays rows from the prior scope. Directory failures have their own retry path.
- Existing booking detail links remain the action path. The list sends no mutations and introduces no deposit requirement, bulk transition, assignment write or financial action. Legacy missing branch/staff/vehicle/appointment values have explicit labels.

Sources: [request validation](../../../backend/src/modules/service-operations/service-operations.schemas.ts), [repository filtering](../../../backend/src/modules/service-operations/service-operations.repository.ts), [role scoping](../../../backend/src/modules/service-operations/service-operations.service.ts), [directory contract](../../../backend/src/modules/organization/organization.schemas.ts), [list component](../../app/components/staff-bookings.tsx), [query mapping](../../lib/work-booking-query.ts), [list parser](../../lib/api/work-booking-list-schema.ts) and [stylesheet](../../app/admin/bookings/bookings.css).

## Verification

Browser plugin unavailable; Playwright with Edge was used. Preview: `http://localhost:3005`. Helpers, logs and captures use prefix `C:/Users/PC/.codex/work-bookings-oct-`, outside the repository.

| Check | Evidence |
| --- | --- |
| Browser regression | All 68 initial production cases passed: 36 new list cases, 23 shared navigation and nine existing staff-booking/detail cases. Covers dates, all statuses, roles, URL history, pagination, invalid input, scope mismatch, slow/failed/stale reads, session loss, directory recovery and paging. Final two staff-filter additions and final-build repeats pending. |
| Unit | Six query/parser cases passed: timezone/year boundary, leap dates, inclusive 366-day cap, open bounds, malformed/duplicate filters, role-restricted branch queries, navigation trail separation and safe display projection. |
| Backend | Five existing service-operation boundary/security cases passed. These do not by themselves certify database filtering. |
| Real browser/API/database | Passed STAFF, ADMIN and SUPER_ADMIN on isolated PostgreSQL database `allied_customer_aftercare_test`, port 55439. Exact 25+1 date-filtered paging, reload/back, status filtering, branch isolation, STAFF override containment/foreign detail denial, customer 403, anonymous 401, malformed-range 422, no-store responses, no browser writes and unchanged booking counts verified. Synthetic sessions deleted in finally. |
| Build/static | Initial production build, TypeScript and scoped lint passed. Full frontend lint passed; the final keyboard-focus correction is being rebuilt. |
| Responsive and states | Twelve widths passed browser layout checks: 320, 360, 375, 390, 430, 768, 844, 1024, 1280, 1440, 1505 and 1920; 844 uses a short landscape viewport. Three widths passed Axe with expanded filters. Final screenshots/state scans and concept comparison pending. |

The first development run passed 29/30 cases; STAFF timed out while loading and passed in production. Its fixture was subsequently corrected to include the required profile capabilities array. A command launched from the repository root selected an external Playwright runner and failed before testing; subsequent commands explicitly use the installed frontend runner. The initial real-data helper omitted the required confirmation timestamp and was rejected by the existing database constraint; the synthetic fixture was corrected and the complete real run passed. A keyboard check also found that clearing filters focused a control just before its form remounted; focus now moves to the replacement status control on the next animation frame. No application validation or database constraint was relaxed.

## Fidelity ledger

| Point | Concept / rendered evidence / correction |
| --- | --- |
| Copy and hierarchy | Preserve the original permitted-branches description, exact filter labels and read-only record purpose. Use actual account/brand labels; no generated aggregate counts or fictional navigation. Final native comparison pending. |
| Form density | Initial render inherited 20px field margins and 16px controls. Scoped overrides restore aligned 44px controls, 13px text and compact spacing. Separate disclosure from the generated desktop design is consolidated into the same filter surface to preserve a single form. |
| Table and actions | Initial caption was visible because an unsupported utility class was used; corrected to the existing sr-only utility. Service/title/date/ref now share a compact linked cell, with a separate 44px detail target. |
| Typography and palette | Quicksand, 28/24px title, 18px section title, 13px body, 12px metadata, ink strip and neutral status labels. Generated oversized title and substitute branding are intentionally excluded. |
| Mobile and keyboard | Every field and detail action remains visible in labelled ruled rows. The ink strip continues on mobile; empty/error/retry and date errors are associated and keyboard reachable. |
| Scope and state | Real role-specific scope choices, independent directory pagination, explicit missing/stale profile handling and truthful unavailable/stale record states. No generated claim of multiple staff branches or live availability. |

## Changed files and boundaries

Production: `app/admin/bookings/page.tsx`, new `app/admin/bookings/bookings.css`, `app/components/staff-bookings.tsx`, one breadcrumb-exclusion line in `app/components/dashboard-shell.tsx`, new `lib/work-booking-query.ts`, new `lib/api/work-booking-list-schema.ts`. QA: `tests/fixtures/work-bookings.ts`, `tests/e2e/work-bookings-quality.spec.ts`, `tests/unit/work-booking-query.test.ts`. Existing directory components and resource lifecycle are reused.

No backend endpoint, schema or migration is required. Other concurrent support/aftercare changes are outside this gate. Edge coverage does not certify other browser engines; local persistence/read checks do not prove deployed provider behavior. The remaining application goal stays active. Do not advance to the next route until final acceptance is recorded here.
