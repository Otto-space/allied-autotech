# Product inventory

Route `/admin/inventory` — milestone 63, 17 October 2026.

## Implemented behaviour

The existing inventory workspace now has a named breadcrumb, compact heading,
persisted name/SKU search, historical administrator branch choice, low-stock filter
and reloadable cursor navigation. Exact product links remain supported. The page
shows actual records-on-page counts, with no fabricated global totals. Staff sees
only assigned-branch discovery controls; administrator creation is unavailable to
Staff/Customers. The API independently enforces current role, MFA and active branch.

Five desktop column meanings become complete labelled mobile facts. Full names,
SKUs, branch and inactive product/category facts remain visible. Available balances
come from the API, are validated against on-hand less reserved, and low-stock
equality uses the recorded reorder level. Invalid/duplicate query values block API
reads. Malformed, duplicate or mismatched records are rejected. Refresh failures
retain clearly blocked prior facts; denied reads remove them. Filters collapse on
mobile, with a single form and preserved values.

The existing creation form and review dialog are reused inside an administrator
disclosure. Opening it focuses the branch field; cancellation restores review-button
focus and sends no POST. Current administrator identity/status is rechecked before
creation. A verified session marker stores only the branch/product IDs before POST.
Storage failure blocks submission. Lost or contradictory results remain locked
through reload. Explicit saved-pair reconciliation uses the existing API and never
replays creation. A matching existing record can be opened without claiming it was
created by the uncertain request. Backend uniqueness protects the pair; creation
does not receive stock, reserve units or record a stock movement. Corrupt/unavailable
pending storage fails closed rather than guessing a pair.

## Concept fidelity

Fresh [desktop](work-inventory-oct-concepts/desktop.png) and
[mobile](work-inventory-oct-concepts/mobile.png) concepts preceded UI implementation.
The [extracted specification](work-inventory-oct-concepts/spec.md) records the
production copy, tokens and intentional corrections to generated material. Browser
plugin was unavailable; Playwright/Edge, Axe and direct image review were used.

| Comparison        | Final treatment                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell/copy        | Real Allied branding, authorised navigation and exact heading/actions replace generated suppliers/transfers navigation and slogans. Actual counts replace invented total counts.                             |
| Type/palette      | Compact Quicksand, pale canvas, white rows, ink heading band and red primary actions match the extracted specification; existing neutral status/link treatments remain consistent.                           |
| Filters           | Compact labelled search/branch/low-stock/action toolbar; inherited full-form action spacing was removed after screenshot comparison. Mobile uses one disclosure and stacked fields.                          |
| Records           | Five desktop columns, restrained horizontal separators, full part/branch facts and truthful inactive/low-stock labels. Two-column mobile quantities replace the generated cramped four-column layout.        |
| Creation          | Existing field labels/search/paging and reviewed empty-record semantics retained. Branch/search share a desktop row; the duplicate visible section title was removed while retaining its accessible heading. |
| Pagination/states | Only known page information is shown. Error, denial, pending and dialog states use the same visual language and complete actions.                                                                            |

The final native 1435×1096 desktop viewport, mobile renders and review dialog were
compared directly with the concepts. Above-the-fold copy follows the extracted
specification. Role guidance and pending/error copy are required workflow additions.
Real shell/branding, controlled type, neutral statuses, ink mobile heading and
two-column mobile facts are documented intentional differences from generated
images. The implementation was faithfully verified against the extracted specification; no material visual mismatches remain in the checked renders.

## Verification

- **26 distinct browser scenarios have passing evidence:** 22 new inventory cases
  and four existing inventory regressions. The combined run passed 25; the remaining
  reviewed-creation case passed after fixing cancellation focus restoration. Only
  the affected creation case was rerun after focus/layout refinements. Existing movement/reservation/release/sale and versioned
  reorder-level regressions passed without broad unrelated-suite repetition.
- New cases cover Admin/Super Admin/Staff controls, Customer denial, persistent
  search/branch/low-stock/paging and browser history, invalid queries, empty/error/
  denied/malformed/mismatched reads, blocked stale facts, validation/cancel/CSRF,
  lost/contradictory/uncommitted creation recovery through reload, failed recovery,
  current-access mismatch/outage, storage failure and complete long mobile content.
- **Four frontend unit cases** cover balance/uniqueness validation, encoded query
  scope, role filters, duplicate/invalid values and returned filter matching.
  **Ten distinct backend cases** have passing evidence; see the
  [backend contract](../../../backend/docs/staff-inventory-discovery.md).
- **19 responsive/state captures passed**, covering 320, 375, 390, 430, 768, 900,
  1024, 1440, 1467 and 1920px, native desktop and Staff/empty/error/denied/creation/
  review/pending/landscape states. Seven dedicated Axe scans and six long-content
  browser Axe scans passed with no overflow or browser errors. The initial capture
  navigation timed out; its helper then used DOM-ready navigation with explicit
  visible-content waits. Five final targeted captures/Axe scans then passed at 320, 390 and 1024px, native desktop and the mobile review dialog. They verified the compact toolbar, single visible creation title and no overflow, Axe violations or browser errors.
- **Real browser/Express/PostgreSQL passed:** persisted filter reload, zero-write
  cancellation, one empty audited creation after a dropped committed response,
  reload lock and explicit saved-pair recovery without replay, duplicate rejection
  without another audit, Staff creation denial, Customer read denial and private
  no-store headers. Stock/reservations remained zero and no movement was added;
  no browser errors occurred.
- Frontend lint findings were resolved with focused checks of all changed files;
  TypeScript and production build passed. The cancellation-focus and final layout
  refinements received scoped lint/build checks. Backend typecheck/lint, formatting,
  OpenAPI/types regeneration, 269-path validation and 322-operation coverage passed.
  Seven implementation hashes match the final tested production snapshot. A final
  DOM-ready browser probe confirmed the route/title, meaningful content, no framework
  overlay and zero console warnings/errors or page errors.

## Data and release boundary

Only the preceding gate's new isolated local database
`allied_work_aftercare_20261017_test` at `127.0.0.1:55480` was reused. Each write helper
verified its actual target first. The existing 58-migration replay, db:check and
restricted runtime-role evidence remain valid; no schema change required another
replay. Domain fixtures are preserved and only helper-owned synthetic sessions were
removed. No application/shared/staging/production data or grants changed. No new
migration, backup operation, restore rehearsal, off-device recovery verification
or deployment occurred.

Deploy the additive backend search query before this frontend. Target-environment
role/branch, recovery and cache acceptance remain open. Search performance at
production volume was not benchmarked. ADM-15 remains a separate finance follow-up.
Private evidence is under `C:/Users/PC/.codex/work-inventory-*`; credentials are
excluded from repository reports. Next separate gate: inventory detail
`/admin/inventory/[inventoryId]`. The full application goal remains active.
