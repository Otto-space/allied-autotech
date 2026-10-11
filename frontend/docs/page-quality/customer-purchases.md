# Customer vehicle purchases list

Status: locally accepted, 9 October 2026. Route `/dashboard/vehicle-transactions`; expanded milestone 39. Detail route and deployed integrations retain separate gates.

## Audit and contract

Baseline 390/768/1280/1440px screenshots were captured and visually inspected before production changes. The old list has tall cards, stretched filters, repeated red statuses, no images despite an image projection, local-only query state and no background-staleness warning. The generic breadcrumb lacks ordered-list/current-page semantics.

GET `/customers/vehicle-transactions` uses authenticate and requireCustomer. Service resolves the actor's customer and repository filters customerId; status is one of 12 values, limit 1-50 default 20, cursor UUID. Results ordered createdAt/id descending with items/nextCursor and no global totals. Projection includes transactionNumber, status, exact string kobo amounts, createdAt, listing title and vehicle images, plus history/handover used by the detail workflow. No unsupported search/sort is added. List needs no mutation. Existing reserve and payment flows remain in the separately gated detail route.

Sources: [routes](../../../backend/src/modules/vehicle-sales/vehicle-sales.routes.ts), [schemas](../../../backend/src/modules/vehicle-sales/vehicle-sales.schemas.ts), [repository](../../../backend/src/modules/vehicle-sales/vehicle-sales.repository.ts), [service](../../../backend/src/modules/vehicle-sales/vehicle-sales.service.ts). No new backend gap established.

Two [concepts and specification](customer-purchases-oct-concepts/README.md) preceded implementation. Browser plugin not available; installed Edge via repository Playwright is the fallback. Target flow: owned list -> server filter/page -> reload/back/forward -> correct owned progress detail. Verify price precision, all statuses, media failure, session/role isolation and all recovery states. Local artifacts are `C:/Users/PC/.codex/purchases-oct-*`.

## Implemented behavior

Replaced stacked cards with a compact four-column table and deliberately stacked mobile rows. Each row has a safe actual vehicle thumbnail or honest fallback, listing title, transaction reference, Lagos start time, labelled asking/agreed price, exact server status and one owned progress link. No payment or reservation action is triggered from the list. The existing PublicMedia and resource lifecycle components are reused without changing their shared behavior.

Strict query parsing forwards only supported status/limit/cursor fields. Reload, Back/Forward and bounded cursor history preserve position; direct cursors provide a First page recovery. Page-only counts avoid implying unsupported totals. Response validation rejects malformed dates, amounts, statuses, duplicate records and oversized pages. Background failures retain explicitly stale rows with pagination disabled; manual failures hide records. Account changes discard private rows and late responses.

## Final verification

- All 55 browser scenarios passed on the initial production build: 32 purchases-page cases and 23 shared navigation regressions. These cover all 12 server filters, money beyond JavaScript's safe integer range, null/zero handling, primary/safe/missing/failed photos, correct detail navigation, pagination/reload/history, malformed/error/offline/rate/denied recovery, loading and three empty states, staleness, session changes, three privileged-role redirects, short-screen keyboard use, ten widths and four Axe scans.
- All 21 existing backend vehicle workflow, boundary and security tests passed with actual database integration enabled. Fifteen frontend query/response and shared-resource lifecycle tests passed. Full lint and explicit TypeScript checks passed.
- Real isolated Express/Prisma/PostgreSQL plus browser acceptance passed: 12 owned records over 10+2 pages, all 12 status filters in API and browser, reload, exact large integer-kobo amounts, null asking-price fallback, missing photo fallback, correct owned detail navigation, archived-listing history, foreign cursor isolation, another customer's detail 404, privileged roles 403, anonymous 401 and invalid query 422. UI made no mutations and no browser errors occurred.
- Initial fixture creation was rejected for missing required accepted terms; valid terms and cancellation metadata were added to the isolated helper and the entire flow passed. No backend constraint was relaxed.
- Ten-width initial captures report no overflow/console messages/page errors. Final CSS reduces desktop guidance height, pairs mobile price/progress, increases room for desktop actions and reserves space from fixed support controls. The final production/standalone build, explicit TypeScript and focused lint passed. All 16 final layout/accessibility/long-content/short-keyboard repeats passed. The short-screen keyboard assertion checks that the focused link is above the support bar. Final captures and state reviews passed at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px, including the native 1536x1024 desktop viewport.

## Local evidence and reproducibility

Browser plugin not available; Edge via Playwright at `http://localhost:3001` was used. Baseline screenshots, built-browser captures, state captures and helper logs are outside the repository under `C:/Users/PC/.codex/purchases-oct-*`. Main logs: `browser.log`, `unit.log`, `backend.log`, `lint.log`, `types.log`, `build.log`, `real.log` and `captures.log`. Closing evidence: `build-final.log`, `types-final.log`, `lint-final.log`, `browser-final.log` (16 passing repeats), `captures-final.log` and `states-final.log`. Final concept WebPs and latest screenshots were opened with image inspection; all six state captures were reviewed. Empty/filtered/error viewport captures supplement full-page captures, and the short-screen image shows the focused progress link above the support bar. Helpers `purchases-oct-real.cjs`, `purchases-oct-after.cjs`, `purchases-oct-states.cjs` retain local QA setup; the committed scenarios/fixtures remain portable through the repository's test commands.

```powershell
# frontend; built preview at localhost:3001
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
npx playwright test tests/e2e/customer-purchases-quality.spec.ts tests/e2e/dashboard-navigation.spec.ts
npx playwright test tests/e2e/customer-purchases-quality.spec.ts --grep "layout|accessibility|short mobile|long titles"
npx vitest run tests/unit/customer-purchase-query.test.ts tests/unit/resource-background-refresh.test.tsx
npm run lint
npm run typecheck
npm run build
# backend; isolated test database with RUN_DATABASE_TESTS=true
npx vitest run tests/integration/phase7-vehicle-sales-flow.test.ts tests/api/phase7-vehicle-boundaries.test.ts tests/unit/phase7-vehicle-security.test.ts
```

## Fidelity ledger

| Item                           | Concept / earlier browser evidence                                                                          | Implementation correction or intentional decision                                                                                                                                                         | Final review                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Compact rows                   | Desktop concept 110px rows; baseline tall full-width cards.                                                 | Four-column semantic table with compact image/identity/price/status/progress.                                                                                                                             | Passed final screenshots and relevant browser repeats.       |
| Guidance                       | Desktop concept has a slim inline strip; first build stacked its copy.                                      | Desktop copy now inline with reduced padding; mobile remains stacked for readable wrapping.                                                                                                               | Passed final screenshots and relevant browser repeats.       |
| Mobile density                 | First build put the progress link on its own line.                                                          | Price and action share the bottom row with safe money wrapping; retain 44px action target.                                                                                                                | Passed final screenshots and relevant browser repeats.       |
| Action space                   | Initial desktop right edge approaches fixed support controls.                                               | Wider Progress column; tablet action inset and desktop footer spacing avoid that edge.                                                                                                                    | Passed final screenshots and relevant browser repeats.       |
| Typography and form boundaries | Concept requests Quicksand and strong compact controls.                                                     | Actual 27/30px heading, 16px field text, 48px selectors and 44px actions verified by computed styles.                                                                                                     | Final 10 widths pass.                                        |
| Media                          | Concepts contain sample car photographs.                                                                    | Use API-provided approved URLs only; fixture campaign bytes demonstrate image decoding, not real inventory identity. Missing/unsafe/failed sources show Image unavailable. No generated inventory assets. | Functional image checks pass.                                |
| Shell/copy                     | Generated mobile shell omits existing search/support; artwork contains blue links and invented total pages. | Keep actual shell/logo, ink links and page-only count; exact statuses, prices and timestamps come from API.                                                                                               | Intentional spec correction.                                 |
| State handling                 | State sheet shows separate empty/error/stale examples.                                                      | Distinct honest recovery states; full-page captures place fixed support bars at the original viewport boundary, so use normal scrolling/viewport captures for reachability.                               | Final state review and short keyboard visibility check pass. |

## Changed files

- [List component](../../app/components/vehicle-transactions.tsx), [route](../../app/dashboard/vehicle-transactions/page.tsx) and [scoped CSS](../../app/dashboard/vehicle-transactions/purchases.css).
- [Dashboard shell](../../app/components/dashboard-shell.tsx): only exclusion of the new list's duplicate generic breadcrumb belongs to this gate.
- [Query boundary](../../lib/customer-purchase-query.ts) and [response boundary](../../lib/api/customer-purchases-schema.ts).
- [Browser tests](../../tests/e2e/customer-purchases-quality.spec.ts), [fixtures](../../tests/fixtures/customer-purchases.ts) and [unit tests](../../tests/unit/customer-purchase-query.test.ts).
- This report and [retained concept/specification](customer-purchases-oct-concepts/README.md). The [register](README.md), [expanded brief](expanded-brief.md) and [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md) record this accepted scope.

## Boundaries

No required backend gap identified for this list. The API has no list search, arbitrary sort or global count; no control pretends otherwise. The parser tolerates absent image metadata with a fallback. Defensive zero-price rendering is covered, but the actual backend requires positive asking/agreed prices. Listing public-image visibility still applies to archived/unavailable inventory. Actual remote storage delivery and deployed session integration retain REL-01/REL-03 acceptance. Manual screen-reader, other-browser and physical mobile-keyboard testing are not established by automated Edge checks.

Next individual gate: `/dashboard/vehicle-transactions/[transactionId]`. This list gate does not certify the whole application or the detail workflow redesign.

Scoped formatting, local documentation links and diff checks form the closing documentation gate. No backend implementation change or new runtime dependency was needed. The application-wide goal remains active.
